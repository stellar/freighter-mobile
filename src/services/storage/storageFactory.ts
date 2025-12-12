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
 * Unified secure storage wrapper
 *
 * All sensitive data uses the same secure storage with maximum security.
 * Supports both automatic keychain prompts and explicit biometric prompts.
 */
const secureDataStorageWrapper: PersistentStorage = {
  getItem: async (key: string) => unifiedSecureStorage.getItem(key),
  setItem: async (key: string, value: string) =>
    unifiedSecureStorage.setItem(key, value),
  remove: async (keys: string | string[]) => unifiedSecureStorage.remove(keys),
  clear: async () => unifiedSecureStorage.clear(),
};

/**
 * Biometric storage wrapper
 *
 * Same as secureDataStorage but with additional methods for biometric-specific use cases:
 * - Returns UserCredentials instead of just password
 * - Supports custom biometric prompt messages
 * - Includes checkIfExists method
 */
export const biometricDataStorage = {
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
    return unifiedSecureStorage.getItemWithCredentials(key);
  },
  setItem: async (key: string, value: string) =>
    unifiedSecureStorage.setItem(key, value),
  remove: async (keys: string | string[]) => unifiedSecureStorage.remove(keys),
  clear: async () => unifiedSecureStorage.clear(),
  checkIfExists: async (key: string) => unifiedSecureStorage.checkIfExists(key),
};

// React Native Keychain is currently used for secure storage, but AsyncStorage is used for general storage.
export const secureDataStorage = secureDataStorageWrapper;
export const dataStorage = asyncStorage;

// Re-export rnBiometrics for convenience and backward compatibility
export { rnBiometrics };
