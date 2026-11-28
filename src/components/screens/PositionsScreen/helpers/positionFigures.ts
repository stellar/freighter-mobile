import BigNumber from "bignumber.js";
import { formatRate } from "components/screens/EarnScreen/helpers";
import { getPoolDisplayName } from "components/screens/EarnScreen/helpers/poolDisplayName";
import {
  NO_FIAT_VALUE,
  formatFiatAmount,
  formatTokenForDisplay,
} from "helpers/formatAmount";
import { TFunction } from "i18next";

/**
 * A position's pool as the app names pools, e.g. "Fixed v2 Pool", or "Blend
 * pool" when the backend sent no name.
 */
export const getPositionPoolName = (
  name: string | null,
  t: TFunction<"translations", undefined>,
): string =>
  name?.trim() ? getPoolDisplayName(name, t) : t("positions.unnamedPool");

/**
 * A position's USD figure, "$800.12", or "--" when it's unknown: no fresh
 * price is never a zero.
 */
export const formatPositionUsd = (value: number | null): string =>
  value === null ? NO_FIAT_VALUE : formatFiatAmount(new BigNumber(value));

/**
 * A token amount with its code, "1,218.6488 USDC", or "--" when the amount is
 * unknown (a Soroban-only token whose decimals the backend didn't report).
 */
export const formatPositionTokens = (tokens: string | null, code: string) =>
  tokens === null ? NO_FIAT_VALUE : formatTokenForDisplay(tokens, code);

/**
 * A position's gain: "+$31.75 (2.54%)", the interest in dollars and its share
 * of principal. Null when the interest is unknown. A known interest with no
 * measurable share (no principal left) keeps the amount alone.
 */
export const formatPositionGain = (
  interestUsd: number | null,
  gainPercent: number | null,
): string | null => {
  if (interestUsd === null) {
    return null;
  }

  const sign = interestUsd < 0 ? "-" : "+";
  const amount = formatFiatAmount(Math.abs(interestUsd).toString());

  return gainPercent === null
    ? `${sign}${amount}`
    : `${sign}${amount} (${formatRate(Math.abs(gainPercent))})`;
};

/** The pool card's gain badge, "+2.54%". Null when the share is unknown. */
export const formatGainBadge = (gainPercent: number | null): string | null =>
  gainPercent === null
    ? null
    : `${gainPercent < 0 ? "-" : "+"}${formatRate(Math.abs(gainPercent))}`;

export type GainTone = "gain" | "loss" | "unknown";

/**
 * How a gain figure is coloured: green for a gain (zero included), grey for a
 * loss, so a negative figure never reads as a green gain, and grey when it's
 * unknown.
 */
export const getGainTone = (value: number | null): GainTone => {
  if (value === null) {
    return "unknown";
  }
  return value < 0 ? "loss" : "gain";
};
