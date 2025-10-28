import Blockaid from "@blockaid/client";
import { NATIVE_TOKEN_CODE, NETWORKS, STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import {
  BalanceMap,
  CustomTokenStorage,
  PricedBalanceMap,
  TokenPricesMap,
} from "config/types";
import { usePricesStore } from "ducks/prices";
import {
  getLPShareCode,
  isLiquidityPool,
  sortBalances,
} from "helpers/balances";
import { isMainnet } from "helpers/networks";
import { fetchBalances } from "services/backend";
import { dataStorage } from "services/storage/storageFactory";
import { create } from "zustand";

// Keep track of the polling interval ID

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
 * @property {boolean} isFunded - Whether the account is funded
 * @property {number} subentryCount - The number of subentries for the account
 * @property {string | null} error - Error message if fetch failed, null otherwise
 * @property {Function} fetchAccountBalances - Function to fetch account balances from the backend
 */
interface BalancesState {
  balances: BalanceMap;
  pricedBalances: PricedBalanceMap;
  scanResults: Blockaid.TokenBulk.TokenBulkScanResponse["results"];
  isLoading: boolean;
  isFunded: boolean;
  subentryCount: number;
  error: string | null;
  fetchAccountBalances: (params: {
    publicKey: string;
    network: NETWORKS;
    contractIds?: string[];
  }) => Promise<void>;
  getBalances: () => BalanceMap;
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

    // Determine the token code based on balance type
    let tokenCode: string;
    let displayName: string;

    if (isLiquidityPool(balance) || !("token" in balance)) {
      // Handle liquidity pool balances
      tokenCode = getLPShareCode(balance);
      displayName = tokenCode;
    } else {
      // Handle regular token balances
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
  return sortBalances(Object.fromEntries(entries) as PricedBalanceMap);
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
 * Extracts scan results from balances returned by the backend
 * Backend already performs Blockaid scans and includes blockaidData in each balance
 *
 * @param balances The balances with blockaidData from backend
 * @param network The current network
 * @returns An object with scan results extracted from balance blockaidData
 */
const extractScanResultsFromBalances = (
  balances: BalanceMap,
  network: NETWORKS,
) => {
  if (!isMainnet(network)) {
    return Promise.resolve({
      results: {} as Record<
        string,
        Blockaid.TokenBulk.TokenBulkScanResponse.Results
      >,
      error: null,
    });
  }

  const scanResults: Record<string, Blockaid.Token.TokenScanResponse> = {};

  Object.entries(balances).forEach(([tokenIdentifier, balance]) => {
    if (
      tokenIdentifier === NATIVE_TOKEN_CODE ||
      tokenIdentifier.includes("lp")
    ) {
      return;
    }

    const blockaidData =
      "blockaidData" in balance
        ? (balance as { blockaidData?: Blockaid.Token.TokenScanResponse })
            .blockaidData
        : undefined;
    if (blockaidData) {
      const scanKey = tokenIdentifier.includes(":")
        ? tokenIdentifier.replace(":", "-")
        : tokenIdentifier;
      scanResults[scanKey] = blockaidData;
    }
  });

  return { results: scanResults, error: null };
};

/**
 * Retrieves custom tokens from local storage
 *
 * @param params The network and publicKey to retrieve tokens for
 * @returns An array of custom token contract IDs for the specified network and publicKey
 */
const retrieveCustomTokens = async (params: {
  network: NETWORKS;
  publicKey: string;
}): Promise<string[]> => {
  const { network, publicKey } = params;

  try {
    const customTokenList = await dataStorage.getItem(
      STORAGE_KEYS.CUSTOM_TOKEN_LIST,
    );

    if (!customTokenList) {
      return [];
    }

    const storage = JSON.parse(customTokenList) as CustomTokenStorage;

    // Check if user has tokens for this public key and network
    if (!storage[publicKey] || !storage[publicKey][network]) {
      return [];
    }

    // Map tokens to contract IDs
    return storage[publicKey][network].map((token) => token.contractId);
  } catch (error) {
    // Log error but don't break the flow - return empty array instead
    logger.error(
      "retrieveCustomTokens",
      "Error retrieving custom tokens:",
      error,
    );

    return [];
  }
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
  scanResults: {} as Blockaid.TokenBulk.TokenBulkScanResponse["results"],
  isLoading: false,
  isFunded: false,
  subentryCount: 0,
  error: null,
  fetchAccountBalances: async (params) => {
    try {
      // It can happen that the public key is not available yet during app initialization
      // In this case, we should early return and wait for the public key to be available
      // to prevent UI glitches due to balances fetching error
      if (!params.publicKey) return;

      set({ isLoading: true, error: null });

      const customTokensContractsIds = await retrieveCustomTokens({
        network: params.network,
        publicKey: params.publicKey,
      });

      // Combine provided contract IDs with custom token contract IDs
      const allContractIds = [
        ...(params.contractIds || []),
        ...customTokensContractsIds,
      ];

      // Fetch balances with combined contract IDs
      const { balances, isFunded, subentryCount } = await fetchBalances({
        ...params,
        contractIds: allContractIds,
      });

      if (!balances) {
        throw new Error("No balances returned from API");
      }

      set({
        balances,
        isFunded: isFunded ?? false,
        subentryCount: subentryCount ?? 0,
      });

      const statePricedBalances = get().pricedBalances;
      const [pricedBalances, scanResult] = await Promise.all([
        fetchPricedBalances(set, balances, statePricedBalances, params),
        Promise.resolve(
          extractScanResultsFromBalances(balances, params.network),
        ),
      ]);

      // Update scan results in state
      set((state) => ({
        scanResults: {
          ...state.scanResults,
          ...scanResult.results,
        },
      }));

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
  getBalances: () => get().balances,
}));
