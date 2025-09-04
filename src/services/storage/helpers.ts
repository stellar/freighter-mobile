import { SENSITIVE_STORAGE_KEYS, STORAGE_KEYS } from "config/constants";
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
  ]);
};

/**
 * Clears all non-sensitive data except network preference
 */
const clearNonSensitiveData = async (): Promise<void> => {
  const keysToClear = Object.values(STORAGE_KEYS).filter(
    (key) =>
      key !== STORAGE_KEYS.ACTIVE_NETWORK &&
      key !== STORAGE_KEYS.HAS_SEEN_FACE_ID_ONBOARDING,
  );

  await Promise.all(keysToClear.map((key) => dataStorage.remove(key)));
};

/**
 * Get the hash key from secure storage
 */
const getHashKey = async (): Promise<HashKey | null> => {
  const hashKey = await secureDataStorage.getItem(
    SENSITIVE_STORAGE_KEYS.HASH_KEY,
  );

  return hashKey ? (JSON.parse(hashKey) as HashKey) : null;
};

export { clearTemporaryData, clearNonSensitiveData, getHashKey };
