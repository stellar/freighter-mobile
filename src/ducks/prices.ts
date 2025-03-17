import { NETWORKS } from "config/constants";
import { Balance, TokenPricesMap } from "config/types";
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
}

export const usePricesStore = create<PricesState>((set) => ({
  prices: {},
  isLoading: false,
  error: null,
  lastUpdated: null,
  fetchPricesForBalances: async ({ balances }) => {
    try {
      set({ isLoading: true, error: null });

      // Get token identifiers from balances
      const tokens = getTokenIdentifiersFromBalances(balances);

      if (tokens.length === 0) {
        set({
          isLoading: false,
          lastUpdated: Date.now(),
        });
        return;
      }

      // Fetch prices for these tokens
      const response = await fetchTokenPrices({ tokens });

      set({
        prices: response.data,
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch token prices",
        isLoading: false,
      });
    }
  },
}));

// Helper hooks and selectors
export const usePrices = () => {
  const { prices, isLoading, error, lastUpdated } = usePricesStore();
  return { prices, isLoading, error, lastUpdated };
};

export const usePricesFetcher = () => {
  const { fetchPricesForBalances } = usePricesStore();
  return { fetchPricesForBalances };
};
