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
import { PricedBalance, NativeToken, AssetToken } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { SwapPathResult } from "ducks/swap";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useState } from "react";

interface SwapTransactionParams {
  sourceAmount: string;
  sourceBalance: PricedBalance | undefined;
  destinationBalance: PricedBalance | undefined;
  pathResult: SwapPathResult | null;
  account: ActiveAccount | null;
  swapFee: string;
  swapTimeout: number;
  network: NETWORKS;
  navigation: NativeStackNavigationProp<
    SwapStackParamList,
    typeof SWAP_ROUTES.SWAP_AMOUNT_SCREEN
  >;
  resetSwap: () => void;
}

interface UseSwapTransactionResult {
  isProcessing: boolean;
  executeSwap: () => Promise<void>;
  prepareSwapTransaction: () => Promise<void>;
  handleProcessingScreenClose: () => void;
  sourceToken: NativeToken | AssetToken;
  destinationToken: NativeToken | AssetToken;
}

export const useSwapTransaction = ({
  sourceAmount,
  sourceBalance,
  destinationBalance,
  pathResult,
  account,
  swapFee,
  swapTimeout,
  network,
  navigation,
  resetSwap,
}: SwapTransactionParams): UseSwapTransactionResult => {
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    buildSwapTransaction,
    signTransaction,
    submitTransaction,
    resetTransaction,
  } = useTransactionBuilderStore();

  const prepareSwapTransaction = async () => {
    if (
      !sourceBalance ||
      !destinationBalance ||
      !pathResult ||
      !account?.publicKey
    ) {
      return;
    }

    try {
      await buildSwapTransaction({
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
    } catch (error) {
      logger.error(
        "SwapTransaction",
        "Failed to prepare swap transaction",
        error,
      );
      throw error;
    }
  };

  const executeSwap = async () => {
    if (!account) {
      return;
    }

    setIsProcessing(true);

    try {
      signTransaction({
        secretKey: account.privateKey,
        network,
      });

      await submitTransaction({ network });
    } catch (error) {
      logger.error("SwapTransaction", "Swap failed", error);
    }
  };

  const handleProcessingScreenClose = () => {
    setIsProcessing(false);
    resetTransaction();
    resetSwap();

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
    prepareSwapTransaction,
    handleProcessingScreenClose,
    sourceToken,
    destinationToken,
  };
};
