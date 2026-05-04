import { logger } from "config/logger";
import ReactNativeBiometrics from "react-native-biometrics";
import * as Keychain from "react-native-keychain";
import {
  SECURE_KEYCHAIN_GET_OPTIONS,
  SECURE_KEYCHAIN_SET_OPTIONS,
} from "services/storage/keychainSecurityConfig";

/**
 * React Native Biometrics instance for biometric authentication
 *
 * This instance is configured to allow device credentials as a fallback
 * when biometric authentication is not available or fails.
 */
export const rnBiometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true,
});

/**
 * Service name for secure storage
 * Maintains backward compatibility with existing data
 */
export const SECURE_STORAGE_SERVICE = "freighter_secure_storage";

/**
 * Service name for biometric storage
 * Maintains backward compatibility with existing biometric data
 */
export const BIOMETRIC_STORAGE_SERVICE = "freighter_biometric_storage";

/**
 * react-native-keychain's iOS bridge translates the Security framework's
 * errSecInteractionNotAllowed (-25308) status code into this exact string.
 * It fires when the device is locked or the app is backgrounded and our
 * BIOMETRY_ANY_OR_DEVICE_PASSCODE access control can't surface a prompt.
 *
 * This is an environmental condition (Zustand rehydration on cold start
 * before unlock, WalletConnect session restore, push notification
 * handlers reaching for stored credentials), not a real failure — the
 * caller already handles the empty result gracefully.
 */
const IOS_INTERACTION_NOT_ALLOWED = "User interaction is not allowed.";

const isInteractionNotAllowed = (error: unknown): boolean =>
  error instanceof Error && error.message === IOS_INTERACTION_NOT_ALLOWED;

/**
 * Options for storing/retrieving items from secure storage
 */
export interface SecureStorageOptions {
  /**
   * Prompt configuration for explicit biometric authentication
   * If provided, shows a custom confirmation biometric prompt before accessing the item.
   */
  explicitBiometricPrompt?: {
    title: string;
    cancel: string;
  };
}

/**
 * Creates a secure storage instance with a specific service name
 *
 * All sensitive data is stored with maximum security:
 * - Device-only (excluded from backups/migration)
 * - Requires passcode to be set on device
 * - Requires biometric/passcode on every access
 *
 * @param serviceName - The service name to use for keychain storage
 * @returns A secure storage instance configured with the given service name
 */
export const createSecureStorage = (serviceName: string) => ({
  /**
   * Stores an item in secure storage
   *
   * Platform-specific behavior:
   * - iOS: Uses accessControl to require user presence (biometrics or passcode) on read
   * - Android: Does not use accessControl to avoid unwanted prompts
   *
   * @param key - The key to store the value under
   * @param value - The value to store
   */
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const storageOptions: Keychain.SetOptions = {
        service: `${serviceName}_${key}`,
        ...SECURE_KEYCHAIN_SET_OPTIONS,
      };

      await Keychain.setGenericPassword(key, value, storageOptions);
    } catch (error) {
      // Writes happen on auth-critical paths (createTemporaryStore,
      // biometricDataStorage.setItem during sign-in/import). The user is
      // in foreground when these run, so errSecInteractionNotAllowed here
      // is unusual and indicates a real failure to persist credentials -
      // keep on logger.error so we have visibility on auth-flow regressions.
      logger.error(
        "secureStorage.setItem",
        "Error storing item in keychain",
        error,
      );
      throw new Error("Failed to store item in keychain");
    }
  },

  /**
   * Retrieves an item from secure storage
   *
   * Platform-specific behavior:
   * - iOS: Uses accessControl to require user presence (biometrics or passcode) on read
   * - Android: Does not use accessControl to avoid unwanted prompts
   *
   * @param key - The key to retrieve
   * @param options - Retrieval options (biometric prompt)
   * @returns The stored credentials, or false if not found or authentication failed
   */
  getItem: async (
    key: string,
    options?: SecureStorageOptions,
  ): Promise<Keychain.UserCredentials | false> => {
    try {
      // If explicit biometric prompt is provided, show it first (works for both iOS and Android)
      if (options?.explicitBiometricPrompt) {
        const hasVerified = await rnBiometrics.simplePrompt({
          promptMessage: options.explicitBiometricPrompt.title,
          cancelButtonText: options.explicitBiometricPrompt.cancel,
        });
        if (!hasVerified.success) {
          return false;
        }
      }

      const getOptions: Keychain.GetOptions = {
        service: `${serviceName}_${key}`,
        ...SECURE_KEYCHAIN_GET_OPTIONS,
      };

      const result = await Keychain.getGenericPassword(getOptions);
      return result;
    } catch (error) {
      if (isInteractionNotAllowed(error)) {
        logger.warn(
          "secureStorage.getItem",
          "Keychain read blocked - app likely backgrounded or device locked",
        );
      } else {
        logger.error(
          "secureStorage.getItem",
          "Error retrieving item from keychain",
          error,
        );
      }
      return false;
    }
  },

  /**
   * Removes one or more items from secure storage
   *
   * @param keys - The key(s) to remove
   */
  remove: async (keys: string | string[]): Promise<void> => {
    try {
      if (Array.isArray(keys)) {
        await Promise.all(
          keys.map((key) =>
            Keychain.resetGenericPassword({
              service: `${serviceName}_${key}`,
            }),
          ),
        );
        return;
      }

      await Keychain.resetGenericPassword({
        service: `${serviceName}_${keys}`,
      });
    } catch (error) {
      // Removal failures are security-relevant (used to delete sensitive
      // keys during logout / wipe / account deletion). Silent failures
      // would leave stale credentials on device - keep on logger.error.
      logger.error(
        "secureStorage.remove",
        "Error removing keys from keychain",
        error,
      );
      // Don't throw since removal failures shouldn't block execution
    }
  },

  /**
   * Checks if an item exists in secure storage
   *
   * @param key - The storage key to check
   * @returns True if the item exists, false otherwise
   */
  checkIfExists: async (key: string): Promise<boolean> => {
    try {
      const result = await Keychain.hasGenericPassword({
        service: `${serviceName}_${key}`,
      });
      return result;
    } catch (error) {
      if (isInteractionNotAllowed(error)) {
        logger.warn(
          "secureStorage.checkIfExists",
          "Keychain check blocked - app likely backgrounded or device locked",
        );
      } else {
        logger.error(
          "secureStorage.checkIfExists",
          "Error checking if item exists",
          error,
        );
      }
      return false;
    }
  },

  /**
   * Clears all items managed by this storage instance
   *
   * Enumerates every keychain entry whose service name starts with
   * `${serviceName}_` and deletes them. This covers keys from all app
   * versions without needing a hardcoded list.
   */
  clear: async (): Promise<void> => {
    try {
      const allServices = await Keychain.getAllGenericPasswordServices();
      const prefix = `${serviceName}_`;
      const matching = allServices.filter((s) => s.startsWith(prefix));
      await Promise.all(
        matching.map((service) => Keychain.resetGenericPassword({ service })),
      );
    } catch (error) {
      // clear() is part of the logout / wipe path. If keychain deletion
      // is blocked the method swallows the failure (no throw) and logout
      // proceeds, leaving credentials on device. That's security-relevant
      // and we want full visibility - keep on logger.error.
      logger.error("secureStorage.clear", "Error clearing keychain", error);
    }
  },
});
