import { Asset } from "@stellar/stellar-sdk";
import {
  Balance,
  LiquidityPoolBalance,
  NativeToken,
  AssetToken,
  TokenIdentifier,
  Issuer,
  TokenPrice,
  TokenPricesMap,
} from "config/types";

/**
 * Gets the human-readable share code for a liquidity pool balance
 *
 * This function extracts the asset codes from both reserves in a liquidity pool
 * and formats them as a readable string (e.g., "XLM / USDC"). It handles the case
 * where one or both assets might be the native XLM asset.
 *
 * @param {Balance} balance - The balance object to extract share code from
 * @returns {string} Formatted share code string (e.g., "XLM / USDC") or empty string if not applicable
 *
 * @example
 * // Get share code for a liquidity pool balance
 * const lpShareCode = getLPShareCode(lpBalance); // Returns "XLM / USDC"
 */
export const getLPShareCode = (balance: Balance) => {
  const reserves = "reserves" in balance ? balance.reserves : [];
  if (!reserves[0] || !reserves[1]) {
    return "";
  }

  let assetA = reserves[0].asset.split(":")[0];
  let assetB = reserves[1].asset.split(":")[0];

  if (assetA === Asset.native().toString()) {
    assetA = Asset.native().code;
  }
  if (assetB === Asset.native().toString()) {
    assetB = Asset.native().code;
  }

  return `${assetA} / ${assetB}`;
};

/**
 * Determines if a balance object represents a liquidity pool
 *
 * This is a type guard function that checks if a balance object has the
 * required properties to be considered a liquidity pool balance.
 *
 * @param {Balance} balance - The balance object to check
 * @returns {boolean} True if the balance is a liquidity pool, false otherwise
 *
 * @example
 * // Check if a balance is a liquidity pool
 * if (isLiquidityPool(balance)) {
 *   // It's a liquidity pool, access LP-specific properties
 *   console.log(balance.liquidityPoolId);
 * } else {
 *   // It's a regular asset balance
 *   console.log(balance.token.code);
 * }
 */
export const isLiquidityPool = (
  balance: Balance,
): balance is LiquidityPoolBalance =>
  "liquidityPoolId" in balance && "reserves" in balance;

/**
 * Gets a standardized token identifier from either a Balance or Token object
 *
 * This function creates a consistent string identifier for tokens that can be used
 * as keys in maps or for comparison. For native XLM it returns "XLM", and for
 * other assets it returns a format like "CODE:ISSUER_KEY".
 *
 * @param {Balance | NativeToken | AssetToken} item - Balance object or a Token object
 * @returns {TokenIdentifier | null} Standardized token identifier string or null if not applicable
 *
 * @example
 * // Get identifier from balance
 * const xlmBalanceId = getTokenIdentifier(nativeBalance); // "XLM"
 *
 * // Get identifier from token
 * const tokenId = getTokenIdentifier(balance.token); // "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
 */
export const getTokenIdentifier = (
  item: Balance | NativeToken | AssetToken,
): TokenIdentifier | null => {
  // Handle liquidity pools - they don't have token identifiers
  if (isLiquidityPool(item as Balance)) {
    return null;
  }

  let token;

  if ("token" in item) {
    token = item.token;
  } else {
    token = item;
  }

  // Native token
  if ("type" in token && token.type === "native") {
    return "XLM";
  }

  // Asset token with issuer
  if ("code" in token && "issuer" in token) {
    return `${token.code}:${(token.issuer as Issuer).key}`;
  }

  // Fallback for unknown types
  return null;
};

/**
 * Extracts unique token identifiers from a collection of balances
 *
 * This function processes a map of balance objects and extracts a unique
 * list of token identifiers that can be used for price lookups or other operations.
 * It filters out nulls and duplicates from the result.
 *
 * @param {Record<string, Balance>} balances - Record of balance identifiers to Balance objects
 * @returns {TokenIdentifier[]} Array of unique token identifiers for price lookup
 *
 * @example
 * // Get token identifiers from account balances
 * const { balances } = useBalances();
 * const tokenIds = getTokenIdentifiersFromBalances(balances);
 * // tokenIds might be ["XLM", "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"]
 */
export const getTokenIdentifiersFromBalances = (
  balances: Record<string, Balance>,
): TokenIdentifier[] => {
  const tokenIds: TokenIdentifier[] = [];

  Object.values(balances).forEach((balance) => {
    const identifier = getTokenIdentifier(balance);
    if (identifier) {
      tokenIds.push(identifier);
    }
  });

  // Remove duplicates
  return [...new Set(tokenIds)];
};

/**
 * Retrieves token price data for a given balance from the prices map
 *
 * This function looks up price data for a token by first converting the balance
 * to a token identifier, then retrieving the corresponding price data from the
 * prices map. It handles cases where the token might not exist in the prices map.
 *
 * @param {TokenPricesMap} prices - The prices map from usePrices()
 * @param {Balance} balance - Balance object to find the price for
 * @returns {TokenPrice | null} The price data or null if not found
 *
 * @example
 * // Get price using balance object
 * const { prices } = usePrices();
 * const { balances } = useBalances();
 * const nativeBalance = balances["native"];
 * const xlmPrice = getTokenPriceFromBalance(prices, nativeBalance);
 *
 * // Use the price data
 * if (xlmPrice) {
 *   console.log(`XLM price: $${xlmPrice.currentPrice.toString()}`);
 *   console.log(`24h change: ${xlmPrice.percentagePriceChange24h.toString()}%`);
 * }
 */
export const getTokenPriceFromBalance = (
  prices: TokenPricesMap,
  balance: Balance,
): TokenPrice | null => {
  const tokenId = getTokenIdentifier(balance);
  if (!tokenId) {
    return null; // Liquidity pools or unknown token types
  }

  const priceData = prices[tokenId];
  if (!priceData) {
    return null; // Token not found in prices map
  }

  return priceData;
};
