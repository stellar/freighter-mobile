import { NETWORKS, STORAGE_KEYS } from "config/constants";
import { SearchTokenResponse } from "config/types";
import { cachedFetch, readCachedValue } from "helpers/cachedFetch";
import { fetchTrendingAssets } from "services/stellarExpert";
import { create } from "zustand";

interface StellarExpertTopTokensState {
  /**
   * Returns the stellar.expert top-tokens response for a network. Uses a
   * disk-backed 30-min cache; fresh fetches happen only on first call per
   * network or after the TTL elapses (or when forceRefresh is true).
   */
  getStellarExpertTopTokens: (params: {
    network: NETWORKS;
    forceRefresh?: boolean;
  }) => Promise<SearchTokenResponse | null>;
  /**
   * Read the disk cache for a network without triggering a fetch.
   * Returns the cached payload + its age in ms, or null when the
   * cache is empty/malformed. Used by Swap's SWR pipeline to render
   * preliminary content before kicking a background refresh.
   */
  readCache: (
    network: NETWORKS,
  ) => Promise<{ data: SearchTokenResponse; age: number } | null>;
}

/**
 * Cache TTL in milliseconds (30 minutes)
 */
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Stellar.expert Top Tokens Store
 *
 * Caches the stellar.expert top-tokens response (sorted by 7-day volume) per
 * network using a disk-backed 30-min TTL (via cachedFetch), mirroring the
 * useVerifiedTokensStore pattern. Repeat opens within the TTL window skip the
 * ~200-800 ms HTTP call.
 *
 * @example
 * const response = await useStellarExpertTopTokensStore
 *   .getState()
 *   .getStellarExpertTopTokens({ network: NETWORKS.PUBLIC });
 */
export const useStellarExpertTopTokensStore =
  create<StellarExpertTopTokensState>()(() => ({
    getStellarExpertTopTokens: async ({ network, forceRefresh = false }) => {
      const storageKey = `${STORAGE_KEYS.STELLAR_EXPERT_TOP_TOKENS_PREFIX}${network}`;

      try {
        return await cachedFetch<SearchTokenResponse>({
          urlOrFn: async () => {
            const result = await fetchTrendingAssets({ network });
            if (!result) {
              // Throw so cachedFetch doesn't poison the cache with a null.
              // The hook's existing null-handling will run the fallback.
              throw new Error("stellar.expert top-tokens fetch returned null");
            }
            return result;
          },
          storageKey,
          ttlMs: CACHE_TTL_MS,
          forceRefresh,
        });
      } catch {
        // Network/parse error and no cache → null so the hook flips to
        // stellarExpertDown=true via its existing fallback path.
        return null;
      }
    },
    readCache: async (network) => {
      const storageKey = `${STORAGE_KEYS.STELLAR_EXPERT_TOP_TOKENS_PREFIX}${network}`;
      return readCachedValue<SearchTokenResponse>(storageKey);
    },
  }));
