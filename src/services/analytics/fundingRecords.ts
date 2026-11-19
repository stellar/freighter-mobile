import { NETWORKS, STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { DEBUG_CONFIG } from "services/analytics/constants";
import { dataStorage } from "services/storage/storageFactory";

/**
 * Client-side funding state for one own account on one network.
 *
 * The key holds the network and the `account_id_hash`, never the G address.
 */
export interface FundingRecord {
  /**
   * Event state. Only results from the active-account fetch change it.
   * - not set: no active-account result yet
   * - unfunded: the last active-account result was unfunded
   * - pending: a transition to funded occurred, but consent dropped the event
   * - funded: the last active-account result was funded, and nothing is left
   *   to report
   */
  status?: "unfunded" | "pending" | "funded";
  /**
   * Last known funded state from any source (the active-account fetch or the
   * all-accounts fetch). Feeds `funded_account_count`.
   */
  funded?: boolean;
}

const getStorageKey = (network: NETWORKS, accountIdHash: string): string =>
  `${STORAGE_KEYS.ACCOUNT_FUNDING_RECORD_PREFIX}${network}:${accountIdHash}`;

/**
 * In-memory copy of `funded` for the PUBLIC records, keyed by
 * `account_id_hash`. `syncIdentifyTraits` is synchronous and reads it to
 * compute `funded_account_count`. A key that is present was loaded from
 * storage (its value can be undefined). A key that is absent was not loaded.
 */
const publicFundedCache = new Map<string, boolean | undefined>();

/** Promise chains per storage key, so one read-modify-write runs at a time. */
const recordLocks = new Map<string, Promise<unknown>>();

const parseRecord = (raw: string | null): FundingRecord | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as FundingRecord;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const cacheFunded = (
  network: NETWORKS,
  accountIdHash: string,
  record: FundingRecord | null,
) => {
  if (network === NETWORKS.PUBLIC) {
    publicFundedCache.set(accountIdHash, record?.funded);
  }
};

/**
 * Reads one funding record from AsyncStorage.
 *
 * @returns The record, or null when there is none or it cannot be read
 */
export const loadFundingRecord = async (
  network: NETWORKS,
  accountIdHash: string,
): Promise<FundingRecord | null> => {
  const record = parseRecord(
    await dataStorage.getItem(getStorageKey(network, accountIdHash)),
  );
  cacheFunded(network, accountIdHash, record);
  return record;
};

/** Writes one funding record to AsyncStorage and updates the cache. */
export const saveFundingRecord = async (
  network: NETWORKS,
  accountIdHash: string,
  record: FundingRecord,
): Promise<void> => {
  await dataStorage.setItem(
    getStorageKey(network, accountIdHash),
    JSON.stringify(record),
  );
  cacheFunded(network, accountIdHash, record);
};

/**
 * Runs `task` after every earlier task for the same record has finished.
 * AsyncStorage is asynchronous, so without this lock two parallel updates
 * could both read the old status and both emit the event.
 */
export const withFundingRecordLock = <T>(
  network: NETWORKS,
  accountIdHash: string,
  task: () => Promise<T>,
): Promise<T> => {
  const key = getStorageKey(network, accountIdHash);
  const previous = recordLocks.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  const settled = next.catch(() => undefined);

  recordLocks.set(key, settled);
  settled.then(() => {
    if (recordLocks.get(key) === settled) {
      recordLocks.delete(key);
    }
  });

  return next;
};

/**
 * Returns the number of the given accounts whose PUBLIC record has
 * `funded: true`. An account without a `funded` value counts as not funded.
 *
 * @returns The count, or null when a record is not loaded yet. Then the
 *   caller must not send a value, because it could be too low.
 */
export const getFundedAccountCount = (
  accountIdHashes: string[],
): number | null => {
  if (accountIdHashes.some((hash) => !publicFundedCache.has(hash))) {
    return null;
  }

  return accountIdHashes.filter((hash) => publicFundedCache.get(hash) === true)
    .length;
};

/**
 * Loads the PUBLIC records of the given accounts that are not in the cache.
 *
 * A record that cannot be read stays out of the cache, so the count stays
 * unknown and no low count is sent. A later sync tries the read again.
 *
 * @returns True when it loaded at least one record
 */
export const loadPublicFundedStates = async (
  accountIdHashes: string[],
): Promise<boolean> => {
  const missing = accountIdHashes.filter(
    (hash) => !publicFundedCache.has(hash),
  );

  if (missing.length === 0) return false;

  const results = await Promise.all(
    missing.map(async (hash) => {
      try {
        // Read under the record lock. Then a read that starts before an
        // update cannot finish after it and put the older value in the cache.
        await withFundingRecordLock(NETWORKS.PUBLIC, hash, () =>
          loadFundingRecord(NETWORKS.PUBLIC, hash),
        );
        return true;
      } catch (error) {
        logger.warn(
          DEBUG_CONFIG.LOG_PREFIX,
          "Failed to read an account funding record",
          { error },
        );
        return false;
      }
    }),
  );

  return results.some(Boolean);
};

/** Clears the in-memory state. For tests only. */
export const resetFundingRecordsCacheForTests = (): void => {
  publicFundedCache.clear();
  recordLocks.clear();
};
