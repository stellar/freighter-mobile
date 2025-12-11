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
 * Clears all non-sensitive data except network preference, custom token list, and collectibles list
 */
const clearNonSensitiveData = async (): Promise<void> => {
  const keysToClear = Object.values(STORAGE_KEYS).filter(
    (key) =>
      ![
        STORAGE_KEYS.ACTIVE_NETWORK,
        STORAGE_KEYS.CUSTOM_TOKEN_LIST,
        STORAGE_KEYS.COLLECTIBLES_LIST,
        STORAGE_KEYS.HAS_SEEN_BIOMETRICS_ENABLE_SCREEN,
      ].includes(key),
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

/**
 * Refreshes the hash key expiration time
 */
const refreshHashKeyExpiration = async (
  expirationMs: number,
): Promise<void> => {
  const hashKey = await getHashKey();
  if (!hashKey) {
    return;
  }

  const updatedHashKey: HashKey = {
    ...hashKey,
    expiresAt: Date.now() + expirationMs,
  };

  await secureDataStorage.setItem(
    SENSITIVE_STORAGE_KEYS.HASH_KEY,
    JSON.stringify(updatedHashKey),
  );
};

export {
  clearTemporaryData,
  clearNonSensitiveData,
  getHashKey,
  refreshHashKeyExpiration,
};
