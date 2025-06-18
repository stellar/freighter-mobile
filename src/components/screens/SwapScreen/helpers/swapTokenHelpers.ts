import { NativeToken, AssetToken, PricedBalance } from "config/types";

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
