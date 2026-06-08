import { NETWORKS } from "config/constants";
import { Balance, TokenIdentifier, TokenPricesMap } from "config/types";
import { getTokenIdentifiersFromBalances } from "helpers/balances";
import { fetchTokenPrices } from "services/backend";
import { create } from "zustand";

interface PricesState {
  prices: TokenPricesMap;
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
    /** Refetch even tokens already in the map (e.g. pull-to-refresh). */
    forceRefresh?: boolean;
  }) => Promise<void>;
}

export const usePricesStore = create<PricesState>((set, get) => ({
  prices: {},
  isLoading: false,
  error: null,
  lastUpdated: null,
  /** Fetch prices for tokens present in the user's balances. */
  fetchPricesForBalances: async ({ balances }) => {
    try {
      set({ isLoading: true, error: null });

      const tokens = getTokenIdentifiersFromBalances(balances);

      if (tokens.length === 0) {
        set({
          isLoading: false,
          lastUpdated: Date.now(),
        });
        return;
      }

      const response = await fetchTokenPrices({ tokens });

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
  fetchPricesForTokenIds: async ({ tokens, forceRefresh = false }) => {
    try {
      if (!tokens || tokens.length === 0) return;
      // Skip tokens already loaded to avoid duplicate requests — unless the
      // caller forces a refresh (e.g. pull-to-refresh), since otherwise a
      // price fetched once would never update for the rest of the session.
      const existing = get().prices;
      const toFetch = forceRefresh
        ? tokens
        : tokens.filter((t) => !existing[t]);
      if (toFetch.length === 0) return;

      const response = await fetchTokenPrices({ tokens: toFetch });
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
