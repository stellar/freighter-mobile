import BigNumber from "bignumber.js";
import { TransactionContext } from "config/constants";
import { CONGESTION_TO_FEE_PRIORITY, NetworkCongestion } from "config/types";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { useEffect } from "react";

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
 */
export const useInitialRecommendedFee = (
  recommendedFee: string,
  context: TransactionContext,
  operationCount = 1,
  networkCongestion: NetworkCongestion = NetworkCongestion.LOW,
) => {
  const isSwap = context === TransactionContext.Swap;

  const {
    feeManuallyChanged: txFeeManuallyChanged,
    markFeeManuallyChanged: markTxFeeManuallyChanged,
    saveTransactionFee,
    saveFeePriority: saveTxFeePriority,
  } = useTransactionSettingsStore();

  const {
    feeManuallyChanged: swapFeeManuallyChanged,
    markFeeManuallyChanged: markSwapFeeManuallyChanged,
    saveSwapFee,
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

  useEffect(() => {
    if (recommendedFee && !feeManuallyChanged) {
      // recommendedFee is a per-op rate; store the TOTAL across all ops so the
      // fee stays consistent with what's charged/displayed. The build step
      // (getPerOperationBaseFeeStroops) divides it back per op.
      const totalFee = new BigNumber(recommendedFee)
        .times(operationCount)
        .toString();
      saveFee(totalFee);
      saveFeePriority(CONGESTION_TO_FEE_PRIORITY[networkCongestion]);
    }
  }, [
    recommendedFee,
    saveFee,
    saveFeePriority,
    feeManuallyChanged,
    operationCount,
    networkCongestion,
  ]);

  return { markAsManuallyChanged };
};
