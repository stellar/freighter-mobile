import { NETWORKS } from "config/constants";
import { Balance, TokenPricesMap } from "config/types";
import { getTokenIdentifiersFromBalances } from "helpers/balances";
import { fetchTokenPrices } from "services/backend";
import { create } from "zustand";

/**
 * Prices State Interface
 *
 * Defines the structure of the token prices state store using Zustand.
 * This store manages price data for tokens, including current prices and
 * price changes, along with loading state, error state, and methods to
 * fetch price data based on account balances.
 *
 * @interface PricesState
 * @property {TokenPricesMap} prices - Mapping of token identifiers to price data
 * @property {boolean} isLoading - Indicates if price data is currently being fetched
 * @property {string | null} error - Error message if fetch failed, null otherwise
 * @property {number | null} lastUpdated - Timestamp of when prices were last updated
 * @property {Function} fetchPricesForBalances - Function to fetch prices for tokens in the balances
 */
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

/**
 * Prices Store
 *
 * A Zustand store that manages the state of token prices in the application.
 * Handles fetching, storing, and error states for price data of tokens
 * held in user balances.
 */
export const usePricesStore = create<PricesState>((set) => ({
  prices: {},
  isLoading: false,
  error: null,
  lastUpdated: null,
  /**
   * Fetches prices for tokens present in the user's balances
   *
   * @async
   * @param {Object} params - Parameters for fetching prices
   * @param {Record<string, Balance>} params.balances - Account balances to fetch prices for
   * @param {string} params.publicKey - The account's public key (used for analytics)
   * @param {NETWORKS} params.network - The network the balances are from (used for analytics)
   * @returns {Promise<void>} A promise that resolves when the operation completes
   */
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

/**
 * Use Prices Hook
 *
 * A selector hook that provides access to the current token prices, loading state,
 * error state, and the timestamp of when prices were last updated from the prices store.
 *
 * @returns {Object} The prices state object
 * @returns {TokenPricesMap} returns.prices - The token price data
 * @returns {boolean} returns.isLoading - Whether prices are currently being fetched
 * @returns {string | null} returns.error - Any error message, or null if no error
 * @returns {number | null} returns.lastUpdated - Timestamp of when prices were last updated
 */
export const usePrices = () => {
  const { prices, isLoading, error, lastUpdated } = usePricesStore();
  return { prices, isLoading, error, lastUpdated };
};

/**
 * Use Prices Fetcher Hook
 *
 * A selector hook that provides the function to fetch token prices.
 * This hook is separated from usePrices to allow components to trigger
 * price fetching without necessarily needing to consume the price state.
 *
 * @returns {Object} Object containing the fetch function
 * @returns {Function} returns.fetchPricesForBalances - Function to fetch prices for tokens in balances
 */
export const usePricesFetcher = () => {
  const { fetchPricesForBalances } = usePricesStore();
  return { fetchPricesForBalances };
};
