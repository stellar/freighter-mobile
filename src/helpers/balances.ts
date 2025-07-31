import { Asset, StrKey } from "@stellar/stellar-sdk";
import { BigNumber } from "bignumber.js";
import {
  NATIVE_TOKEN_CODE,
  BASE_RESERVE,
  MIN_TRANSACTION_FEE,
} from "config/constants";
import {
  Balance,
  NativeToken,
  AssetToken,
  TokenIdentifier,
  TokenPrice,
  TokenPricesMap,
  PricedBalanceMap,
  PricedBalance,
  AssetTypeWithCustomToken,
  Token,
} from "config/types";

interface GetTokenPriceFromBalanceParams {
  prices: TokenPricesMap;
  balance: Balance;
}

interface CalculateSpendableAmountParams {
  balance: Balance;
  subentryCount?: number;
  transactionFee?: string;
}

interface IsAmountSpendableParams {
  amount: string;
  balance: Balance;
  subentryCount?: number;
  transactionFee?: string;
}

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
 * Determines if a balance or token object represents a liquidity pool
 *
 * This is a type guard function that checks if a balance or token object has the
 * required properties to be considered a liquidity pool. It handles both Balance objects
 * and raw Token objects.
 *
 * For Balance objects, it checks for the presence of `liquidityPoolId` and `reserves` properties.
 * For Token objects, it checks if the type is `LIQUIDITY_POOL_SHARES`.
 *
 * @param {Balance | Token} balanceOrToken - The balance or token object to check
 * @returns {boolean} True if the object is a liquidity pool, false otherwise
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
 *
 * // Check if a token is a liquidity pool
 * if (isLiquidityPool(token)) {
 *   // It's a liquidity pool token
 *   console.log(token.type); // "liquidity_pool_shares"
 * } else {
 *   // It's a regular token
 *   console.log(token.code);
 * }
 */
export const isLiquidityPool = (balanceOrToken: Balance | Token): boolean => {
  // Liquidity pool balance
  if ("liquidityPoolId" in balanceOrToken && "reserves" in balanceOrToken) {
    return true;
  }

  // Liquidity pool "token" (not a balance)
  if (
    "type" in balanceOrToken &&
    balanceOrToken.type === AssetTypeWithCustomToken.LIQUIDITY_POOL_SHARES
  ) {
    return true;
  }

  return false;
};

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
    return NATIVE_TOKEN_CODE;
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
 * @param {GetTokenPriceFromBalanceParams} params - Object containing prices map and balance
 * @returns {TokenPrice | null} The price data or null if not found
 *
 * @example
 * // Get price using balance object
 * const { prices } = usePricesStore();
 * const { balances } = useBalancesStore();
 * const nativeBalance = balances["native"];
 * const xlmPrice = getTokenPriceFromBalance({ prices, balance: nativeBalance });
 *
 * // Use the price data
 * if (xlmPrice) {
 *   console.log(`XLM price: $${xlmPrice.currentPrice.toString()}`);
 *   console.log(`24h change: ${xlmPrice.percentagePriceChange24h.toString()}%`);
 * }
 */
export const getTokenPriceFromBalance = ({
  prices,
  balance,
}: GetTokenPriceFromBalanceParams): TokenPrice | null => {
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
  if (assetIdentifier === NATIVE_TOKEN_CODE) {
    return AssetTypeWithCustomToken.NATIVE;
  }

  if (assetIdentifier.includes(":")) {
    const { assetCode, issuer } = formatAssetIdentifier(assetIdentifier);

    if (issuer.startsWith("C")) {
      return AssetTypeWithCustomToken.CUSTOM_TOKEN;
    }

    if (assetCode.length <= 4) {
      return AssetTypeWithCustomToken.CREDIT_ALPHANUM4;
    }

    if (assetCode.length >= 5 && assetCode.length <= 12) {
      return AssetTypeWithCustomToken.CREDIT_ALPHANUM12;
    }
  }

  return AssetTypeWithCustomToken.LIQUIDITY_POOL_SHARES;
};

export const isPublicKeyValid = (publicKey: string) =>
  StrKey.isValidEd25519PublicKey(publicKey);

/**
 * Calculates the spendable amount for a given balance, considering minimum balance requirements
 * for XLM. Transaction fees are only subtracted from XLM balances since fees are always paid in XLM.
 *
 * @param {CalculateSpendableAmountParams} params - Object containing balance, subentry count, and transaction fee
 * @returns {BigNumber} The spendable amount after considering all constraints
 *
 * @example
 * // Calculate spendable XLM amount (subtracts fee and minimum balance)
 * const spendable = calculateSpendableAmount({ balance: xlmBalance, subentryCount: 5, transactionFee: "0.00001" });
 *
 * // Calculate spendable amount for other assets (no fee subtraction)
 * const spendable = calculateSpendableAmount({ balance: usdcBalance });
 */
export const calculateSpendableAmount = ({
  balance,
  subentryCount = 0,
  transactionFee = MIN_TRANSACTION_FEE,
}: CalculateSpendableAmountParams): BigNumber => {
  if (!balance) return new BigNumber(0);

  const totalBalance = new BigNumber(balance.total);

  // For liquidity pools, return total balance (no fee subtraction)
  if (isLiquidityPool(balance)) {
    return totalBalance;
  }

  // For non-native assets, return available balance or total balance
  if ("token" in balance && balance.token.type !== "native") {
    // Use available balance if present
    const availableBalance =
      "available" in balance ? new BigNumber(balance.available) : totalBalance;

    return availableBalance;
  }

  // For XLM (native asset), consider minimum balance requirements and transaction fee
  if ("token" in balance && balance.token.type === "native") {
    const fee = new BigNumber(transactionFee);

    // Calculate minimum balance: (2 + subentryCount) * BASE_RESERVE
    const minBalance = new BigNumber(2 + subentryCount).multipliedBy(
      BASE_RESERVE,
    );

    // Calculate spendable: total - minimum balance - transaction fee
    const spendableAmount = totalBalance.minus(minBalance).minus(fee);

    // Ensure we don't go below zero
    return BigNumber.max(spendableAmount, new BigNumber(0));
  }

  return totalBalance;
};

/**
 * Validates if an amount exceeds the spendable balance
 *
 * @param {IsAmountSpendableParams} params - Object containing amount, balance, subentry count, and transaction fee
 * @returns {boolean} True if amount is valid (doesn't exceed spendable), false otherwise
 */
export const isAmountSpendable = ({
  amount,
  balance,
  subentryCount = 0,
  transactionFee = "0.00001",
}: IsAmountSpendableParams): boolean => {
  const amountBN = new BigNumber(amount);
  const spendableAmount = calculateSpendableAmount({
    balance,
    subentryCount,
    transactionFee,
  });

  return amountBN.isLessThanOrEqualTo(spendableAmount);
};

/**
 * Calculates the swap rate between two amounts with proper validation
 *
 * This function computes the conversion rate from source amount to destination amount
 * using BigNumber for precision. It validates inputs and handles edge cases like
 * zero amounts or invalid numbers.
 *
 * @param {string | number} sourceAmount - The source amount to convert from
 * @param {string | number} destinationAmount - The destination amount to convert to
 * @returns {string} The conversion rate as a string, or "0" if calculation fails
 *
 * @example
 * // Calculate conversion rate
 * const rate = calculateSwapRate("100", "150"); // Returns "1.5"
 * const invalidRate = calculateSwapRate("0", "100"); // Returns "0"
 */
export const calculateSwapRate = (
  sourceAmount: string | number,
  destinationAmount: string | number,
): string => {
  const sourceAmountBN = new BigNumber(sourceAmount);
  const destinationAmountBN = new BigNumber(destinationAmount);

  // Validate input amounts
  if (sourceAmountBN.isNaN() || destinationAmountBN.isNaN()) {
    return "0";
  }

  if (sourceAmountBN.isZero()) {
    return "0";
  }

  const rate = destinationAmountBN.dividedBy(sourceAmountBN);

  // Validate the calculated rate
  if (rate.isNaN() || !rate.isFinite()) {
    return "0";
  }

  return rate.toString();
};

export function isSacContract(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const [code, issuer] = name.split(":");
  if (!code || !issuer) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const asset = new Asset(code, issuer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates if the user has enough XLM for transaction fees
 *
 * This function checks if the user has sufficient XLM balance to pay for transaction fees.
 * All Stellar transactions require XLM fees, regardless of what assets are being transferred.
 *
 * @param {Array<PricedBalance & { id: string; assetType: AssetTypeWithCustomToken }>} balanceItems - Array of user's balances
 * @param {string} transactionFee - The transaction fee in XLM (default: MIN_TRANSACTION_FEE)
 * @returns {boolean} True if user has enough XLM for fees, false otherwise
 *
 * @example
 * // Check if user has enough XLM for fees
 * const hasEnoughXLM = hasXLMForFees(balanceItems, "0.00001");
 */
export const hasXLMForFees = (
  balanceItems: Array<
    PricedBalance & { id: string; assetType: AssetTypeWithCustomToken }
  >,
  transactionFee: string = MIN_TRANSACTION_FEE,
): boolean => {
  // Find XLM balance
  const xlmBalance = balanceItems.find(
    (item) => "token" in item && item.token.type === "native",
  );

  if (!xlmBalance) {
    return false;
  }

  // Check if XLM balance is sufficient for transaction fees
  return xlmBalance.total.isGreaterThanOrEqualTo(new BigNumber(transactionFee));
};
