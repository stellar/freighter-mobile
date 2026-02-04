import Blockaid from "@blockaid/client";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getTokenFromBalance } from "components/screens/SwapScreen/helpers";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import {
  SWAP_ROUTES,
  SwapStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  MAIN_TAB_ROUTES,
} from "config/routes";
import { PricedBalance, NativeToken, NonNativeToken } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { useHistoryStore } from "ducks/history";
import { SwapPathResult } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useBlockaidTransaction } from "hooks/blockaid/useBlockaidTransaction";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useState, useCallback } from "react";
import { analytics } from "services/analytics";

interface SwapTransactionParams {
  sourceAmount: string;
  sourceBalance: PricedBalance | undefined;
  destinationBalance: PricedBalance | undefined;
  pathResult: SwapPathResult | null;
  account: ActiveAccount | null;
  network: NETWORKS;
  navigation: NativeStackNavigationProp<
    SwapStackParamList,
    typeof SWAP_ROUTES.SWAP_AMOUNT_SCREEN
  >;
}

interface UseSwapTransactionResult {
  isProcessing: boolean;
  executeSwap: () => Promise<void>;
  setupSwapTransaction: () => Promise<void>;
  handleProcessingScreenClose: () => void;
  sourceToken: NativeToken | NonNativeToken;
  destinationToken: NativeToken | NonNativeToken;
  transactionScanResult: Blockaid.StellarTransactionScanResponse | undefined;
}

export const useSwapTransaction = ({
  sourceAmount,
  sourceBalance,
  destinationBalance,
  pathResult,
  account,
  network,
  navigation,
}: SwapTransactionParams): UseSwapTransactionResult => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionScanResult, setTransactionScanResult] =
    useState<UseSwapTransactionResult["transactionScanResult"]>(undefined);
  const { buildSwapTransaction, signTransaction, submitTransaction } =
    useTransactionBuilderStore();
  const { fetchAccountHistory } = useHistoryStore();
  const { scanTransaction } = useBlockaidTransaction();
  const { t } = useAppTranslation();
  const { showToast } = useToast();

  const setupSwapTransaction = useCallback(async () => {
    if (
      !sourceBalance ||
      !destinationBalance ||
      !pathResult ||
      !account?.publicKey
    ) {
      return;
    }

    // Get fresh settings values each time the function is called
    const { swapFee: freshSwapFee, swapTimeout: freshSwapTimeout } =
      useSwapSettingsStore.getState();

    const transactionXDR = await buildSwapTransaction({
      sourceAmount,
      sourceBalance,
      destinationBalance,
      path: pathResult.path,
      destinationAmount: pathResult.destinationAmount,
      destinationAmountMin: pathResult.destinationAmountMin,
      transactionFee: freshSwapFee,
      transactionTimeout: freshSwapTimeout,
      network,
      senderAddress: account.publicKey,
    });

    if (!transactionXDR) {
      // Get the error message stored in the transaction builder
      const { error: builderError } = useTransactionBuilderStore.getState();
      throw new Error(builderError || "Failed to build swap transaction");
    }
    try {
      const scanResult = await scanTransaction(transactionXDR, "internal");
      setTransactionScanResult(scanResult);
    } catch (error) {
      logger.error("SwapTransaction", "Transaction scan failed", error);
    }
  }, [
    sourceBalance,
    destinationBalance,
    pathResult,
    buildSwapTransaction,
    account?.publicKey,
    sourceAmount,
    network,
    scanTransaction,
  ]);

  const executeSwap = useCallback(async () => {
    if (!account) {
      return;
    }

    // Validate required data before proceeding
    if (!sourceBalance?.tokenCode) {
      throw new Error("Source token is required for swap transaction");
    }

    if (!destinationBalance?.tokenCode) {
      throw new Error("Destination token is required for swap transaction");
    }

    setIsProcessing(true);

    try {
      const signedXDR = signTransaction({
        secretKey: account.privateKey,
        network,
      });

      if (!signedXDR) {
        // Get the error message stored in the transaction builder
        const { error: signingError } = useTransactionBuilderStore.getState();
        throw new Error(signingError || "Failed to sign transaction");
      }

      // submitTransaction will throw if it fails (including debug overrides)
      // or return the hash if successful. If it returns null, surface the
      // stored error to keep the toast message accurate (e.g. DEBUG failures).
      const transactionHash = await submitTransaction({ network });

      if (!transactionHash) {
        const { error: submitError } = useTransactionBuilderStore.getState();
        const errorMessage = submitError || "Failed to submit transaction";
        throw new Error(errorMessage);
      }

      // Get fresh slippage value for analytics
      const { swapSlippage: freshSwapSlippage } =
        useSwapSettingsStore.getState();

      analytics.trackSwapSuccess({
        sourceToken: sourceBalance.tokenCode,
        destToken: destinationBalance.tokenCode,
        allowedSlippage: freshSwapSlippage?.toString(),
        isSwap: true,
      });
    } catch (error) {
      setIsProcessing(false);
      logger.error("SwapTransaction", "Swap failed", error);

      // Debug: Log the actual error object and message
      if (error instanceof Error) {
        logger.error("SwapTransaction", "Error message:", error.message);
      }

      analytics.trackTransactionError({
        error: error instanceof Error ? error.message : String(error),
        isSwap: true,
      });

      // Show error toast that persists even if component unmounts
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("swapScreen.errors.swapTransactionFailed");

      const toastId = `swap-transaction-failed-${errorMessage}`;

      showToast({
        variant: "error",
        title: errorMessage,
        toastId,
        duration: 0,
      });

      throw error;
    }
  }, [
    account,
    sourceBalance?.tokenCode,
    destinationBalance?.tokenCode,
    signTransaction,
    network,
    submitTransaction,
    t,
    showToast,
  ]);

  const handleProcessingScreenClose = () => {
    setIsProcessing(false);

    if (account?.publicKey) {
      fetchAccountHistory({
        publicKey: account.publicKey,
        network,
        isBackgroundRefresh: true,
        hasRecentTransaction: true,
      });
    }

    navigation.reset({
      index: 0,
      routes: [
        {
          // @ts-expect-error: Cross-stack navigation to MainTabStack with History tab
          name: ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK,
          state: {
            routes: [{ name: MAIN_TAB_ROUTES.TAB_HISTORY }],
            index: 0,
          },
        },
      ],
    });
  };

  const sourceToken = getTokenFromBalance(sourceBalance);
  const destinationToken = getTokenFromBalance(destinationBalance);

  return {
    isProcessing,
    executeSwap,
    setupSwapTransaction,
    handleProcessingScreenClose,
    sourceToken,
    destinationToken,
    transactionScanResult,
  };
};
