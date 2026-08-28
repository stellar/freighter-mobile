import {
  AUTO_LOCK_TIMER,
  DEFAULT_AUTO_LOCK_TIMER,
  HASH_KEY_EXPIRATION_MS,
  HASH_KEY_REFRESH_THROTTLE_MS,
  SENSITIVE_STORAGE_KEYS,
} from "config/constants";
import { HashKey } from "config/types";
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
 * Checks if a hash key is expired.
 *
 * Clock-rollback backstop: a key whose generatedAt is in the future means the
 * device clock was moved backward below the key's creation time — a rolled-back
 * clock would otherwise keep `now <= expiresAt` true indefinitely and prevent
 * the hard-expiry from ever forcing a full re-auth. Treat that as expired
 * (mirrors getBackgroundedAt's future-timestamp guard for the soft timer).
 * generatedAt is optional so keys persisted before this field fall back to the
 * plain expiry check.
 */
const isHashKeyExpired = (hashKey: HashKey): boolean => {
  const now = Date.now();
  if (hashKey.generatedAt !== undefined && hashKey.generatedAt > now) {
    return true;
  }
  return now > hashKey.expiresAt;
};

// Last time a re-anchor write was attempted (module-level, process-lifetime).
// The generatedAt throttle below only advances when the write SUCCEEDS; if
// the keychain write fails persistently, generatedAt never moves and every
// 5s auth tick would retry (and log) forever. Throttling attempts bounds
// that failure mode to one attempt per throttle window. In-memory on
// purpose: a process restart retrying immediately is fine.
let lastRefreshAttemptAt = 0;

/**
 * Resets the module-level attempt throttle (tests only — module state would
 * otherwise leak across cases in the same file).
 */
const resetHashKeyRefreshAttemptThrottle = (): void => {
  lastRefreshAttemptAt = 0;
};

/**
 * Re-anchors the hash-key hard-expiry on use (#924): pushes expiresAt out to
 * a full HASH_KEY_EXPIRATION_MS from now, so the backstop bounds *inactivity*
 * rather than time since the last credential entry.
 *
 * Guards (defense in depth — the getAuthStatus call site is also gated):
 * - An expired or rolled-back key is never refreshed; only signIn's
 *   credential-verified path may re-stamp those.
 * - The write is throttled: a key anchored within HASH_KEY_REFRESH_THROTTLE_MS
 *   is left alone, so the 5s foreground auth tick doesn't hammer the keychain.
 *   A legacy key without generatedAt can't prove it was recently anchored, so
 *   it refreshes immediately (gaining generatedAt, after which the throttle
 *   applies).
 * - Refresh *attempts* are throttled too (lastRefreshAttemptAt): the
 *   generatedAt throttle only advances on a successful write, so a
 *   persistently failing keychain would otherwise be retried (and logged)
 *   on every 5s auth tick.
 *
 * Takes the caller-validated HashKey snapshot to run the guards and throttle
 * (every caller has just loaded it for the expiry checks), then re-reads the
 * stored key once at write time for the TOCTOU check below.
 */
const refreshHashKeyExpiration = async (hashKey: HashKey): Promise<void> => {
  if (isHashKeyExpired(hashKey)) {
    return;
  }

  const now = Date.now();
  if (
    hashKey.generatedAt !== undefined &&
    now - hashKey.generatedAt < HASH_KEY_REFRESH_THROTTLE_MS
  ) {
    return;
  }

  // A backward clock change strands the attempt marker in the future, and
  // the check below would then suppress every re-anchor until wall time
  // caught back up — for a >71h rollback, long enough to hard-expire even
  // the fresh key the forced re-auth just minted, despite continued use.
  // Mirror this module's other future-timestamp guards: a future marker is
  // invalid, reset it.
  if (lastRefreshAttemptAt > now) {
    lastRefreshAttemptAt = 0;
  }
  if (now - lastRefreshAttemptAt < HASH_KEY_REFRESH_THROTTLE_MS) {
    return;
  }
  // Set before the write so a throwing write still counts as an attempt.
  lastRefreshAttemptAt = now;

  // TOCTOU guard: the caller validated this key several awaits ago; a logout
  // or corruption wipe (clearTemporaryData) may have removed or replaced it
  // since. Re-stamp only the exact key that was validated — never resurrect
  // a wiped key, never clobber a concurrent credential-verified re-stamp.
  // The remaining window is the single await between this read and the write
  // (same bound as getActiveMnemonicPhrase's re-check pattern in auth.ts).
  const currentHashKey = await getHashKey();
  if (
    !currentHashKey ||
    currentHashKey.hashKey !== hashKey.hashKey ||
    currentHashKey.salt !== hashKey.salt ||
    currentHashKey.expiresAt !== hashKey.expiresAt ||
    currentHashKey.generatedAt !== hashKey.generatedAt
  ) {
    return;
  }

  await secureDataStorage.setItem(
    SENSITIVE_STORAGE_KEYS.HASH_KEY,
    JSON.stringify({
      // Spread the re-read key, not the caller's snapshot: the comparison
      // above proves they are identical today, but if HashKey ever gains a
      // field the explicit check stops covering it and spreading the stale
      // snapshot would silently revert it.
      ...currentHashKey,
      expiresAt: now + HASH_KEY_EXPIRATION_MS,
      generatedAt: now,
    } satisfies HashKey),
  );
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
  recordBackgroundedAt,
  getBackgroundedAt,
  clearBackgroundedAt,
  isHashKeyExpired,
  refreshHashKeyExpiration,
  resetHashKeyRefreshAttemptThrottle,
  hasPersistedSession,
};
