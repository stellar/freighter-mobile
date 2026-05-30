import { NETWORKS, STORAGE_KEYS } from "config/constants";
import { SearchTokenResponse } from "config/types";
import { cachedFetch } from "helpers/cachedFetch";
import { fetchTrendingAssets } from "services/stellarExpert";
import { create } from "zustand";

interface TrendingTokensState {
  /**
   * Returns the trending-assets response for a network. Uses a disk-backed
   * 30-min cache; fresh fetches happen only on first call per network or
   * after the TTL elapses (or when forceRefresh is true).
   */
  getTrendingTokens: (params: {
    network: NETWORKS;
    forceRefresh?: boolean;
  }) => Promise<SearchTokenResponse | null>;
}

/**
 * Cache TTL in milliseconds (30 minutes)
 */
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Trending Tokens Store
 *
 * Caches the stellar.expert trending-assets response per network using a
 * disk-backed 30-min TTL (via cachedFetch), mirroring the useVerifiedTokensStore
 * pattern. Repeat opens within the TTL window skip the ~200-800 ms HTTP call.
 *
 * @example
 * const response = await useTrendingTokensStore
 *   .getState()
 *   .getTrendingTokens({ network: NETWORKS.PUBLIC });
 */
export const useTrendingTokensStore = create<TrendingTokensState>()(() => ({
  getTrendingTokens: async ({ network, forceRefresh = false }) => {
    const storageKey = `${STORAGE_KEYS.TRENDING_TOKENS_PREFIX}${network}`;

    try {
      return await cachedFetch<SearchTokenResponse>({
        urlOrFn: async () => {
          const result = await fetchTrendingAssets({ network });
          if (!result) {
            // Throw so cachedFetch doesn't poison the cache with a null.
            // The hook's existing null-handling will run the fallback.
            throw new Error("Trending fetch returned null");
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
}));
