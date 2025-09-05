import { logger } from "config/logger";
import * as Keychain from "react-native-keychain";
import { PersistentStorage } from "services/storage/storageFactory";

/**
 * Default service name used for the keychain
 */
const DEFAULT_SERVICE = "freighter_secure_storage";

/**
 * Implementation of PersistentStorage using react-native-keychain
 * This provides a more secure storage option compared to AsyncStorage
 */
export const reactNativeKeychainStorage: PersistentStorage = {
  /**
   * Retrieves an item from the keychain
   * @param {string} key - The key to retrieve
   * @returns {Promise<string | null>} The stored value or null if not found
   */
  getItem: async (key) => {
    try {
      const result = await Keychain.getGenericPassword({
        service: `${DEFAULT_SERVICE}_${key}`,
      });

      if (result === false) {
        return null;
      }

      return result.password;
    } catch (error) {
      logger.error(
        "reactNativeKeychainStorage.getItem",
        `Error retrieving key from keychain: ${key}`,
        error,
      );

      return null;
    }
  },

  /**
   * Stores an item in the keychain
   * @param {string} key - The key to store the value under
   * @param {string} value - The value to store
   * @returns {Promise<void>}
   */
  setItem: async (key, value) => {
    try {
      await Keychain.setGenericPassword(key, value, {
        service: `${DEFAULT_SERVICE}_${key}`,
      });
    } catch (error) {
      throw new Error(`Failed to store item in keychain: ${key}`);
    }
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
