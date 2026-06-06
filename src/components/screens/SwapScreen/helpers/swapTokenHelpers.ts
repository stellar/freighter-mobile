import { BigNumber } from "bignumber.js";
import { isNativeAssetId, NATIVE_TOKEN_CODE } from "config/constants";
import {
  FormattedSearchTokenRecord,
  NativeToken,
  NonNativeToken,
  PricedBalance,
  TokenIdentifier,
  TokenPricesMap,
} from "config/types";
import { getTokenIdentifier, getTokenPriceFromBalance } from "helpers/balances";

/**
 * Canonical token identifier for a stellar.expert / search record.
 *
 * Native XLM → "XLM" (no colon); classic → "CODE:ISSUER".
 *
 * Use this everywhere on the swap surface that needs to interop with the
 * balance-side identifiers from `getTokenIdentifier`. Building the id
 * manually as `${tokenCode}:${issuer}` produces "XLM:" for native, which
 * the freighter-backend /token-prices endpoint rejects with HTTP 400 and
 * never matches the balance-side "XLM" key in the prices map.
 */
export const recordTokenId = (
  record: FormattedSearchTokenRecord,
): TokenIdentifier => {
  if (record.isNative) return NATIVE_TOKEN_CODE;
  return record.issuer
    ? `${record.tokenCode}:${record.issuer}`
    : record.tokenCode;
};

interface FindBalanceForTokenParams {
  token: NonNativeToken | NativeToken;
  balanceItems: PricedBalance[];
}

interface CalculateTokenFiatAmountParams {
  token: NonNativeToken | NativeToken;
  amount: string | BigNumber;
  balanceItems: PricedBalance[];
  prices?: TokenPricesMap;
}

/**
 * Extracts token from balance or creates fallback
 */
export const getTokenFromBalance = (
  balance: PricedBalance | undefined,
): NativeToken | NonNativeToken => {
  if (balance && "token" in balance) {
    return balance.token;
  }
  return {
    type: "native",
    code: "XLM",
  };
};

/**
 * Finds a balance item that matches the given token using multiple strategies
 * This is more robust than simple ID matching as it tries multiple approaches
 */
export const findBalanceForToken = ({
  token: incomingToken,
  balanceItems,
}: FindBalanceForTokenParams): PricedBalance | undefined => {
  // Strategy 1: Use getTokenIdentifier for exact matching
  const tokenIdentifier = getTokenIdentifier(incomingToken);
  if (tokenIdentifier) {
    const exactMatch = balanceItems.find((item) => {
      const itemIdentifier = getTokenIdentifier(item);
      return itemIdentifier === tokenIdentifier;
    });
    if (exactMatch) return exactMatch;
  }

  // Strategy 2: Match by token code for native tokens
  if (incomingToken.type === "native") {
    const nativeMatch = balanceItems.find((item) => {
      if ("token" in item && item.token.type === "native") {
        return true;
      }
      return isNativeAssetId(item.id);
    });
    if (nativeMatch) return nativeMatch;
  }

  // Strategy 3: Match by code and issuer for tokens
  if (incomingToken.type !== "native") {
    const token = incomingToken;
    const tokenMatch = balanceItems.find((item) => {
      if ("token" in item && item.token.type !== "native") {
        const itemToken = item.token;
        return (
          itemToken.code === token.code && itemToken.issuer === token.issuer
        );
      }
      return false;
    });
    if (tokenMatch) return tokenMatch;
  }

  // Strategy 4: Fallback to code-only matching (less reliable)
  const codeMatch = balanceItems.find((item) => {
    if ("token" in item) {
      return item.token.code === incomingToken.code;
    }
    return item.tokenCode === incomingToken.code;
  });

  return codeMatch;
};

/**
 * Calculates fiat amount for a token using multiple price sources
 * This provides robust price calculation with fallbacks
 */
export const calculateTokenFiatAmount = ({
  token: incomingToken,
  amount,
  balanceItems,
  prices,
}: CalculateTokenFiatAmountParams): string => {
  const amountBN = new BigNumber(amount);

  if (amountBN.isZero() || amountBN.isNaN()) {
    return "--";
  }

  // Strategy 1: Get price from balance item (most common and reliable)
  const balance = findBalanceForToken({ token: incomingToken, balanceItems });
  if (balance?.currentPrice) {
    return amountBN.multipliedBy(balance.currentPrice).toString();
  }

  // Strategy 2: Get price from prices store using the helper function
  if (prices && balance) {
    const priceData = getTokenPriceFromBalance({ prices, balance });
    if (priceData?.currentPrice) {
      return amountBN.multipliedBy(priceData.currentPrice).toString();
    }
  }

  // Strategy 3: Direct lookup in prices map using token identifier
  if (prices) {
    const tokenIdentifier = getTokenIdentifier(incomingToken);
    if (tokenIdentifier && prices[tokenIdentifier]?.currentPrice) {
      return amountBN
        .multipliedBy(prices[tokenIdentifier].currentPrice)
        .toString();
    }
  }

  // No price data available
  return "--";
};
