import { formatRate } from "components/screens/EarnScreen/helpers";
import {
  NO_FIAT_VALUE,
  formatFiatAmount,
  formatTokenForDisplay,
} from "helpers/formatAmount";

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
