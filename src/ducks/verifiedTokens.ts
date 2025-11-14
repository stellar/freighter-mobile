import AsyncStorage from "@react-native-async-storage/async-storage";
import { NETWORKS } from "config/constants";
import {
  TOKEN_LISTS_API_SERVICES,
  fetchVerifiedTokens,
} from "services/verified-token-lists";
import { TokenListReponseItem } from "services/verified-token-lists/types";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * State and actions for managing verified tokens cache
 */
interface VerifiedTokensState {
  /**
   * Cached verified tokens by network
   */
  verifiedTokensByNetwork: Record<NETWORKS, TokenListReponseItem[]>;
  /**
   * Timestamp of last fetch by network
   */
  lastFetchedByNetwork: Record<NETWORKS, number | null>;
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
 * Cache TTL in milliseconds (24 hours)
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Verified Tokens Store
 *
 * Manages and caches verified tokens from token lists using Zustand with persistence.
 *
 * Features:
 * - Caches verified tokens to avoid unnecessary API calls
 * - Persists cache across sessions using AsyncStorage
 * - Refreshes cache after 24 hours
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
export const useVerifiedTokensStore = create<VerifiedTokensState>()(
  persist(
    (set, get) => ({
      verifiedTokensByNetwork: {
        [NETWORKS.PUBLIC]: [],
        [NETWORKS.TESTNET]: [],
        [NETWORKS.FUTURENET]: [],
      },
      lastFetchedByNetwork: {
        [NETWORKS.PUBLIC]: null,
        [NETWORKS.TESTNET]: null,
        [NETWORKS.FUTURENET]: null,
      },
      getVerifiedTokens: async ({ network, forceRefresh = false }) => {
        const state = get();
        const cachedTokens = state.verifiedTokensByNetwork[network];
        const lastFetched = state.lastFetchedByNetwork[network];
        const now = Date.now();

        // Return cached tokens if they exist, are fresh, and not forcing refresh
        if (
          !forceRefresh &&
          cachedTokens.length > 0 &&
          lastFetched !== null &&
          now - lastFetched < CACHE_TTL_MS
        ) {
          return cachedTokens;
        }

        // Fetch fresh tokens
        const verifiedTokens = await fetchVerifiedTokens({
          tokenListsApiServices: TOKEN_LISTS_API_SERVICES,
          network,
        });

        // Update cache
        set((currentState) => ({
          verifiedTokensByNetwork: {
            ...currentState.verifiedTokensByNetwork,
            [network]: verifiedTokens,
          },
          lastFetchedByNetwork: {
            ...currentState.lastFetchedByNetwork,
            [network]: now,
          },
        }));

        return verifiedTokens;
      },
    }),
    {
      name: "verified-tokens-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
