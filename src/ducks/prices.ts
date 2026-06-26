import { NETWORKS } from "config/constants";
import { Balance, TokenIdentifier, TokenPricesMap } from "config/types";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { getTokenIdentifiersFromBalances } from "helpers/balances";
import { fetchTokenPrices } from "services/backend";
import { create } from "zustand";

interface PricesState {
  prices: TokenPricesMap;
  /**
   * Network the cached `prices` were fetched for. v2 is network-scoped, so
   * prices from a different network are stale and must not be reused — when a
   * fetch arrives for a different network the cache is dropped and refetched.
   */
  pricesNetwork: NETWORKS | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  fetchPricesForBalances: (params: {
    balances: Record<string, Balance>;
    publicKey: string;
    network: NETWORKS;
  }) => Promise<void>;
  /** Fetch prices for arbitrary token identifiers (e.g., from Blockaid diffs) */
  fetchPricesForTokenIds: (params: {
    tokens: TokenIdentifier[];
    /** Active network — required by the network-scoped v2 prices endpoint. */
    network: NETWORKS;
    /** Refetch even tokens already in the map (e.g. pull-to-refresh). */
    forceRefresh?: boolean;
  }) => Promise<void>;
}

export const usePricesStore = create<PricesState>((set, get) => ({
  prices: {},
  pricesNetwork: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
  /** Fetch prices for tokens present in the user's balances. */
  fetchPricesForBalances: async ({ balances, network }) => {
    try {
      set({ isLoading: true, error: null });

      // Drop prices cached for a different network before doing anything —
      // they're stale for the network-scoped v2 endpoint. This also resets the
      // dedupe baseline so the subsequent fetch re-queries every token.
      if (get().pricesNetwork !== network) {
        set({ prices: {}, pricesNetwork: network });
      }

      const tokens = getTokenIdentifiersFromBalances(balances);

      if (tokens.length === 0) {
        set({
          isLoading: false,
          lastUpdated: Date.now(),
        });
        return;
      }

      const useV2 = useRemoteConfigStore.getState().use_token_prices_v2;
      const response = await fetchTokenPrices({ tokens, network, useV2 });

      // Merge instead of replacing — otherwise prices populated by
      // fetchPricesForTokenIds for non-held tokens get wiped every time
      // balances refresh.
      set({
        prices: { ...get().prices, ...response },
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      // Preserve existing prices data in case of error
      const currentPrices = get().prices;

      set({
        prices: currentPrices,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch token prices",
        isLoading: false,
      });
    }
  },
  /** Lightweight fetch for arbitrary tokens */
  fetchPricesForTokenIds: async ({ tokens, network, forceRefresh = false }) => {
    try {
      if (!tokens || tokens.length === 0) return;

      // Drop prices cached for a different network — they're stale for the
      // network-scoped v2 endpoint. Clearing also empties the dedupe baseline
      // below, so every requested token is refetched for the new network.
      if (get().pricesNetwork !== network) {
        set({ prices: {}, pricesNetwork: network });
      }

      // Skip tokens already loaded to avoid duplicate requests — unless the
      // caller forces a refresh (e.g. pull-to-refresh), since otherwise a
      // price fetched once would never update for the rest of the session.
      const existing = get().prices;
      const toFetch = forceRefresh
        ? tokens
        : tokens.filter((t) => !existing[t]);
      if (toFetch.length === 0) return;

      const useV2 = useRemoteConfigStore.getState().use_token_prices_v2;
      const response = await fetchTokenPrices({
        tokens: toFetch,
        network,
        useV2,
      });
      set({
        prices: { ...get().prices, ...response },
        lastUpdated: Date.now(),
      });
    } catch (error) {
      // Silently keep existing prices on error
      set({ lastUpdated: Date.now() });
    }
  },
}));
