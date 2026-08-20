import BigNumber from "bignumber.js";
import { BLEND_DEPOSIT_XLM_FEE_BUFFER } from "config/blend";

/**
 * Pure CTA state machine for the deposit amount screen. Precedence matters:
 * each guard short-circuits, so the label reflects the most specific blocker.
 */
export type EarnCtaLabelKey = "enter" | "insufficient" | "review";

export interface EarnCtaInputs {
  /** Spendable balance of the deposit asset, net of reserve and fee. */
  availableBalanceIsZero: boolean;
  amountIsZero: boolean;
  isAmountTooHigh: boolean;
}

export const getEarnCtaState = ({
  availableBalanceIsZero,
  amountIsZero,
  isAmountTooHigh,
}: EarnCtaInputs): { disabled: boolean; labelKey: EarnCtaLabelKey } => {
  // Nothing enterable is valid with zero spendable balance, so surface the
  // blocker directly rather than inviting an amount that cannot work.
  if (availableBalanceIsZero) {
    return { disabled: true, labelKey: "insufficient" };
  }
  if (amountIsZero) {
    return { disabled: true, labelKey: "enter" };
  }
  if (isAmountTooHigh) {
    return { disabled: true, labelKey: "insufficient" };
  }
  return { disabled: false, labelKey: "review" };
};

/**
 * Does the account lack the XLM to pay this transaction's fee?
 *
 * A Soroban invoke's fee is XLM-only and no trustline is involved, so this is
 * simply "spendable XLM < fee".
 *
 * Order this AFTER the CTA's insufficient-funds check: when the deposit asset
 * IS XLM, an unaffordable amount should read as insufficient funds on the
 * button, and this sheet should only fire for an otherwise-affordable amount
 * that leaves no fee headroom.
 */
export const needsXlmForFee = ({
  spendableXlm,
  fee,
}: {
  spendableXlm: string;
  fee: string;
}) => new BigNumber(spendableXlm).lt(new BigNumber(fee));

/**
 * Spendable amount to offer for a Max deposit.
 *
 * `calculateSpendableAmount` subtracts the base reserve and the *inclusion*
 * fee, but a Blend `submit` is dominated by its resource fee — ~0.0546 XLM
 * against the live pool, roughly 5,000x the inclusion fee. Depositing the raw
 * available balance of XLM therefore simulates into an insufficient-balance
 * error. Hold back a buffer; the CTA handler re-checks against the real
 * `minResourceFee` once simulation returns (see `clampXlmDepositAmount`).
 *
 * Only XLM needs this — for any other asset the fee is paid from a separate
 * balance, and the shortfall surfaces through the network-fee sheet instead.
 */
export const getMaxDepositAmount = ({
  availableBalance,
  isXlm,
}: {
  availableBalance: string;
  isXlm: boolean;
}) => {
  const available = new BigNumber(availableBalance);
  if (!isXlm) {
    return available.toFixed();
  }
  return BigNumber.max(
    available.minus(new BigNumber(BLEND_DEPOSIT_XLM_FEE_BUFFER)),
    new BigNumber(0),
  ).toFixed();
};

/**
 * Re-clamps the entered deposit amount against the REAL resource fee, once
 * simulation has resolved and the fee is actually known — `getMaxDepositAmount`'s
 * 0.5 XLM buffer above is a generous pre-simulation estimate, not the real cost.
 *
 * Pure and side-effect-free by design: the caller (`EarnAmountScreen`'s CTA
 * handler) is responsible for actually updating `tokenAmount` and re-simulating
 * with the returned value BEFORE opening Review, so the staged transaction in
 * `transactionBuilder` always corresponds to what gets displayed. This function
 * only computes what the corrected amount SHOULD be.
 *
 * Returns `enteredAmount` unchanged (a no-op) when:
 * - the deposit asset is not XLM — every other asset's fee comes from a
 *   separate balance, so this cannot squeeze it;
 * - `resourceFeeXlm` is `null` — an unknown fee, not a zero one, so there is
 *   nothing more precise to re-check against than the buffer already applied;
 * - the entered amount already fits.
 *
 * Otherwise returns `spendableXlm - resourceFeeXlm`, floored at zero and
 * rounded DOWN at the asset's decimals — so the result never exceeds the
 * asset's precision and is never negative. Idempotent: feeding the function's
 * own output back in as `enteredAmount` is always a no-op, since the rounded
 * result can only be less than or equal to the un-rounded ceiling it was
 * derived from.
 */
export const clampXlmDepositAmount = ({
  enteredAmount,
  spendableXlm,
  resourceFeeXlm,
  decimals,
  isXlm,
}: {
  enteredAmount: string;
  spendableXlm: string;
  resourceFeeXlm: string | null;
  decimals: number;
  isXlm: boolean;
}): string => {
  if (!isXlm || resourceFeeXlm === null) {
    return enteredAmount;
  }

  const maxFittingAmount = BigNumber.max(
    new BigNumber(spendableXlm).minus(resourceFeeXlm),
    new BigNumber(0),
  );

  const entered = new BigNumber(enteredAmount || "0");

  if (entered.lte(maxFittingAmount)) {
    return enteredAmount;
  }

  return maxFittingAmount
    .decimalPlaces(decimals, BigNumber.ROUND_DOWN)
    .toFixed();
};
