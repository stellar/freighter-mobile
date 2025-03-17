import BigNumber from "bignumber.js";
import {
  Balance,
  LiquidityPoolBalance,
  NativeToken,
  AssetToken,
  Issuer,
} from "services/backend";
import { TokenIdentifier, TokenPricesMap } from "services/tokenPrices";

/**
 * Check if balance is a liquidity pool
 */
export const isLiquidityPool = (
  balance: Balance,
): balance is LiquidityPoolBalance =>
  "liquidityPoolId" in balance && "reserves" in balance;

/**
 * Get a standardized token identifier from either a Balance or Token object
 *
 * @param item Balance object or a Token object
 * @returns Standardized token identifier string or null if not applicable
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
    const identifier = getTokenIdentifier(balance);
    if (identifier) {
      tokenIds.push(identifier);
    }
  });

  // Remove duplicates
  return [...new Set(tokenIds)];
};

/**
 * Get token price from the prices map
 *
 * @param prices The prices map from usePrices()
 * @param balance Balance object
 * @returns The price data or null if not found
 *
 * @example
 * // Get price using balance object
 * const { prices } = usePrices();
 * const { balances } = useBalances();
 * const nativeBalance = balances["native"];
 * const xlmPrice = getTokenPriceFromBalance(prices, nativeBalance);
 */
export const getTokenPriceFromBalance = (
  prices: TokenPricesMap,
  balance: Balance,
): {
  currentPrice: BigNumber | null;
  percentagePriceChange24h: BigNumber | null;
} | null => {
  const tokenId = getTokenIdentifier(balance);

  if (!tokenId) {
    return null; // Liquidity pools or unknown token types
  }

  return prices[tokenId] || null;
};
