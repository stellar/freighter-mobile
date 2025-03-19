import { expoSecureStorage } from "services/storage/expoSecureStorage";

// This interface is used to define the methods that are required for a storage implementation.
export interface PersistentStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
}

// This function is used to create a storage object that can be used to interact with the storage implementation.
// Currently, the only supported storage implementation is Expo Secure Storage.
// This is the function that needs to be imported and used in the application code. Not the implementation itself.
export const dataStorage = expoSecureStorage;
