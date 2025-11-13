import { TransactionContext } from "config/constants";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { useEffect, useRef } from "react";

/**
 * Hook to automatically initialize fee with recommended fee if it's still at default
 * Uses a ref to track if fee was manually changed to prevent overwriting user input
 *
 * @param recommendedFee - The recommended fee from the network
 * @param context - The transaction context (Send or Swap)
 */
export const useInitialRecommendedFee = (
  recommendedFee: string,
  context: TransactionContext,
) => {
  const hasManuallyChangedRef = useRef(false);

  const { saveTransactionFee } = useTransactionSettingsStore();
  const { saveSwapFee } = useSwapSettingsStore();

  const saveFee =
    context === TransactionContext.Swap ? saveSwapFee : saveTransactionFee;

  useEffect(() => {
    if (recommendedFee && !hasManuallyChangedRef.current) {
      saveFee(recommendedFee);
    }
  }, [recommendedFee, saveFee]);

  const markAsManuallyChanged = () => {
    hasManuallyChangedRef.current = true;
  };

  return { markAsManuallyChanged };
};
