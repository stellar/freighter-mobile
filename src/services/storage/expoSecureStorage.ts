import * as SecureStore from "expo-secure-store";
import { PersistentStorage } from "services/storage/storageFactory";

export const expoSecureStorage: PersistentStorage = {
  getItem: async (key) => {
    const value = await SecureStore.getItemAsync(key);

    return value;
  },
  setItem: async (key, value) => {
    await SecureStore.setItemAsync(key, value);
  },
  remove: async (keys) => {
    if (Array.isArray(keys)) {
      await Promise.all(keys.map((key) => SecureStore.deleteItemAsync(key)));
      return;
    }

    await SecureStore.deleteItemAsync(keys);
  },
};
