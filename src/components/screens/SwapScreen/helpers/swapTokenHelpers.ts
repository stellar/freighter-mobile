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
 * Returns the held balance's `token` field, or a native-XLM fallback
 * when no balance is provided. The fallback is XLM-only — callers
 * dealing with non-held destinations must NOT pass `undefined` and
 * expect to derive the destination token shape from this helper, since
 * they'll silently get XLM. See `useReviewTokens` for the canonical
 * non-held pattern that builds the token from a
 * `DestinationTokenDescriptor`.
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
 * Finds a balance item that matches the given token using multiple strategies.
 */
export const findBalanceForToken = ({
  token: incomingToken,
  balanceItems,
}: FindBalanceForTokenParams): PricedBalance | undefined => {
  // Exact identifier match (code:issuer / symbol:contract / "XLM").
  const tokenIdentifier = getTokenIdentifier(incomingToken);
  if (tokenIdentifier) {
    const exactMatch = balanceItems.find(
      (item) => getTokenIdentifier(item) === tokenIdentifier,
    );
    if (exactMatch) return exactMatch;
  }

  // Native tokens can also be keyed by the raw "native" sentinel.
  if (incomingToken.type === "native") {
    return balanceItems.find((item) => {
      if ("token" in item && item.token.type === "native") {
        return true;
      }
      return isNativeAssetId(item.id);
    });
  }

  // No looser fallbacks: a balance that doesn't match by full identity is
  // a different asset, and valuing one asset at another's price is wrong
  // even when the codes agree.
  return undefined;
};

/**
 * Calculates fiat amount for a token using multiple price sources, with fallbacks.
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

  return "--";
};
