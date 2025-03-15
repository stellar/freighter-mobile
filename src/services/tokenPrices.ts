import BigNumber from "bignumber.js";
import { TOKEN_PRICES_URL } from "config/constants";
import { bigize } from "helpers/bigize";
import { createApiService } from "services/apiFactory";

// Create a dedicated API service for token prices
export const tokenPricesApi = createApiService({
  baseURL: TOKEN_PRICES_URL,
});

/**
 * Token identifier string format:
 * - "XLM" for native tokens
 * - "CODE:ISSUER" for other assets (e.g., "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN")
 */
export type TokenIdentifier = string;

/**
 * Price data for a single token
 */
export interface TokenPrice {
  /** Current USD price of the token */
  currentPrice: BigNumber | null;
  /** 24-hour percentage change in price (null if unavailable) */
  percentagePriceChange24h: BigNumber | null;
}

/**
 * Map of token identifiers to their price information
 */
export interface TokenPricesMap {
  [tokenIdentifier: TokenIdentifier]: TokenPrice;
}

/**
 * Response from the token prices API
 */
interface TokenPricesResponse {
  data: TokenPricesMap;
}

/**
 * Request parameters for fetching token prices
 */
export interface FetchTokenPricesParams {
  /** Array of token identifiers to fetch prices for */
  tokens: TokenIdentifier[];
}

/**
 * Simulates fetching the current USD prices and 24h percentage changes for the specified tokens
 *
 * Note: This is a fake implementation that returns random data after a 1-second delay
 *
 * @param params Object containing the list of tokens to fetch prices for
 * @returns Promise resolving to a map of token identifiers to their price information
 *
 * @example
 * // Fetch prices for XLM and USDC
 * const prices = await fetchTokenPrices({
 *   tokens: [
 *     "XLM",
 *     "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
 *   ]
 * });
 *
 * // Access individual token prices
 * const xlmPrice = prices["XLM"];
 * console.log(`XLM price: $${xlmPrice.currentPrice} (${xlmPrice.percentagePriceChange24h}% 24h change)`);
 */
export const fetchTokenPrices = async ({
  tokens,
}: FetchTokenPricesParams): Promise<TokenPricesResponse> => {
  // TODO: uncomment this once the endpoint is deployed
  // const { data } = await tokenPricesApi.post<TokenPricesResponse>(
  //   "", // Empty string because we're using the base URL
  //   { tokens },
  // );

  // Simulate network delay (1 second as requested)
  // eslint-disable-next-line no-promise-executor-return
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // This is the backend interface for the prices map
  // We'll convert those values to BigNumber for convenience
  const pricesMap: {
    [tokenIdentifier: TokenIdentifier]: {
      currentPrice: string | null;
      percentagePriceChange24h: number | null;
    };
  } = {};

  // Generate fake price data for each token
  tokens.forEach((token) => {
    // Special case for stablecoin
    if (token.includes("USD")) {
      pricesMap[token] = {
        currentPrice: (0.99 + Math.random() * 0.02).toFixed(6), // Between 0.99 and 1.01
        percentagePriceChange24h: Math.random() * 0.2 - 0.1, // Between -0.1% and +0.1%
      };
    } else {
      pricesMap[token] = {
        currentPrice: (0.001 + Math.random() * 99.999).toFixed(6), // Random number between 0.001 and 100,
        percentagePriceChange24h: Math.random() * 10 - 5, // Random number between -5 and 5
      };
    }
  });

  // Create fake API response structure
  const fakeResponse = {
    data: pricesMap,
  };

  // Make sure to convert the response values to BigNumber for convenience
  return bigize(fakeResponse, [
    "currentPrice",
    "percentagePriceChange24h",
  ]) as TokenPricesResponse;
};
