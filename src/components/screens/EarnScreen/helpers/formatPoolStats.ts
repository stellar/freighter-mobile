import BigNumber from "bignumber.js";
import { formatNumber, NO_FIAT_VALUE } from "helpers/formatAmount";

/** Two decimals in the device's own separators, as the app's amounts use. */
const formatTwoDecimals = (value: BigNumber) =>
  formatNumber(value.toFixed(2), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Compact USD for pool-scale figures — "$50.05M" rather than "$50,050,000".
 *
 * Returns "--" for null, which means the pool oracle has no fresh price. That
 * is distinct from a real zero, which formats as "$0.00".
 */
export const formatCompactUsd = (value: number | null): string => {
  if (value === null) {
    return NO_FIAT_VALUE;
  }

  const amount = new BigNumber(value);
  const abs = amount.abs();

  const units: [BigNumber, string][] = [
    [new BigNumber(1e9), "B"],
    [new BigNumber(1e6), "M"],
    [new BigNumber(1e3), "K"],
  ];

  const unit = units.find(([threshold]) => abs.gte(threshold));
  if (!unit) {
    return `$${formatTwoDecimals(amount)}`;
  }

  const [divisor, suffix] = unit;
  return `$${formatTwoDecimals(amount.dividedBy(divisor))}${suffix}`;
};

/**
 * A rate as a percentage — 0.1694 becomes "16.94%".
 *
 * Null means no fresh oracle price and renders "--"; a genuine zero renders
 * "0.00%". Never conflate the two.
 */
export const formatRate = (rate: number | null): string =>
  rate === null
    ? NO_FIAT_VALUE
    : `${formatTwoDecimals(new BigNumber(rate).times(100))}%`;
