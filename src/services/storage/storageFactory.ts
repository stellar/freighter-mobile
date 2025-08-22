import * as Keychain from "react-native-keychain";
import { asyncStorage } from "services/storage/asyncStorage";
import { reactNativeBiometricStorage } from "services/storage/reactNativeBiometricStorage";
import { reactNativeKeychainStorage } from "services/storage/reactNativeKeychainStorage";

// This interface is used to define the methods that are required for a storage implementation.
export interface PersistentStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  clear: () => Promise<void>;
}

export interface BiometricStorage {
  getItem(
    key: string,
    message?: Keychain.AuthenticationPrompt,
  ): Promise<Keychain.UserCredentials | false>;
  setItem(key: string, value: string): Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  clear: () => Promise<void>;
}

// React Native Keychain is currently used for secure storage, but AsyncStorage is used for general storage.
export const secureDataStorage = reactNativeKeychainStorage;
export const dataStorage = asyncStorage;
export const biometricDataStorage = reactNativeBiometricStorage;
