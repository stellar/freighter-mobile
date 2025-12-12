import * as Keychain from "react-native-keychain";
import { asyncStorage } from "services/storage/asyncStorage";
import {
  unifiedSecureStorage,
  rnBiometrics,
} from "services/storage/unifiedSecureStorage";

// This interface is used to define the methods that are required for a storage implementation.
export interface PersistentStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * Interface for biometric-protected storage operations
 *
 * This interface defines the contract for storing and retrieving data that requires
 * biometric authentication. It provides methods for secure storage of sensitive
 * information like passwords, with biometric verification required for access.
 *
 * The implementation uses the device's secure storage (Keychain on iOS, Keystore on Android)
 * and integrates with biometric authentication systems.
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
  getItem(
    key: string,
    message?: {
      title: string;
      cancel: string;
    },
  ): Promise<Keychain.UserCredentials | false>;

  /**
   * Stores an item in biometric-protected storage
   *
   * @param {string} key - The storage key for the item
   * @param {string} value - The value to store securely
   * @returns {Promise<void>}
   */
  setItem(key: string, value: string): Promise<void>;

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
  checkIfExists(key: string): Promise<boolean>;
}

/**
 * Wrapper for secure storage that uses automatic keychain biometric prompts
 * Used for sensitive data like encrypted wallet blobs and hash keys
 */
const secureDataStorageWrapper: PersistentStorage = {
  getItem: async (key: string) =>
    unifiedSecureStorage.getItem(key, {
      requireExplicitBiometricPrompt: false,
    }),
  setItem: async (key: string, value: string) =>
    unifiedSecureStorage.setItem(key, value),
  remove: async (keys: string | string[]) => unifiedSecureStorage.remove(keys),
  clear: async () => unifiedSecureStorage.clear(),
};

/**
 * Wrapper for biometric storage that uses explicit biometric prompts
 * Used for biometric-protected passwords that need custom prompt UI
 */
const biometricDataStorageWrapper: BiometricStorage = {
  getItem: async (
    key: string,
    message?: { title: string; cancel: string },
  ): Promise<Keychain.UserCredentials | false> => {
    if (message) {
      return unifiedSecureStorage.getItemWithCredentials(key, {
        requireExplicitBiometricPrompt: true,
        biometricPrompt: message,
      });
    }
    // Fallback to automatic prompt if no message provided
    const result = await unifiedSecureStorage.getItemWithCredentials(key, {
      requireExplicitBiometricPrompt: false,
    });
    return result;
  },
  setItem: async (key: string, value: string) =>
    unifiedSecureStorage.setItem(key, value),
  remove: async (keys: string | string[]) => unifiedSecureStorage.remove(keys),
  clear: async () => unifiedSecureStorage.clear(),
  checkIfExists: async (key: string) => unifiedSecureStorage.checkIfExists(key),
};

// React Native Keychain is currently used for secure storage, but AsyncStorage is used for general storage.
// Both secureDataStorage and biometricDataStorage now use the unified secure storage implementation
// with different configurations (automatic vs explicit biometric prompts).
export const secureDataStorage = secureDataStorageWrapper;
export const dataStorage = asyncStorage;
export const biometricDataStorage = biometricDataStorageWrapper;

// Re-export rnBiometrics for convenience and backward compatibility
export { rnBiometrics };
