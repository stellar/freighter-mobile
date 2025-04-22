import { Asset, StrKey } from "@stellar/stellar-sdk";
import { BigNumber } from "bignumber.js";
import {
  Balance,
  LiquidityPoolBalance,
  NativeToken,
  AssetToken,
  TokenIdentifier,
  TokenPrice,
  TokenPricesMap,
  PricedBalanceMap,
  PricedBalance,
  AssetTypeWithCustomToken,
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
 * Gets a unique identifier for a token or balance
 *
 * This function generates a consistent identifier string that can be used
 * to look up prices or other data for a token. It handles both Balance objects
 * and raw Token objects.
 *
 * For native XLM tokens, returns "XLM"
 * For other assets, returns "CODE:ISSUER_KEY"
 * For liquidity pools or unknown types, returns empty string
 *
 * @param {Balance | NativeToken | AssetToken} item - The balance or token to identify
 * @returns {TokenIdentifier} The token identifier string or empty string for liquidity pools/unknown types
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
): TokenIdentifier => {
  // Handle liquidity pools - they don't have token identifiers
  if (isLiquidityPool(item as Balance)) {
    return "";
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
    return `${token.code}:${token.issuer.key}`;
  }

  // Fallback for unknown types
  return "";
};

/**
 * Extracts unique token identifiers from a collection of balances
 *
 * This function processes a map of balance objects and extracts a unique
 * list of token identifiers that can be used for price lookups or other operations.
 * It filters out empty strings and duplicates from the result.
 *
 * @param {Record<string, Balance>} balances - Record of balance identifiers to Balance objects
 * @returns {TokenIdentifier[]} Array of unique token identifiers for price lookup
 *
 * @example
 * // Get token identifiers from account balances
 * const { balances } = useBalancesStore();
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
 * @param {TokenPricesMap} prices - The prices map from usePricesStore()
 * @param {Balance} balance - Balance object to find the price for
 * @returns {TokenPrice | null} The price data or null if not found
 *
 * @example
 * // Get price using balance object
 * const { prices } = usePricesStore();
 * const { balances } = useBalancesStore();
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

/**
 * Sorts a map of balances according to specific rules:
 * 1. Regular balances are sorted by fiatTotal in descending order
 * 2. Liquidity pool balances are sorted by total amount in descending order
 * 3. LP balances are always at the bottom
 *
 * @param {PricedBalanceMap} balances - Map of balances to sort
 * @returns {PricedBalanceMap} Sorted map of balances
 */
export const sortBalances = (balances: PricedBalanceMap): PricedBalanceMap => {
  // Convert to array of entries and separate into regular and LP balances
  const entries = Object.entries(balances);
  const [regularBalances, lpBalances] = entries.reduce<
    [Array<[string, PricedBalance]>, Array<[string, PricedBalance]>]
  >(
    ([regular, lp], [id, balance]) => {
      if (isLiquidityPool(balance)) {
        return [regular, [...lp, [id, balance]]];
      }
      return [[...regular, [id, balance]], lp];
    },
    [[], []],
  );

  // Sort regular balances by fiatTotal
  regularBalances.sort(([, a], [, b]) => {
    const fiatTotalA = a.fiatTotal || new BigNumber(0);
    const fiatTotalB = b.fiatTotal || new BigNumber(0);
    return fiatTotalB.minus(fiatTotalA).toNumber();
  });

  // Sort LP balances by total amount
  lpBalances.sort(([, a], [, b]) => {
    const totalA = a.total || new BigNumber(0);
    const totalB = b.total || new BigNumber(0);
    return totalB.minus(totalA).toNumber();
  });

  // Combine sorted regular balances with sorted LP balances at the bottom
  const sortedEntries = [...regularBalances, ...lpBalances];

  // Convert back to object
  return Object.fromEntries(sortedEntries);
};

export const formatAssetIdentifier = (assetIdentifier: string) => {
  const formattedAssetIdentifier = assetIdentifier.split(":");

  if (formattedAssetIdentifier.length === 1) {
    return {
      assetCode: formattedAssetIdentifier[0],
      issuer: "",
    };
  }

  return {
    assetCode: formattedAssetIdentifier[0],
    issuer: formattedAssetIdentifier[1],
  };
};

/**
 * Determines the asset type based on the asset identifier
 *
 * This function takes an asset identifier (e.g., "XLM", "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN")
 * and returns the corresponding asset type from the Stellar SDK.
 *
 * @param {string} assetIdentifier - The asset identifier to determine the type of
 * @returns {AssetType} The corresponding asset type from the Stellar SDK
 *
 * @example
 * // Get asset type for an asset identifier
 * const assetType = getAssetType("USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
 * // assetType will be "credit_alphanum4"
 */
export const getAssetType = (
  assetIdentifier: string,
): AssetTypeWithCustomToken => {
  if (assetIdentifier === "XLM") {
    return "native";
  }

  if (assetIdentifier.includes(":")) {
    const { assetCode, issuer } = formatAssetIdentifier(assetIdentifier);

    if (issuer.startsWith("C")) {
      return "custom_token";
    }

    if (assetCode.length <= 4) {
      return "credit_alphanum4";
    }

    if (assetCode.length >= 5 && assetCode.length <= 12) {
      return "credit_alphanum12";
    }
  }

  return "liquidity_pool_shares";
};

export const isPublicKeyValid = (publicKey: string) =>
  StrKey.isValidEd25519PublicKey(publicKey);
