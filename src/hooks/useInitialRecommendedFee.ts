import { TransactionContext } from "config/constants";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { useEffect } from "react";

/**
 * Hook to automatically initialize fee with recommended fee if it's still at default
 * Uses a global store flag to track if fee was manually changed to prevent overwriting
 * user input even when the hook is mounted in multiple places simultaneously.
 *
 * @param recommendedFee - The recommended fee from the network
 * @param context - The transaction context (Send or Swap)
 */
export const useInitialRecommendedFee = (
  recommendedFee: string,
  context: TransactionContext,
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
      saveFee(recommendedFee);
    }
  }, [recommendedFee, saveFee, feeManuallyChanged]);

  return { markAsManuallyChanged };
};
