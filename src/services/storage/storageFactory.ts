import * as Keychain from "react-native-keychain";
import { asyncStorage } from "services/storage/asyncStorage";
import {
  BIOMETRIC_STORAGE_SERVICE,
  createSecureStorage,
  SECURE_STORAGE_SERVICE,
} from "services/storage/secureStorage";

/**
 * Interface for persistent storage operations
 *
 * This interface defines the contract for storing and retrieving data persistently.
 * It provides methods for secure storage of information with standard CRUD operations.
 */
export interface PersistentStorage {
  /**
   * Retrieves an item from storage
   *
   * @param {string} key - The storage key for the item
   * @returns {Promise<string | null>} The stored value or null if not found
   */
  getItem(key: string): Promise<string | null>;

  /**
   * Stores an item in storage
   *
   * @param {string} key - The storage key for the item
   * @param {string} value - The value to store
   * @returns {Promise<void>}
   */
  setItem(key: string, value: string): Promise<void>;

  /**
   * Removes one or more items from storage
   *
   * @param {string | string[]} keys - The key(s) to remove
   * @returns {Promise<void>}
   */
  remove: (keys: string | string[]) => Promise<void>;

  /**
   * Clears all storage
   *
   * @returns {Promise<void>}
   */
  clear: () => Promise<void>;
}

/**
 * Interface for biometric-protected storage operations
 *
 * This interface extends storage operations with biometric authentication support.
 * The getItem method can optionally show a biometric prompt and returns the full
 * keychain credentials instead of just the password string.
 */
export interface BiometricStorage {
  /**
   * Retrieves an item from biometric-protected storage
   *
   * @param {string} key - The storage key for the item
   * @param {Object} [message] - Optional prompt configuration for biometric authentication
   * @param {string} message.title - Title displayed during biometric prompt
   * @param {string} message.cancel - Text for the cancel button
   * @returns {Promise<Keychain.UserCredentials | false>} The stored credentials or false if authentication fails
   */
  getItem: (
    key: string,
    message?: { title: string; cancel: string },
  ) => Promise<Keychain.UserCredentials | false>;

  /**
   * Stores an item in biometric-protected storage
   *
   * @param {string} key - The storage key for the item
   * @param {string} value - The value to store securely
   * @returns {Promise<void>}
   */
  setItem: (key: string, value: string) => Promise<void>;

  /**
   * Removes one or more items from biometric-protected storage
   *
   * @param {string | string[]} keys - The key(s) to remove
   * @returns {Promise<void>}
   */
  remove: (keys: string | string[]) => Promise<void>;

  /**
   * Clears all biometric-protected storage
   *
   * @returns {Promise<void>}
   */
  clear: () => Promise<void>;

  /**
   * Checks if an item exists in biometric-protected storage
   *
   * @param {string} key - The storage key to check
   * @returns {Promise<boolean>} True if the item exists, false otherwise
   */
  checkIfExists: (key: string) => Promise<boolean>;
}

/**
 * Secure storage instance using freighter_secure_storage service name
 * Maintains backward compatibility with existing data
 */
const secureStorageInstance = createSecureStorage(SECURE_STORAGE_SERVICE);

/**
 * Biometric storage instance using freighter_biometric_storage service name
 * Maintains backward compatibility with existing biometric data
 */
const biometricStorageInstance = createSecureStorage(BIOMETRIC_STORAGE_SERVICE);

/**
 * Secure storage wrapper
 *
 * All sensitive data uses the same secure storage with maximum security.
 * Supports both automatic keychain prompts and explicit biometric prompts.
 */
const secureDataStorageWrapper: PersistentStorage = {
  getItem: async (key: string) => {
    const result = await secureStorageInstance.getItem(key);
    return result ? result.password : null;
  },
  setItem: async (key: string, value: string) =>
    secureStorageInstance.setItem(key, value),
  remove: async (keys: string | string[]) => secureStorageInstance.remove(keys),
  clear: async () => secureStorageInstance.clear(),
};

/**
 * Biometric storage wrapper
 *
 * Provides a convenience API for biometric storage with simplified prompt handling.
 * The wrapper accepts { title, cancel } directly instead of { explicitBiometricPrompt: { title, cancel } }.
 */
const biometricStorageWrapper: BiometricStorage = {
  /**
   * Retrieves an item from biometric-protected storage
   *
   * @param {string} key - The storage key for the item
   * @param {Object} [message] - Optional prompt configuration for biometric authentication
   * @param {string} message.title - Title displayed during biometric prompt
   * @param {string} message.cancel - Text for the cancel button
   * @returns {Promise<Keychain.UserCredentials | false>} The stored credentials or false if authentication fails
   */
  getItem: async (
    key: string,
    message?: { title: string; cancel: string },
  ): Promise<Keychain.UserCredentials | false> => {
    if (message) {
      return biometricStorageInstance.getItem(key, {
        explicitBiometricPrompt: message,
      });
    }
    return biometricStorageInstance.getItem(key);
  },

  /**
   * Stores an item in biometric-protected storage
   *
   * @param {string} key - The storage key for the item
   * @param {string} value - The value to store securely
   * @returns {Promise<void>}
   */
  setItem: async (key: string, value: string) =>
    biometricStorageInstance.setItem(key, value),

  /**
   * Removes one or more items from biometric-protected storage
   *
   * @param {string | string[]} keys - The key(s) to remove
   * @returns {Promise<void>}
   */
  remove: async (keys: string | string[]) =>
    biometricStorageInstance.remove(keys),

  /**
   * Clears all biometric-protected storage
   *
   * @returns {Promise<void>}
   */
  clear: async () => biometricStorageInstance.clear(),

  /**
   * Checks if an item exists in biometric-protected storage
   *
   * @param {string} key - The storage key to check
   * @returns {Promise<boolean>} True if the item exists, false otherwise
   */
  checkIfExists: async (key: string) =>
    biometricStorageInstance.checkIfExists(key),
};

// React Native Keychain is currently used for secure storage, but AsyncStorage is used for general storage.
export const secureDataStorage = secureDataStorageWrapper;
export const dataStorage = asyncStorage;
export const biometricDataStorage = biometricStorageWrapper;
