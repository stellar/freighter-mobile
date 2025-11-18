import { NETWORKS } from "config/constants";
import { cachedFetch } from "helpers/cachedFetch";
import {
  TOKEN_LISTS_API_SERVICES,
  fetchVerifiedTokens,
} from "services/verified-token-lists";
import { TokenListReponseItem } from "services/verified-token-lists/types";
import { create } from "zustand";

/**
 * State and actions for managing verified tokens cache
 */
interface VerifiedTokensState {
  /**
   * Fetches verified tokens for a network, using cache if available and fresh
   * @param {Object} params - Function parameters
   * @param {NETWORKS} params.network - The network to fetch from
   * @param {boolean} params.forceRefresh - Force refresh even if cache is fresh (default: false)
   * @returns {Promise<TokenListReponseItem[]>} The verified tokens list
   */
  getVerifiedTokens: (params: {
    network: NETWORKS;
    forceRefresh?: boolean;
  }) => Promise<TokenListReponseItem[]>;
}

/**
 * Cache TTL in milliseconds (30 minutes)
 */
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Verified Tokens Store
 *
 * Manages and caches verified tokens from token lists using cachedFetch for shared caching.
 *
 * Features:
 * - Caches verified tokens to avoid unnecessary API calls
 * - Uses shared cache mechanism (cachedFetch) so tokenIcons and verifiedTokens use the same cache
 * - Refreshes cache after 30 minutes
 * - Can force refresh when needed
 *
 * @example
 * // Get verified tokens (uses cache if available)
 * const { getVerifiedTokens } = useVerifiedTokensStore();
 * const tokens = await getVerifiedTokens({ network: NETWORKS.PUBLIC });
 *
 * // Force refresh
 * const freshTokens = await getVerifiedTokens({
 *   network: NETWORKS.PUBLIC,
 *   forceRefresh: true
 * });
 */
export const useVerifiedTokensStore = create<VerifiedTokensState>()(() => ({
  getVerifiedTokens: async ({ network, forceRefresh = false }) => {
    const storageKey = `verifiedTokens_${network}`;

    return cachedFetch<TokenListReponseItem[]>({
      urlOrFn: () =>
        fetchVerifiedTokens({
          tokenListsApiServices: TOKEN_LISTS_API_SERVICES,
          network,
        }),
      storageKey,
      ttlMs: CACHE_TTL_MS,
      forceRefresh,
    });
  },
}));
