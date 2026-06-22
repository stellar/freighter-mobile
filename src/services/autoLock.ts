import {
  AUTO_LOCK_TIMER,
  DEFAULT_AUTO_LOCK_TIMER,
  HASH_KEY_EXPIRATION_MS,
  NEVER_EXPIRE_HASH_KEY_MS,
  SENSITIVE_STORAGE_KEYS,
} from "config/constants";
import { getHashKey } from "services/storage/helpers";
import { secureDataStorage } from "services/storage/storageFactory";

/**
 * Reads the persisted auto-lock timer preference.
 *
 * This is a secure-storage mirror of the zustand preferences store so that
 * non-React code (e.g. getAuthStatus on cold start) can read the value
 * without depending on zustand-persist rehydration timing — and so the
 * lock policy can't be weakened by editing unencrypted AsyncStorage.
 */
const getAutoLockTimer = async (): Promise<AUTO_LOCK_TIMER> => {
  const storedTimer = await secureDataStorage.getItem(
    SENSITIVE_STORAGE_KEYS.AUTO_LOCK_TIMER_SETTING,
  );

  if (
    storedTimer &&
    Object.values(AUTO_LOCK_TIMER).includes(storedTimer as AUTO_LOCK_TIMER)
  ) {
    return storedTimer as AUTO_LOCK_TIMER;
  }

  return DEFAULT_AUTO_LOCK_TIMER;
};

/**
 * Persists the auto-lock timer preference to the secure-storage mirror
 */
const persistAutoLockTimer = async (timer: AUTO_LOCK_TIMER): Promise<void> => {
  await secureDataStorage.setItem(
    SENSITIVE_STORAGE_KEYS.AUTO_LOCK_TIMER_SETTING,
    timer,
  );
};

/**
 * Returns the hash key TTL for the given auto-lock timer. With NONE the user
 * explicitly opted out of auto-lock, so the 24h hard-expiry backstop is
 * replaced by an effectively-never expiration.
 */
const getHashKeyExpirationMs = (timer: AUTO_LOCK_TIMER): number =>
  timer === AUTO_LOCK_TIMER.NONE
    ? NEVER_EXPIRE_HASH_KEY_MS
    : HASH_KEY_EXPIRATION_MS;

/**
 * Re-anchors the stored hash key expiration based on the given auto-lock
 * timer. Called when the user changes the timer so switching to/from NONE
 * takes effect immediately rather than on the next unlock. Only reachable
 * from an unlocked session (the settings screen), so this is a
 * credential-verified moment.
 */
const applyAutoLockTimerToHashKey = async (
  timer: AUTO_LOCK_TIMER,
): Promise<void> => {
  const hashKey = await getHashKey();

  if (!hashKey) {
    return;
  }

  await secureDataStorage.setItem(
    SENSITIVE_STORAGE_KEYS.HASH_KEY,
    JSON.stringify({
      ...hashKey,
      expiresAt: Date.now() + getHashKeyExpirationMs(timer),
    }),
  );
};

/**
 * Records the moment the app went to the background so the auto-lock timer
 * can be evaluated on the next foreground or cold start
 */
const recordBackgroundedAt = async (): Promise<void> => {
  await secureDataStorage.setItem(
    SENSITIVE_STORAGE_KEYS.AUTO_LOCK_BACKGROUNDED_AT,
    String(Date.now()),
  );
};

/**
 * Clears the persisted backgrounded-at timestamp
 */
const clearBackgroundedAt = async (): Promise<void> => {
  await secureDataStorage.remove(
    SENSITIVE_STORAGE_KEYS.AUTO_LOCK_BACKGROUNDED_AT,
  );
};

/**
 * Returns the persisted backgrounded-at timestamp, or null when none exists.
 * A corrupt (non-numeric) value is cleared and treated as absent. A
 * future-dated value (clock moved backward) returns 0 so any positive timer
 * elapses and the wallet locks, rather than trusting it to skip the lock.
 */
const getBackgroundedAt = async (): Promise<number | null> => {
  const backgroundedAt = await secureDataStorage.getItem(
    SENSITIVE_STORAGE_KEYS.AUTO_LOCK_BACKGROUNDED_AT,
  );

  if (!backgroundedAt) {
    return null;
  }

  const parsedBackgroundedAt = Number(backgroundedAt);

  if (Number.isNaN(parsedBackgroundedAt)) {
    await clearBackgroundedAt();
    return null;
  }

  if (parsedBackgroundedAt > Date.now()) {
    return 0;
  }

  return parsedBackgroundedAt;
};

/**
 * Whether an unlockable session is persisted on device (a hash key and a
 * temporary store both exist). Lets the background handler decide whether to
 * record/lock from disk state rather than the zustand auth status, which may
 * not be hydrated yet — a cold launch into an existing session can be
 * backgrounded before getAuthStatus runs.
 */
const hasPersistedSession = async (): Promise<boolean> => {
  const [hashKey, temporaryStore] = await Promise.all([
    getHashKey(),
    secureDataStorage.getItem(SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE),
  ]);

  return Boolean(hashKey && temporaryStore);
};

export {
  getAutoLockTimer,
  persistAutoLockTimer,
  getHashKeyExpirationMs,
  applyAutoLockTimerToHashKey,
  recordBackgroundedAt,
  getBackgroundedAt,
  clearBackgroundedAt,
  hasPersistedSession,
};
