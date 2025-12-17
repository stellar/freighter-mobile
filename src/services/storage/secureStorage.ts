import { logger } from "config/logger";
import { isIOS } from "helpers/device";
import ReactNativeBiometrics from "react-native-biometrics";
import * as Keychain from "react-native-keychain";
import {
  SECURE_KEYCHAIN_OPTIONS_ANDROID,
  SECURE_KEYCHAIN_OPTIONS_IOS,
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
      // iOS: Use accessControl to require user presence
      // Android: Do not use accessControl to avoid unwanted prompts
      const storageOptions: Keychain.SetOptions = isIOS
        ? {
            service: `${serviceName}_${key}`,
            accessible: SECURE_KEYCHAIN_OPTIONS_IOS.accessible,
            accessControl: SECURE_KEYCHAIN_OPTIONS_IOS.accessControl,
          }
        : {
            service: `${serviceName}_${key}`,
            accessible: SECURE_KEYCHAIN_OPTIONS_ANDROID.accessible,
          };

      await Keychain.setGenericPassword(key, value, storageOptions);
    } catch (error) {
      logger.error(
        "secureStorage.setItem",
        `Error storing item in keychain: ${key}`,
        error,
      );
      throw new Error(`Failed to store item in keychain: ${key}`);
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

      // iOS: Use accessControl to require user presence
      // Android: Do not pass accessControl to avoid unwanted prompts
      const getOptions: Keychain.GetOptions = isIOS
        ? {
            service: `${serviceName}_${key}`,
            accessControl: SECURE_KEYCHAIN_OPTIONS_IOS.accessControl,
          }
        : {
            service: `${serviceName}_${key}`,
          };

      const result = await Keychain.getGenericPassword(getOptions);
      return result;
    } catch (error) {
      logger.error(
        "secureStorage.getItem",
        `Error retrieving key from keychain: ${key}`,
        error,
      );
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
      logger.error(
        "secureStorage.checkIfExists",
        `Error checking if key exists: ${key}`,
        error,
      );
      return false;
    }
  },

  /**
   * Clears all secure storage
   *
   * Note: This uses the service name only, which may not match all individual entries
   * depending on how they were stored. For more reliable clearing, use remove() with
   * specific keys.
   */
  clear: async (): Promise<void> => {
    try {
      await Keychain.resetGenericPassword({
        service: serviceName,
      });
    } catch (error) {
      logger.error("secureStorage.clear", "Error clearing keychain", error);
    }
  },
});
