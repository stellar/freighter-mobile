import { SENSITIVE_STORAGE_KEYS, STORAGE_KEYS } from "config/constants";
import { HashKey } from "config/types";
import {
  dataStorage,
  secureDataStorage,
} from "services/storage/storageFactory";

// Monotonic counter bumped at the START of every clearTemporaryData wipe.
// Lets an in-flight opportunistic writer (the hash-key re-anchor in
// services/autoLock) detect that a wipe began after it validated storage and
// refuse its write, instead of racing the wipe's removes and re-creating
// just-wiped key material. JS is single-threaded, so a bump is visible to any
// check that runs after the wipe starts; a write dispatched before the bump
// has its removes land after it, so either ordering ends with the key absent.
let wipeGeneration = 0;

/**
 * Current wipe generation — see wipeGeneration above. Capture before an
 * optimistic read-validate-write sequence and compare (synchronously, with no
 * await in between) right before the write.
 */
const getWipeGeneration = (): number => wipeGeneration;

/**
 * Clears the hash key, temporary store, and derived key cache from secure storage.
 *
 * Deliberately does NOT touch the screenshot DEK: this also runs on non-wipe
 * paths (signUp/importWallet via clearAllData, and the repeated-decryption-failure
 * guard in getTemporaryStore) where browser tabs, cookies, and screenshot files
 * all survive. The DEK is independent of wallet key material and is cleared on
 * the logout-wipe path alongside clearAllWebViewData.
 */
const clearTemporaryData = async (): Promise<void> => {
  wipeGeneration += 1;
  await Promise.all([
    secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.HASH_KEY),
    secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE),
    secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.DERIVED_KEY),
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

export {
  clearTemporaryData,
  clearNonSensitiveData,
  getHashKey,
  getWipeGeneration,
};
