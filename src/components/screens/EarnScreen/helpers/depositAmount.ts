import BigNumber from "bignumber.js";
import { DEFAULT_DECIMALS } from "config/constants";
import { PricedBalance } from "config/types";

/**
 * The amount a percentage button on the deposit screen commits.
 *
 * `PercentageButtons` reports whole percents — 25/50/75, and 100 for Max — so
 * the fraction has to be derived here; multiplying by the raw value asks for 25x
 * the balance and every button trips the insufficient-balance check.
 *
 * Rounds DOWN at the asset's precision, so Max lands on the maximum spendable
 * rather than a hair above it.
 */
export const getPercentageDepositAmount = ({
  maxDepositable,
  pct,
  decimals,
}: {
  maxDepositable: string;
  pct: number;
  decimals: number;
}) =>
  new BigNumber(maxDepositable)
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
  if ("decimals" in balance) {
    const { decimals } = balance;
    return typeof decimals === "number" &&
      Number.isInteger(decimals) &&
      decimals >= 0
      ? decimals
      : null;
  }
  return DEFAULT_DECIMALS;
};
