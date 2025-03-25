import { NETWORKS } from "config/constants";
import { BalanceMap, PricedBalanceMap, TokenPricesMap } from "config/types";
import { usePricesStore } from "ducks/prices";
import { getLPShareCode, isLiquidityPool } from "helpers/balances";
import { debug } from "helpers/debug";
import { fetchBalances } from "services/backend";
import { create } from "zustand";

/**
 * Balances State Interface
 *
 * Defines the structure of the balances state store using Zustand.
 * This store manages account balances for a given public key and network,
 * along with loading and error states, and methods to fetch the balances.
 *
 * @interface BalancesState
 * @property {BalanceMap} balances - Object mapping balance IDs to Balance objects
 * @property {PricedBalanceMap} pricedBalances - Object mapping balance IDs to PricedBalance objects
 * @property {boolean} isLoading - Indicates if balance data is currently being fetched
 * @property {string | null} error - Error message if fetch failed, null otherwise
 * @property {Function} fetchAccountBalances - Function to fetch account balances from the backend
 */
interface BalancesState {
  balances: BalanceMap;
  pricedBalances: PricedBalanceMap;
  isLoading: boolean;
  error: string | null;
  fetchAccountBalances: (params: {
    publicKey: string;
    network: NETWORKS;
    contractIds?: string[];
  }) => Promise<void>;
}

/**
 * Processes balances and creates priced balances with display information
 *
 * @param balances - The raw balances from the API
 * @param statePricedBalances - Current priced balances to preserve price data
 * @returns A map of priced balances with display information
 */
const getExistingPricedBalances = (
  balances: BalanceMap,
  statePricedBalances: PricedBalanceMap,
): PricedBalanceMap => {
  // Create entries by mapping over balances
  const entries = Object.entries(balances).map(([id, balance]) => {
    // Get existing price data for this balance if available
    const existingPriceData = statePricedBalances[id];

    // Determine the asset code based on balance type
    let tokenCode: string;
    let displayName: string;

    if (isLiquidityPool(balance)) {
      // Handle liquidity pool balances
      tokenCode = getLPShareCode(balance);
      displayName = tokenCode;
    } else {
      // Handle regular asset balances
      tokenCode = balance.token.code;
      displayName = tokenCode; // TODO: We can fetch it from TOML or Soroban Token props
    }

    // Create the priced balance object and keep existing price data if available
    const pricedBalance = {
      ...balance,
      tokenCode,
      displayName,
      // Preserve existing price data if available
      currentPrice: existingPriceData?.currentPrice,
      percentagePriceChange24h: existingPriceData?.percentagePriceChange24h,
      fiatCode: existingPriceData?.fiatCode,
      fiatTotal: existingPriceData?.fiatTotal,
    };

    // Return entry as [id, pricedBalance] tuple
    return [id, pricedBalance] as [string, typeof pricedBalance];
  });

  // Convert the entries array to an object
  return Object.fromEntries(entries) as PricedBalanceMap;
};

/**
 * Updates priced balances with new price data from the prices store
 *
 * @param existingPricedBalances - Current priced balances to update
 * @param prices - New price data from the prices store
 * @returns Updated priced balances with new price data
 */
const getUpdatedPricedBalances = (
  existingPricedBalances: PricedBalanceMap,
  prices: TokenPricesMap,
): PricedBalanceMap => {
  const updatedPricedBalances: PricedBalanceMap = { ...existingPricedBalances };

  Object.entries(prices).forEach(([id, priceData]) => {
    if (updatedPricedBalances[id]) {
      updatedPricedBalances[id] = {
        ...updatedPricedBalances[id],
        ...priceData,
        fiatCode: "USD",
        fiatTotal: updatedPricedBalances[id].total.multipliedBy(
          priceData.currentPrice || 0,
        ),
      };
    }
  });

  return updatedPricedBalances;
};

/**
 * Balances Store
 *
 * A Zustand store that manages the state of account balances in the application.
 * Handles fetching, storing, and error states for token balances.
 */
export const useBalancesStore = create<BalancesState>((set, get) => ({
  balances: {} as BalanceMap,
  pricedBalances: {} as PricedBalanceMap,
  isLoading: false,
  error: null,
  fetchAccountBalances: async (params) => {
    try {
      set({ isLoading: true, error: null });

      // Fetch balances
      const { balances } = await fetchBalances(params);

      if (!balances) {
        throw new Error("No balances returned from API");
      }

      // Get existing state priced balances to preserve price data
      const statePricedBalances = get().pricedBalances;

      // Initialize pricedBalances with basic balance data
      const existingPricedBalances = getExistingPricedBalances(
        balances,
        statePricedBalances,
      );

      // Set the balances and pricedBalances in the store right away so we can display the balances immediately
      set({
        balances,
        pricedBalances: existingPricedBalances,
        isLoading: false,
      });

      const { fetchPricesForBalances } = usePricesStore.getState();

      // Fetch updated prices for the balances using the prices store
      await fetchPricesForBalances({
        balances,
        publicKey: params.publicKey,
        network: params.network,
      });

      // Get the updated prices from the store
      const { prices, error: pricesError } = usePricesStore.getState();

      if (pricesError || !prices || Object.keys(prices).length === 0) {
        // Log price fetch error but don't fail the whole operation
        debug(
          "BalancesStore",
          "Failed to fetch prices. Error:",
          pricesError,
          " Prices:",
          prices,
        );
        return;
      }

      // Update pricedBalances with price data from the prices store
      const updatedPricedBalances = getUpdatedPricedBalances(
        existingPricedBalances,
        prices,
      );

      set({ pricedBalances: updatedPricedBalances });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch balances",
        isLoading: false,
      });
    }
  },
}));
