import { SENSITIVE_STORAGE_KEYS, STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { HashKey } from "config/types";
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
    dataStorage.remove(STORAGE_KEYS.HASH_KEY_EXPIRE_AT),
  ]);
};

/**
 * Get the hash key and salt from secure storage
 */
const getHashKey = async () => {
  // Get the hash key and salt from secure storage
  const rawHashKey = await secureDataStorage.getItem(
    SENSITIVE_STORAGE_KEYS.HASH_KEY,
  );

  if (!rawHashKey) {
    logger.error("Hash key not found in secure storage");
    return null;
  }

  const { hashKey, salt } = JSON.parse(rawHashKey);

  return { hashKey, salt } as HashKey;
};

export { clearTemporaryData, getHashKey };
