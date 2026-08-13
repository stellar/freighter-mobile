import BigNumber from "bignumber.js";
import { TransactionContext } from "config/constants";
import {
  CONGESTION_TO_FEE_PRIORITY,
  FeePresets,
  FeePriority,
  NetworkCongestion,
} from "config/types";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { useEffect, useRef } from "react";

/**
 * Initializes the fee and priority tier from the network recommendation until
 * the user manually changes them (tracked by a global store flag so it works
 * even when mounted in several places at once). The default tier follows
 * network congestion 1:1.
 *
 * @param recommendedFee - The recommended fee from the network (a per-operation rate)
 * @param context - The transaction context (Send or Swap)
 * @param operationCount - Number of operations the transaction bundles. The
 *   stored fee is the TOTAL across all ops, so the per-op recommended rate is
 *   scaled by this (e.g. 2 for a swap-to-new-token's changeTrust + path
 *   payment). Defaults to 1 (Send / single-op).
 * @param networkCongestion - Current congestion; picks the default tier.
 * @param feePresets - Per-operation Low/Med/High rates. Supplied so a preset
 *   tier the user picked can be re-derived when `operationCount` changes; omit
 *   it where the operation count is fixed.
 */
export const useInitialRecommendedFee = (
  recommendedFee: string,
  context: TransactionContext,
  operationCount = 1,
  networkCongestion: NetworkCongestion = NetworkCongestion.LOW,
  feePresets?: FeePresets,
) => {
  const isSwap = context === TransactionContext.Swap;

  const {
    feeManuallyChanged: txFeeManuallyChanged,
    markFeeManuallyChanged: markTxFeeManuallyChanged,
    saveTransactionFee,
    feePriority: txFeePriority,
    saveFeePriority: saveTxFeePriority,
  } = useTransactionSettingsStore();

  const {
    feeManuallyChanged: swapFeeManuallyChanged,
    markFeeManuallyChanged: markSwapFeeManuallyChanged,
    saveSwapFee,
    feePriority: swapFeePriority,
    saveFeePriority: saveSwapFeePriority,
  } = useSwapSettingsStore();

  const feeManuallyChanged = isSwap
    ? swapFeeManuallyChanged
    : txFeeManuallyChanged;
  const markAsManuallyChanged = isSwap
    ? markSwapFeeManuallyChanged
    : markTxFeeManuallyChanged;
  const saveFee = isSwap ? saveSwapFee : saveTransactionFee;
  const saveFeePriority = isSwap ? saveSwapFeePriority : saveTxFeePriority;

  // The tier is an input to the fee derivation below, not a trigger for it: as
  // a dependency the effect would re-run on the tier it just wrote, and
  // instances mounted with different congestion levels would overwrite each
  // other's totals. Held in a ref so the effect always reads the current value
  // without subscribing to it.
  const feePriorityRef = useRef(isSwap ? swapFeePriority : txFeePriority);
  feePriorityRef.current = isSwap ? swapFeePriority : txFeePriority;

  useEffect(() => {
    if (!feeManuallyChanged && recommendedFee) {
      // recommendedFee is a per-op rate; store the TOTAL across all ops so the
      // fee stays consistent with what's charged/displayed. The build step
      // (getPerOperationBaseFeeStroops) divides it back per op.
      const totalFee = new BigNumber(recommendedFee)
        .times(operationCount)
        .toString();
      saveFee(totalFee);
      saveFeePriority(CONGESTION_TO_FEE_PRIORITY[networkCongestion]);
      return;
    }

    // Past this point the rate is already settled: either the user picked a
    // tier, or the caller withheld `recommendedFee` to freeze the rate once an
    // amount was entered. Neither means the stored TOTAL can stand still — it's
    // rate × operationCount, so a swap whose destination starts needing a
    // changeTrust has to grow, or the build step splits the old total across
    // both operations and silently halves the rate.
    //
    // Re-deriving from the preset applies no NEW rate: presets are frozen for
    // the flow and `recommendedFee` is itself the preset for the congestion
    // tier, so this reproduces the rate already in effect. That keeps the
    // freeze's intent (no fee bump under a committed amount) intact.
    const storedFeePriority = feePriorityRef.current;

    if (storedFeePriority === FeePriority.CUSTOM) {
      return;
    }

    const presetFee = feePresets?.[storedFeePriority];
    if (!presetFee) {
      return;
    }

    saveFee(new BigNumber(presetFee).times(operationCount).toString());
  }, [
    recommendedFee,
    saveFee,
    saveFeePriority,
    feeManuallyChanged,
    feePresets,
    operationCount,
    networkCongestion,
    isSwap,
  ]);

  return { markAsManuallyChanged };
};
