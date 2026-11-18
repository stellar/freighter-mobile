import BigNumber from "bignumber.js";
import { DEFAULT_DECIMALS } from "config/constants";
import { PricedBalance } from "config/types";
import { hasDecimals } from "helpers/formatAmount";

/**
 * The amount a percentage button commits, on the deposit screen and in the
 * Earn swap.
 *
 * `PercentageButtons` reports whole percents — 25/50/75, and 100 for Max — so
 * the fraction has to be derived here; multiplying by the raw value asks for 25x
 * the balance and every button trips the insufficient-balance check.
 *
 * Rounds DOWN at the asset's precision, so Max lands on the maximum spendable
 * rather than a hair above it, and a fraction of the balance never carries
 * more decimals than the asset has (Stellar rejects more than 7 for a classic
 * asset).
 */
export const getPercentageAmount = ({
  maxAmount,
  pct,
  decimals,
}: {
  maxAmount: string;
  pct: number;
  decimals: number;
}) =>
  new BigNumber(maxAmount)
    .multipliedBy(new BigNumber(pct).dividedBy(100))
    .decimalPlaces(decimals, BigNumber.ROUND_DOWN)
    .toFixed();

/**
 * The precision a deposit is scaled to before it is signed, taken from the
 * user's own balance record, as Send does: a Soroban token's own `decimals`,
 * and 7 for native XLM and classic assets (their SACs always use 7).
 *
 * The backend catalog's `decimals` is not used: a wrong value there would
 * scale the signed amount by a power of ten while Review still shows the
 * typed one. Returns null without a usable balance record, so the caller can
 * refuse to build the deposit rather than guess.
 */
export const getDepositDecimals = (
  balance: PricedBalance | undefined,
): number | null => {
  if (!balance) {
    return null;
  }
  if (!("decimals" in balance)) {
    return DEFAULT_DECIMALS;
  }
  return hasDecimals(balance) && Number.isInteger(balance.decimals)
    ? balance.decimals
    : null;
};
