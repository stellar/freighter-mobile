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
 * Returns the persisted backgrounded-at timestamp, or null when the app
 * hasn't gone to the background since the last evaluation. Corrupt
 * (non-numeric) and future-dated values are cleaned up and treated as
 * absent — a future timestamp would otherwise stall the timer.
 */
const getBackgroundedAt = async (): Promise<number | null> => {
  const backgroundedAt = await secureDataStorage.getItem(
    SENSITIVE_STORAGE_KEYS.AUTO_LOCK_BACKGROUNDED_AT,
  );

  if (!backgroundedAt) {
    return null;
  }

  const parsedBackgroundedAt = Number(backgroundedAt);
  if (Number.isNaN(parsedBackgroundedAt) || parsedBackgroundedAt > Date.now()) {
    await clearBackgroundedAt();
    return null;
  }

  return parsedBackgroundedAt;
};

/* ===========================================================================
 * TODO / FIXME: TEMPORARY DEV-ONLY AUTO-LOCK TESTING OVERRIDES.
 * !!! REMOVE THIS ENTIRE BLOCK (and its UI on AutoLockTimerScreen + the
 * getDevAutoLockTimerMs usage in ducks/auth.ts) BEFORE MERGING TO PRODUCTION.
 * It lets QA set the auto-lock timer and hash-key TTL in seconds so the lock
 * flows can be exercised in seconds instead of minutes/hours.
 * ===========================================================================
 */
const DEV_AUTO_LOCK_TIMER_MS_KEY = "devAutoLockTimerMs";

/** TEMP/REMOVE: dev override for the auto-lock timer, in ms (null if unset). */
const getDevAutoLockTimerMs = async (): Promise<number | null> => {
  const raw = await secureDataStorage.getItem(DEV_AUTO_LOCK_TIMER_MS_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

/** TEMP/REMOVE: set the dev auto-lock timer override from a seconds value. */
const setDevAutoLockTimerSeconds = async (seconds: number): Promise<void> => {
  await secureDataStorage.setItem(
    DEV_AUTO_LOCK_TIMER_MS_KEY,
    String(Math.round(seconds * 1000)),
  );
};

/** TEMP/REMOVE: clear the dev auto-lock timer override (back to the enum). */
const clearDevAutoLockTimer = async (): Promise<void> => {
  await secureDataStorage.remove(DEV_AUTO_LOCK_TIMER_MS_KEY);
};

/**
 * TEMP/REMOVE: force the current hash key to expire in `seconds` by rewriting
 * its expiresAt, so the hard-expiry (HASH_KEY_EXPIRED) backstop can be tested
 * quickly. One-shot: the next unlock re-anchors the TTL to the normal value.
 */
const setDevHashKeyTtlSeconds = async (seconds: number): Promise<void> => {
  const hashKey = await getHashKey();
  if (!hashKey) {
    return;
  }
  await secureDataStorage.setItem(
    SENSITIVE_STORAGE_KEYS.HASH_KEY,
    JSON.stringify({
      ...hashKey,
      expiresAt: Date.now() + Math.round(seconds * 1000),
    }),
  );
};
/* ====================== END TEMPORARY DEV-ONLY BLOCK ====================== */

export {
  getAutoLockTimer,
  persistAutoLockTimer,
  getHashKeyExpirationMs,
  applyAutoLockTimerToHashKey,
  recordBackgroundedAt,
  getBackgroundedAt,
  clearBackgroundedAt,
  // TODO/FIXME: remove these dev-only exports before production
  getDevAutoLockTimerMs,
  setDevAutoLockTimerSeconds,
  clearDevAutoLockTimer,
  setDevHashKeyTtlSeconds,
};
