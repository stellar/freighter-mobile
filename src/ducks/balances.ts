import { NETWORKS } from "config/constants";
import { BalanceMap, PricedBalanceMap, TokenPricesMap } from "config/types";
import { usePricesStore } from "ducks/prices";
import {
  getLPShareCode,
  isLiquidityPool,
  sortBalances,
} from "helpers/balances";
import { fetchBalances } from "services/backend";
import { create } from "zustand";

// Polling interval in milliseconds
const POLLING_INTERVAL = 30000;

// Keep track of the polling interval ID
let pollingIntervalId: NodeJS.Timeout | null = null;

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
 * @property {Function} startPolling - Function to start polling for balance updates
 * @property {Function} stopPolling - Function to stop polling for balance updates
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
  startPolling: (params: { publicKey: string; network: NETWORKS }) => void;
  stopPolling: () => void;
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
      displayName =
        balance.token.type === "native" ? "Stellar Lumens" : tokenCode;
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

  // Convert the entries array to an object and sort it
  return sortBalances(Object.fromEntries(entries));
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
        fiatTotal:
          priceData.currentPrice &&
          updatedPricedBalances[id].total.multipliedBy(priceData.currentPrice),
      };
    }
  });

  // Sort the updated priced balances
  return sortBalances(updatedPricedBalances);
};

/**
 * Fetches and processes priced balances with a timeout for price fetching
 */
const fetchPricedBalances = async (
  set: (state: Partial<BalancesState>) => void,
  balances: BalanceMap,
  statePricedBalances: PricedBalanceMap,
  params: { publicKey: string; network: NETWORKS },
): Promise<PricedBalanceMap> => {
  // Initialize pricedBalances with basic balance data
  const existingPricedBalances = getExistingPricedBalances(
    balances,
    statePricedBalances,
  );

  const { fetchPricesForBalances } = usePricesStore.getState();

  // Fetch updated prices for the balances using the prices store
  const priceFetchPromise = fetchPricesForBalances({
    balances,
    publicKey: params.publicKey,
    network: params.network,
  });

  // Wait a maximum of 3 seconds for prices to be fetched
  try {
    await Promise.race([
      priceFetchPromise,
      new Promise((_, reject) =>
        // eslint-disable-next-line no-promise-executor-return
        setTimeout(() => reject(new Error("Price fetch timeout")), 3000),
      ),
    ]);
  } catch (error) {
    // If price fetch times out, set existing data and continue fetching
    set({ pricedBalances: existingPricedBalances, isLoading: false });
  }

  // Make sure to wait until the prices finishes fetching
  await priceFetchPromise;

  // Get the updated prices from the store
  const { prices, error: pricesError } = usePricesStore.getState();

  if (pricesError || !prices || Object.keys(prices).length === 0) {
    // Return existing data in case of price fetch error
    return existingPricedBalances;
  }

  // Update pricedBalances with price data from the prices store
  return getUpdatedPricedBalances(existingPricedBalances, prices);
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

      // Set the "raw" balances right away as they don't depend on prices
      set({ balances });

      // Get existing state priced balances to preserve price data
      const statePricedBalances = get().pricedBalances;

      // Fetch and process priced balances
      const pricedBalances = await fetchPricedBalances(
        set,
        balances,
        statePricedBalances,
        params,
      );

      set({
        pricedBalances,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch balances",
        isLoading: false,
      });
    }
  },
  startPolling: (params) => {
    // Clear any existing polling
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
    }

    // Start polling after initial interval
    pollingIntervalId = setInterval(() => {
      get().fetchAccountBalances(params);
    }, POLLING_INTERVAL);
  },
  stopPolling: () => {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;
    }
  },
}));
