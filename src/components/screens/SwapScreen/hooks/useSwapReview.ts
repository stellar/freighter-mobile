
import { formatConversionRate } from "components/screens/SwapScreen/helpers";
import { AssetToken, AssetTypeWithCustomToken, NativeToken } from "config/types";
import { useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useState } from "react";

export const useSwapReview = () => {
  const { t } = useAppTranslation();
  const { account } = useGetActiveAccount();
  const { copyToClipboard } = useClipboard();
  const [isProcessing, setIsProcessing] = useState(false);

  // Get data from stores
  const {
    swapAmount,
    destinationAmount,
    pathResult,
    fromTokenSymbol,
    toTokenSymbol,
  } = useSwapStore();
  
  const { swapFee } = useSwapSettingsStore();
  const { transactionXDR } = useTransactionBuilderStore();

  // Create token objects for display
  const fromToken: AssetToken | NativeToken = fromTokenSymbol === "XLM" 
    ? {
        type: AssetTypeWithCustomToken.NATIVE,
        code: "XLM",
      }
    : {
        type: AssetTypeWithCustomToken.CREDIT_ALPHANUM4,
        code: fromTokenSymbol,
        issuer: { key: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" }
      };

  const toToken: AssetToken | NativeToken = toTokenSymbol === "XLM"
    ? {
        type: AssetTypeWithCustomToken.NATIVE,
        code: "XLM",
      }
    : {
        type: AssetTypeWithCustomToken.CREDIT_ALPHANUM4,
        code: toTokenSymbol,
        issuer: { key: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" }
      };

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

  // Format conversion rate using updated helper with 7 decimals and formatAssetAmount
  const formattedConversionRate = formatConversionRate(
    pathResult?.conversionRate || "",
    fromTokenSymbol,
    toTokenSymbol
  );

  return {
    // State
    isProcessing,
    
    // Data
    swapAmount,
    destinationAmount: destinationAmount || "0",
    fromToken,
    toToken,
    fromTokenSymbol,
    toTokenSymbol,
    minimumReceived: pathResult?.destinationAmountMin || "0",
    conversionRate: formattedConversionRate,
    swapFee,
    transactionXDR,
    account,
    
    // Actions
    handleCopyXdr,
    startProcessing,
    stopProcessing,
  };
}; 