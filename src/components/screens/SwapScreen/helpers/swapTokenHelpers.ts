import { BigNumber } from "bignumber.js";
import {
  NativeToken,
  AssetToken,
  PricedBalance,
  TokenPricesMap,
} from "config/types";
import { getTokenIdentifier, getTokenPriceFromBalance } from "helpers/balances";

interface FindBalanceForTokenParams {
  token: AssetToken | NativeToken;
  balanceItems: PricedBalance[];
}

interface CalculateTokenFiatAmountParams {
  token: AssetToken | NativeToken;
  amount: string | BigNumber;
  balanceItems: PricedBalance[];
  prices?: TokenPricesMap;
}

/**
 * Extracts token from balance or creates fallback
 */
export const getTokenFromBalance = (
  balance: PricedBalance | undefined,
): NativeToken | AssetToken => {
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
  token,
  balanceItems,
}: FindBalanceForTokenParams): PricedBalance | undefined => {
  // Strategy 1: Use getTokenIdentifier for exact matching
  const tokenIdentifier = getTokenIdentifier(token);
  if (tokenIdentifier) {
    const exactMatch = balanceItems.find((item) => {
      const itemIdentifier = getTokenIdentifier(item);
      return itemIdentifier === tokenIdentifier;
    });
    if (exactMatch) return exactMatch;
  }

  // Strategy 2: Match by token code for native assets
  if (token.type === "native") {
    const nativeMatch = balanceItems.find((item) => {
      if ("token" in item && item.token.type === "native") {
        return true;
      }
      return item.id === "native";
    });
    if (nativeMatch) return nativeMatch;
  }

  // Strategy 3: Match by code and issuer for asset tokens
  if (token.type !== "native") {
    const assetToken = token;
    const assetMatch = balanceItems.find((item) => {
      if ("token" in item && item.token.type !== "native") {
        const itemToken = item.token;
        return (
          itemToken.code === assetToken.code &&
          itemToken.issuer === assetToken.issuer
        );
      }
      return false;
    });
    if (assetMatch) return assetMatch;
  }

  // Strategy 4: Fallback to code-only matching (less reliable)
  const codeMatch = balanceItems.find((item) => {
    if ("token" in item) {
      return item.token.code === token.code;
    }
    return item.tokenCode === token.code;
  });

  return codeMatch;
};

/**
 * Calculates fiat amount for a token using multiple price sources
 * This provides robust price calculation with fallbacks
 */
export const calculateTokenFiatAmount = ({
  token,
  amount,
  balanceItems,
  prices,
}: CalculateTokenFiatAmountParams): string => {
  const amountBN = new BigNumber(amount);

  if (amountBN.isZero() || amountBN.isNaN()) {
    return "--";
  }

  // Strategy 1: Get price from balance item (most common and reliable)
  const balance = findBalanceForToken({ token, balanceItems });
  if (balance?.currentPrice) {
    return amountBN.multipliedBy(balance.currentPrice).toString();
  }

  // Strategy 2: Get price from prices store using the helper function
  if (prices && balance) {
    const priceData = getTokenPriceFromBalance(prices, balance);
    if (priceData?.currentPrice) {
      return amountBN.multipliedBy(priceData.currentPrice).toString();
    }
  }

  // Strategy 3: Direct lookup in prices map using token identifier
  if (prices) {
    const tokenIdentifier = getTokenIdentifier(token);
    if (tokenIdentifier && prices[tokenIdentifier]?.currentPrice) {
      return amountBN
        .multipliedBy(prices[tokenIdentifier].currentPrice)
        .toString();
    }
  }

  // No price data available
  return "--";
};
