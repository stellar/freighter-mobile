/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/naming-convention */
import Blockaid from "@blockaid/client";
import { NETWORKS, STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { scanBulkTokens } from "services/blockaid/api";
import { dataStorage } from "services/storage/storageFactory";
import { create } from "zustand";

const CACHE_TTL_MS = 30 * 60 * 1000;

type SingleScan = Blockaid.Token.TokenScanResponse;
type CacheEntry = SingleScan & { _cachedAt: number };
type NetworkCache = Record<string, CacheEntry>;

interface BlockaidTokenScansState {
  /**
   * Bulk-scan tokens with per-token disk-backed caching (30-min TTL).
   *
   * For each addressId:
   *   - if a non-stale cache entry exists → use it
   *   - else add to the missing-list to scan
   * Then performs ONE scanBulkTokens call for the misses (if any), merges
   * with cached hits, and writes back the merged map.
   *
   * Returns a TokenBulkScanResponse-shaped object (just `.results`) so
   * existing consumers don't need to change.
   */
  scanBulkWithCache: (params: {
    addressList: string[];
    network: NETWORKS;
    forceRefresh?: boolean;
  }) => Promise<{ results: Record<string, SingleScan> }>;
  /**
   * Read the disk cache for the given address list without triggering
   * a Blockaid call. Returns fresh hits (per the 30-min TTL) plus the
   * list of addresses that are missing or stale.
   */
  readScansFor: (
    network: NETWORKS,
    addressList: string[],
  ) => Promise<{ hits: Record<string, SingleScan>; missing: string[] }>;
}

const readNetworkCache = async (network: NETWORKS): Promise<NetworkCache> => {
  const storageKey = `${STORAGE_KEYS.BLOCKAID_TOKEN_SCANS_PREFIX}${network}`;
  const raw = await dataStorage.getItem(storageKey);
  if (typeof raw !== "string") return {};
  try {
    return JSON.parse(raw) as NetworkCache;
  } catch (e) {
    logger.error("blockaidTokenScans", "JSON parse error", e);
    return {};
  }
};

const writeNetworkCache = async (
  network: NETWORKS,
  cache: NetworkCache,
): Promise<void> => {
  const storageKey = `${STORAGE_KEYS.BLOCKAID_TOKEN_SCANS_PREFIX}${network}`;
  await dataStorage.setItem(storageKey, JSON.stringify(cache));
};

const isFresh = (entry: CacheEntry, now: number): boolean =>
  now - entry._cachedAt < CACHE_TTL_MS;

/**
 * Blockaid Token Scans Store
 *
 * Per-token disk-backed cache for Blockaid bulk scan results.
 * Each token's scan is stored individually (keyed by address ID within a
 * per-network map) with a per-entry 30-min TTL.
 *
 * Partial-hit-aware: only the tokens missing from cache (or stale) trigger
 * a network call. The result merges cache hits + fresh scans.
 *
 * @example
 * const bulkScan = await useBlockaidTokenScansStore
 *   .getState()
 *   .scanBulkWithCache({ addressList, network });
 */
export const useBlockaidTokenScansStore = create<BlockaidTokenScansState>()(
  () => ({
    scanBulkWithCache: async ({
      addressList,
      network,
      forceRefresh = false,
    }) => {
      const now = Date.now();
      const cache = forceRefresh ? {} : await readNetworkCache(network);

      const hits: Record<string, SingleScan> = {};
      const missing: string[] = [];
      addressList.forEach((id) => {
        const entry = cache[id];
        if (entry && isFresh(entry, now)) {
          const { _cachedAt, ...scan } = entry;
          hits[id] = scan;
        } else {
          missing.push(id);
        }
      });

      if (missing.length === 0) {
        return { results: hits };
      }

      let freshScans: { results: Record<string, SingleScan> } = {
        results: {},
      };
      try {
        freshScans = await scanBulkTokens({ addressList: missing, network });
      } catch (e) {
        // Service down (e.g., testnet) — return what we have from cache.
        // The hook's existing assessTokenSecurity handles undefined entries
        // as UNABLE_TO_SCAN.
        logger.error("blockaidTokenScans", "scanBulkTokens failed", e);
        return { results: hits };
      }

      // Merge fresh into cache with current timestamp
      const updatedCache: NetworkCache = { ...cache };
      missing.forEach((id) => {
        const scan = freshScans.results[id];
        if (scan) {
          updatedCache[id] = { ...scan, _cachedAt: now };
        }
      });
      await writeNetworkCache(network, updatedCache);

      return {
        results: {
          ...hits,
          ...freshScans.results,
        },
      };
    },
    readScansFor: async (network, addressList) => {
      const now = Date.now();
      const cache = await readNetworkCache(network);
      const hits: Record<string, SingleScan> = {};
      const missing: string[] = [];
      addressList.forEach((id) => {
        const entry = cache[id];
        if (entry && isFresh(entry, now)) {
          const { _cachedAt, ...scan } = entry;
          hits[id] = scan;
        } else {
          missing.push(id);
        }
      });
      return { hits, missing };
    },
  }),
);
