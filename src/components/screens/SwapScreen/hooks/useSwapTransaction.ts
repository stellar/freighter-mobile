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
import { SwapPathResult } from "ducks/swap";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useState } from "react";
import { analytics } from "services/analytics";

interface SwapTransactionParams {
  sourceAmount: string;
  sourceBalance: PricedBalance | undefined;
  destinationBalance: PricedBalance | undefined;
  pathResult: SwapPathResult | null;
  account: ActiveAccount | null;
  swapFee: string;
  swapTimeout: number;
  swapSlippage?: number;
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
}

export const useSwapTransaction = ({
  sourceAmount,
  sourceBalance,
  destinationBalance,
  pathResult,
  account,
  swapFee,
  swapTimeout,
  swapSlippage,
  network,
  navigation,
}: SwapTransactionParams): UseSwapTransactionResult => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { buildSwapTransaction, signTransaction, submitTransaction } =
    useTransactionBuilderStore();

  const setupSwapTransaction = async () => {
    if (
      !sourceBalance ||
      !destinationBalance ||
      !pathResult ||
      !account?.publicKey
    ) {
      return;
    }

    try {
      const transactionXDR = await buildSwapTransaction({
        sourceAmount,
        sourceBalance,
        destinationBalance,
        path: pathResult.path,
        destinationAmount: pathResult.destinationAmount,
        destinationAmountMin: pathResult.destinationAmountMin,
        transactionFee: swapFee,
        transactionTimeout: swapTimeout,
        network,
        senderAddress: account.publicKey,
      });

      if (!transactionXDR) {
        throw new Error("Failed to build swap transaction");
      }
    } catch (error) {
      logger.error(
        "SwapTransaction",
        "Failed to setup swap transaction",
        error,
      );
      throw error;
    }
  };

  const executeSwap = async () => {
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
        throw new Error("Failed to sign transaction");
      }

      const transactionHash = await submitTransaction({ network });

      if (!transactionHash) {
        throw new Error("Failed to submit transaction");
      }

      analytics.trackSwapSuccess({
        sourceToken: sourceBalance.tokenCode,
        destinationToken: destinationBalance.tokenCode,
        allowedSlippage: swapSlippage?.toString(),
        isSwap: true,
      });
    } catch (error) {
      setIsProcessing(false);
      logger.error("SwapTransaction", "Swap failed", error);

      analytics.trackTransactionError({
        error: error instanceof Error ? error.message : String(error),
        isSwap: true,
      });

      throw error;
    }
  };

  const handleProcessingScreenClose = () => {
    setIsProcessing(false);

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
  };
};
