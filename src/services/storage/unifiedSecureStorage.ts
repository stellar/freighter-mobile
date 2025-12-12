import { logger } from "config/logger";
import ReactNativeBiometrics from "react-native-biometrics";
import * as Keychain from "react-native-keychain";
import { SECURE_KEYCHAIN_OPTIONS } from "services/storage/keychainSecurityConfig";

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
 * Default service name used for the keychain
 */
const DEFAULT_SERVICE = "freighter_secure_storage";

/**
 * Options for storing/retrieving items from secure storage
 */
export interface SecureStorageOptions {
  /**
   * Whether to require an explicit biometric prompt before accessing the item.
   * When true, uses react-native-biometrics to show a custom prompt.
   * When false, relies on the keychain's automatic biometric prompt via accessControl.
   *
   * @default false
   */
  requireExplicitBiometricPrompt?: boolean;

  /**
   * Prompt configuration for explicit biometric authentication
   * Only used when requireExplicitBiometricPrompt is true
   */
  biometricPrompt?: {
    title: string;
    cancel: string;
  };
}

/**
 * Unified secure storage implementation using react-native-keychain
 *
 * All sensitive data is stored with maximum security:
 * - Device-only (excluded from backups/migration)
 * - Requires passcode to be set on device
 * - Requires biometric/passcode on every access
 */
export const unifiedSecureStorage = {
  /**
   * Stores an item in secure storage
   *
   * @param key - The key to store the value under
   * @param value - The value to store
   */
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await Keychain.setGenericPassword(key, value, {
        service: `${DEFAULT_SERVICE}_${key}`,
        ...SECURE_KEYCHAIN_OPTIONS,
      });
    } catch (error) {
      logger.error(
        "unifiedSecureStorage.setItem",
        `Error storing item in keychain: ${key}`,
        error,
      );
      throw new Error(`Failed to store item in keychain: ${key}`);
    }
  },

  /**
   * Retrieves an item from secure storage
   *
   * If requireExplicitBiometricPrompt is true, shows a custom biometric prompt first.
   * Otherwise, relies on the keychain's automatic biometric prompt.
   *
   * @param key - The key to retrieve
   * @param options - Retrieval options (biometric prompt)
   * @returns The stored value as a string, or null if not found or authentication failed
   */
  getItem: async (
    key: string,
    options?: SecureStorageOptions,
  ): Promise<string | null> => {
    try {
      // If explicit biometric prompt is required, show it first
      if (options?.requireExplicitBiometricPrompt && options?.biometricPrompt) {
        const hasVerified = await rnBiometrics.simplePrompt({
          promptMessage: options.biometricPrompt.title,
          cancelButtonText: options.biometricPrompt.cancel,
        });
        if (!hasVerified.success) {
          return null;
        }
      }

      const result = await Keychain.getGenericPassword({
        service: `${DEFAULT_SERVICE}_${key}`,
        accessControl: SECURE_KEYCHAIN_OPTIONS.accessControl,
      });

      if (result === false) {
        return null;
      }

      return result.password;
    } catch (error) {
      logger.error(
        "unifiedSecureStorage.getItem",
        `Error retrieving key from keychain: ${key}`,
        error,
      );
      return null;
    }
  },

  /**
   * Retrieves an item from secure storage with full credential information
   *
   * Similar to getItem but returns the full UserCredentials object instead of just the password.
   * Useful when you need the username or other credential metadata.
   *
   * @param key - The key to retrieve
   * @param options - Retrieval options (biometric prompt)
   * @returns The stored credentials, or false if not found or authentication failed
   */
  getItemWithCredentials: async (
    key: string,
    options?: SecureStorageOptions,
  ): Promise<Keychain.UserCredentials | false> => {
    try {
      // If explicit biometric prompt is required, show it first
      if (options?.requireExplicitBiometricPrompt && options?.biometricPrompt) {
        const hasVerified = await rnBiometrics.simplePrompt({
          promptMessage: options.biometricPrompt.title,
          cancelButtonText: options.biometricPrompt.cancel,
        });
        if (!hasVerified.success) {
          return false;
        }
      }

      const result = await Keychain.getGenericPassword({
        service: `${DEFAULT_SERVICE}_${key}`,
        accessControl: SECURE_KEYCHAIN_OPTIONS.accessControl,
      });

      return result;
    } catch (error) {
      logger.error(
        "unifiedSecureStorage.getItemWithCredentials",
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
              service: `${DEFAULT_SERVICE}_${key}`,
            }),
          ),
        );
        return;
      }

      await Keychain.resetGenericPassword({
        service: `${DEFAULT_SERVICE}_${keys}`,
      });
    } catch (error) {
      logger.error(
        "unifiedSecureStorage.remove",
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
        service: `${DEFAULT_SERVICE}_${key}`,
      });
      return result;
    } catch (error) {
      logger.error(
        "unifiedSecureStorage.checkIfExists",
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
        service: DEFAULT_SERVICE,
      });
    } catch (error) {
      logger.error(
        "unifiedSecureStorage.clear",
        "Error clearing keychain",
        error,
      );
    }
  },
};
