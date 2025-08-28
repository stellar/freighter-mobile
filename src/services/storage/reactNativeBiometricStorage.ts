import { logger } from "config/logger";
import ReactNativeBiometrics from "react-native-biometrics";
import * as Keychain from "react-native-keychain";
import { BiometricStorage } from "services/storage/storageFactory";

export const rnBiometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true,
});

/**
 * Default service name used for the keychain
 */
const DEFAULT_SERVICE = "freighter_biometric_storage";

/**
 * Implementation of BiometricStorage using react-native-keychain
 * This is used to store biometric protected data - provides a more secure storage option compared to AsyncStorage or SecureStorage
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
  checkIfExists: async (key) => {
    const result = await Keychain.hasGenericPassword({
      service: `${DEFAULT_SERVICE}_${key}`,
    });
    return result;
  },
  clear: async () => {
    await Keychain.resetGenericPassword({
      service: DEFAULT_SERVICE,
    });
  },
};
