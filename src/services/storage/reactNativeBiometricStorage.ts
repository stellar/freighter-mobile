import { logger } from "config/logger";
import ReactNativeBiometrics from "react-native-biometrics";
import * as Keychain from "react-native-keychain";
import { BiometricStorage } from "services/storage/storageFactory";

/**
 * React Native Biometrics instance for biometric authentication
 *
 * This instance is configured to allow device credentials as a fallback
 * when biometric authentication is not available or fails. It provides
 * the core biometric functionality for the application.
 *
 * Configuration:
 * - allowDeviceCredentials: true - Enables fallback to device PIN/password
 */
export const rnBiometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true,
});

/**
 * Default service name used for the keychain
 *
 * This service name is used as a prefix for all biometric storage keys
 * in the device's secure keychain. It helps organize and identify
 * Freighter-specific biometric data.
 */
const DEFAULT_SERVICE = "freighter_biometric_storage";

/**
 * Implementation of BiometricStorage using react-native-keychain
 *
 * This service provides biometric-protected storage using the device's secure storage
 * capabilities. It integrates with the device's biometric authentication system
 * (Face ID, Touch ID, fingerprint) to provide secure access to stored data.
 *
 * Key features:
 * - Uses Keychain on iOS and Keystore on Android for secure storage
 * - Requires biometric authentication for data retrieval
 * - Supports multiple biometric types (Face ID, Touch ID, fingerprint, etc.)
 * - Provides fallback mechanisms for devices without biometric support
 *
 * This implementation is more secure than AsyncStorage or SecureStorage as it
 * leverages the device's hardware security features.
 */
export const reactNativeBiometricStorage: BiometricStorage = {
  /**
   * Stores an item in the keychain with biometric protection
   * @param {string} key - The key to store the value under
   * @param {string} value - The value to store
   * @returns {Promise<void>}
   */
  setItem: async (key, value) => {
    await Keychain.setGenericPassword(key, value, {
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      service: `${DEFAULT_SERVICE}_${key}`,
    });
  },

  /**
   * Retrieves an item from biometric-protected storage
   *
   * This method first prompts the user for biometric authentication using
   * the device's biometric capabilities. If authentication succeeds, it
   * retrieves the stored data from the secure keychain.
   *
   * @param {string} key - The storage key for the item
   * @param {Object} [prompt] - Optional prompt configuration
   * @param {string} [prompt.title] - Title displayed during biometric prompt
   * @param {string} [prompt.cancel] - Text for the cancel button
   * @returns {Promise<Keychain.UserCredentials | false>} The stored credentials or false if authentication fails
   *
   * @example
   * const credentials = await reactNativeBiometricStorage.getItem('userPassword', {
   *   title: 'Authenticate to access password',
   *   cancel: 'Cancel'
   * });
   */
  getItem: async (key, prompt) => {
    const hasVerified = await rnBiometrics.simplePrompt({
      promptMessage: prompt?.title ?? "",
      cancelButtonText: prompt?.cancel ?? "",
    });
    if (!hasVerified.success) {
      return false;
    }

    const result = await Keychain.getGenericPassword({
      service: `${DEFAULT_SERVICE}_${key}`,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
    });
    return result;
  },

  /**
   * Removes one or more items from the keychain
   * @param {string | string[]} keys - The key(s) to remove
   * @returns {Promise<void>}
   */
  remove: async (keys) => {
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
        "reactNativeKeychainStorage.remove",
        "Error removing keys from keychain",
        error,
      );
      // Don't throw since removal failures shouldn't block execution
    }
  },
  /**
   * Checks if an item exists in biometric-protected storage
   *
   * This method verifies whether a specific key exists in the secure keychain
   * without requiring biometric authentication. It's useful for checking
   * availability before attempting to retrieve data.
   *
   * @param {string} key - The storage key to check
   * @returns {Promise<boolean>} True if the item exists, false otherwise
   *
   * @example
   * const hasPassword = await reactNativeBiometricStorage.checkIfExists('userPassword');
   * if (hasPassword) {
   *   // Proceed with biometric authentication
   *   const password = await reactNativeBiometricStorage.getItem('userPassword');
   * }
   */
  checkIfExists: async (key) => {
    const result = await Keychain.hasGenericPassword({
      service: `${DEFAULT_SERVICE}_${key}`,
    });
    return result;
  },
  /**
   * Clears all biometric-protected storage
   *
   * This method removes all stored items from the secure keychain.
   * Use with caution as this will permanently delete all biometric-protected data.
   *
   * @returns {Promise<void>}
   *
   * @example
   * // Clear all biometric storage (e.g., during logout)
   * await reactNativeBiometricStorage.clear();
   */
  clear: async () => {
    await Keychain.resetGenericPassword({
      service: DEFAULT_SERVICE,
    });
  },
};
