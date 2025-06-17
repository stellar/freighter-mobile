import { formatConversionRate } from "components/screens/SwapScreen/helpers";
import { useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useState } from "react";

/**
 * Simplified hook for swap review functionality
 * Following SendScreen patterns - using stores directly instead of complex props
 */
export const useSwapReview = () => {
  const { t } = useAppTranslation();
  const { account } = useGetActiveAccount();
  const { copyToClipboard } = useClipboard();
  const [isProcessing, setIsProcessing] = useState(false);

  // Access stores directly - cleaner pattern
  const {
    swapAmount,
    destinationAmount,
    pathResult,
    fromTokenSymbol,
    toTokenSymbol,
  } = useSwapStore();

  const { swapFee } = useSwapSettingsStore();
  const { transactionXDR, isBuilding } = useTransactionBuilderStore();

  const handleCopyXdr = () => {
    if (transactionXDR) {
      copyToClipboard(transactionXDR, {
        notificationMessage: t("common.copied"),
      });
    }
  };

  const startProcessing = () => {
    setIsProcessing(true);
  };

  const stopProcessing = () => {
    setIsProcessing(false);
  };

  // Format conversion rate using helper
  const conversionRate = formatConversionRate(
    pathResult?.conversionRate || "",
    fromTokenSymbol,
    toTokenSymbol,
  );

  return {
    // State
    isProcessing,
    isBuilding,

    // Data
    swapAmount,
    destinationAmount: destinationAmount || "0",
    fromTokenSymbol,
    toTokenSymbol,
    minimumReceived: pathResult?.destinationAmountMin || "0",
    conversionRate,
    swapFee,
    transactionXDR,
    account,

    // Derived data for fiat amounts - simplified
    fromTokenFiatAmount: "--", // Could be enhanced later
    toTokenFiatAmount: "--", // Could be enhanced later

    // Actions
    handleCopyXdr,
    startProcessing,
    stopProcessing,
  };
};
