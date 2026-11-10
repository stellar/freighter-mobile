import { SENSITIVE_STORAGE_KEYS, STORAGE_KEYS } from "config/constants";
import { HashKey } from "config/types";
import {
  dataStorage,
  secureDataStorage,
} from "services/storage/storageFactory";

// Monotonic counter bumped synchronously at the START of every mutation of
// the stored hash key that the opportunistic re-anchor (services/autoLock)
// must yield to: a clearTemporaryData wipe or a credential-verified write via
// setHashKey. Lets a re-anchor in flight detect that storage moved after its
// caller loaded the key and refuse its write, instead of racing the mutation
// and re-creating just-wiped material or writing the old key back under a
// temporary store already re-encrypted with a new one. JS is single-threaded,
// so a bump is visible to any check that runs after the mutation starts. A
// re-anchor write dispatched before the bump is outside this check and relies
// on native keychain ordering (serial on iOS, not guaranteed on Android).
let hashKeyGeneration = 0;

/**
 * Current hash-key generation — see hashKeyGeneration above. Capture BEFORE
 * loading the key for an optimistic read-validate-write sequence and compare
 * (synchronously, with no await in between) right before the write.
 */
const getHashKeyGeneration = (): number => hashKeyGeneration;

/**
 * Persists a credential-verified hash key (sign-in, sign-up, import). Every
 * such write must come through here so the generation bump above happens
 * before the write is dispatched; the re-anchor is the only writer that may
 * bypass it, because it is the one checking the generation.
 */
const setHashKey = async (hashKey: HashKey): Promise<void> => {
  hashKeyGeneration += 1;
  await secureDataStorage.setItem(
    SENSITIVE_STORAGE_KEYS.HASH_KEY,
    JSON.stringify(hashKey),
  );
};

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
  hashKeyGeneration += 1;
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
        // Decided once at first launch; clearing it would re-evaluate a
        // fresh install as an existing user.
        STORAGE_KEYS.REBRAND_ANNOUNCEMENT_STATUS,
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
  getHashKeyGeneration,
  setHashKey,
};
