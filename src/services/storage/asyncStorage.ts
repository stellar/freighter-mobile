import AsyncStorage from "@react-native-async-storage/async-storage";
import { PersistentStorage } from "services/storage/storageFactory";

export const asyncStorage: PersistentStorage = {
  getItem: async (key) => {
    const value = await AsyncStorage.getItem(key);

    return value;
  },
  setItem: async (key, value) => {
    await AsyncStorage.setItem(key, value);
  },
  remove: async (keys) => {
    if (Array.isArray(keys)) {
      await AsyncStorage.multiRemove(keys);
      return;
    }

    await AsyncStorage.removeItem(keys);
  },
  clear: async () => {
    await AsyncStorage.clear();
  },
};
