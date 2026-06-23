import { NETWORKS, STORAGE_KEYS } from "config/constants";
import { cachedFetch, readCachedValue } from "helpers/cachedFetch";
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
  /** Fetches verified tokens for a network, using cache if available and fresh. */
  getVerifiedTokens: (params: {
    network: NETWORKS;
    forceRefresh?: boolean;
  }) => Promise<TokenListReponseItem[]>;
  /**
   * Read the disk cache for a network without triggering a fetch.
   * Returns the cached payload + its age in ms, or null when the
   * cache is empty/malformed.
   */
  readCache: (
    network: NETWORKS,
  ) => Promise<{ data: TokenListReponseItem[]; age: number } | null>;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Manages and caches verified tokens from token lists. Shares the
 * cachedFetch store so tokenIcons and verifiedTokens hit the same cache.
 */
export const useVerifiedTokensStore = create<VerifiedTokensState>()(() => ({
  getVerifiedTokens: async ({ network, forceRefresh = false }) => {
    const storageKey = `${STORAGE_KEYS.VERIFIED_TOKENS_PREFIX}${network}`;

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
  readCache: async (network) => {
    const storageKey = `${STORAGE_KEYS.VERIFIED_TOKENS_PREFIX}${network}`;
    return readCachedValue<TokenListReponseItem[]>(storageKey);
  },
}));
