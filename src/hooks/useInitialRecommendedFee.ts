import BigNumber from "bignumber.js";
import { TransactionContext } from "config/constants";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { useEffect } from "react";

/**
 * Hook to automatically initialize fee with recommended fee if it's still at default
 * Uses a global store flag to track if fee was manually changed to prevent overwriting
 * user input even when the hook is mounted in multiple places simultaneously.
 *
 * @param recommendedFee - The recommended fee from the network (a per-operation rate)
 * @param context - The transaction context (Send or Swap)
 * @param operationCount - Number of operations the transaction bundles. The
 *   stored fee is the TOTAL across all ops, so the per-op recommended rate is
 *   scaled by this (e.g. 2 for a swap-to-new-token's changeTrust + path
 *   payment). Defaults to 1 (Send / single-op).
 */
export const useInitialRecommendedFee = (
  recommendedFee: string,
  context: TransactionContext,
  operationCount = 1,
) => {
  const isSwap = context === TransactionContext.Swap;

  const {
    feeManuallyChanged: txFeeManuallyChanged,
    markFeeManuallyChanged: markTxFeeManuallyChanged,
    saveTransactionFee,
  } = useTransactionSettingsStore();

  const {
    feeManuallyChanged: swapFeeManuallyChanged,
    markFeeManuallyChanged: markSwapFeeManuallyChanged,
    saveSwapFee,
  } = useSwapSettingsStore();

  const feeManuallyChanged = isSwap
    ? swapFeeManuallyChanged
    : txFeeManuallyChanged;
  const markAsManuallyChanged = isSwap
    ? markSwapFeeManuallyChanged
    : markTxFeeManuallyChanged;
  const saveFee = isSwap ? saveSwapFee : saveTransactionFee;

  useEffect(() => {
    if (recommendedFee && !feeManuallyChanged) {
      // recommendedFee is a per-op rate; store the TOTAL across all ops so the
      // fee stays consistent with what's charged/displayed. The build step
      // (getPerOperationBaseFeeStroops) divides it back per op.
      const totalFee = new BigNumber(recommendedFee)
        .times(operationCount)
        .toString();
      saveFee(totalFee);
    }
  }, [recommendedFee, saveFee, feeManuallyChanged, operationCount]);

  return { markAsManuallyChanged };
};
