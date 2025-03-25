import { asyncStorage } from "services/storage/asyncStorage";
import { reactNativeKeychainStorage } from "services/storage/reactNativeKeychainStorage";

// This interface is used to define the methods that are required for a storage implementation.
export interface PersistentStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
}

// React Native Keychain is currently used for secure storage, but AsyncStorage is used for general storage.
export const secureDataStorage = reactNativeKeychainStorage;
export const dataStorage = asyncStorage;
