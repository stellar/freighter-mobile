import { logger } from "config/logger";
import * as Keychain from "react-native-keychain";
import { BiometricStorage } from "services/storage/storageFactory";

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
    const biometryType = await Keychain.getSupportedBiometryType();
    if (biometryType === Keychain.BIOMETRY_TYPE.FACE_ID) {
      await Keychain.setGenericPassword(key, value, {
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        service: `${DEFAULT_SERVICE}_${key}`,
      });
    }
  },

  getItem: async (key, prompt?: Keychain.AuthenticationPrompt) => {
    const biometryType = await Keychain.getSupportedBiometryType();
    if (biometryType === Keychain.BIOMETRY_TYPE.FACE_ID) {
      const result = await Keychain.getGenericPassword({
        service: `${DEFAULT_SERVICE}_${key}`,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
        authenticationPrompt: {
          ...prompt,
        },
      });
      return result;
    }
    return false;
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
  clear: async () => {
    await Keychain.resetGenericPassword({
      service: DEFAULT_SERVICE,
    });
  },
};
