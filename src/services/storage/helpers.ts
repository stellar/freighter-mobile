import { SENSITIVE_STORAGE_KEYS, STORAGE_KEYS } from "config/constants";
import {
  dataStorage,
  secureDataStorage,
} from "services/storage/storageFactory";

/**
 * Clears the hash key and temporary store
 */
const clearTemporaryData = async (): Promise<void> => {
  await Promise.all([
    secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.HASH_KEY),
    secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE),
    dataStorage.remove(STORAGE_KEYS.HASH_KEY_TIMESTAMP),
  ]);
};

export { clearTemporaryData };
