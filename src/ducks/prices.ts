import BigNumber from "bignumber.js";
import { NETWORKS } from "config/constants";
import { isLiquidityPool } from "helpers/isLiquidityPool";
import { Balance } from "services/backend";
import {
  TokenPricesMap,
  TokenIdentifier,
  fetchTokenPrices,
} from "services/tokenPrices";
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

/**
 * Extract token identifiers from balances
 *
 * @param balances Record of balance identifiers to Balance objects
 * @returns Array of token identifiers for price lookup
 */
export const getTokenIdentifiersFromBalances = (
  balances: Record<string, Balance>,
): TokenIdentifier[] => {
  const tokenIds: TokenIdentifier[] = [];

  Object.values(balances).forEach((balance) => {
    // Skip liquidity pools as they don't have direct prices
    if (isLiquidityPool(balance)) {
      return;
    }

    // Handle native tokens
    if (balance.token.type === "native") {
      tokenIds.push("XLM");
      return;
    }

    // Handle other tokens
    if ("issuer" in balance.token) {
      tokenIds.push(`${balance.token.code}:${balance.token.issuer.key}`);
    }
  });

  // Remove duplicates
  return [...new Set(tokenIds)];
};

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

/**
 * Get token price from the prices map
 *
 * @param prices The prices map from usePrices()
 * @param token Token identifier or Balance object
 * @returns The price data or null if not found
 *
 * @example
 * // Get price using token identifier
 * const { prices } = usePrices();
 * const xlmPrice = getTokenPrice(prices, "XLM");
 *
 * @example
 * // Get price using balance object
 * const { prices } = usePrices();
 * const { balances } = useBalances();
 * const nativeBalance = balances["native"];
 * const xlmPrice = getTokenPrice(prices, nativeBalance);
 */
export const getTokenPrice = (
  prices: TokenPricesMap,
  token: TokenIdentifier | Balance,
): {
  currentPrice: BigNumber | null;
  percentagePriceChange24h: BigNumber | null;
} | null => {
  let tokenId: TokenIdentifier;

  // If token is a string, use it directly
  if (typeof token === "string") {
    tokenId = token;
  }
  // If token is a Balance object, extract the token identifier
  else {
    if (isLiquidityPool(token)) {
      return null; // Liquidity pools don't have direct prices
    }

    if (token.token.type === "native") {
      tokenId = "XLM";
    } else if ("issuer" in token.token) {
      tokenId = `${token.token.code}:${token.token.issuer.key}`;
    } else {
      return null; // Unknown token type
    }
  }

  return prices[tokenId] || null;
};
