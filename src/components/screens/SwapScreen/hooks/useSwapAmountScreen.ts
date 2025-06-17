import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { createSwapMenuActions } from "components/screens/SwapScreen/helpers";
import { useSwapAmountValidation } from "components/screens/SwapScreen/hooks/useSwapAmountValidation";
import { useSwapButtonState } from "components/screens/SwapScreen/hooks/useSwapButtonState";
import { useSwapTransaction } from "components/screens/SwapScreen/hooks/useSwapTransaction";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { calculateSpendableAmount } from "helpers/balances";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useEffect, useMemo } from "react";

interface UseSwapAmountScreenParams {
  swapFromTokenId: string;
  swapFromTokenSymbol: string;
  navigation: NativeStackNavigationProp<SwapStackParamList, typeof SWAP_ROUTES.SWAP_AMOUNT_SCREEN>;
}

/**
 * Simplified hook for SwapAmountScreen following TransactionAmountScreen pattern
 * 
 * This hook now focuses only on:
 * - Coordinating between stores and other hooks
 * - Screen-specific navigation logic
 * - UI state management
 * 
 * Business logic is delegated to:
 * - useSwapStore for swap state
 * - useSwapSettingsStore for settings
 * - useSwapTransaction for transaction operations
 * - useSwapAmountValidation for validation
 * - useSwapButtonState for button state
 */
export const useSwapAmountScreen = ({
  swapFromTokenId,
  swapFromTokenSymbol,
  navigation,
}: UseSwapAmountScreenParams) => {
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { swapFee, swapTimeout, swapSlippage } = useSwapSettingsStore();

  // Get balances
  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    shouldPoll: false,
  });

  // Swap store state
  const {
    fromTokenId,
    toTokenId,
    fromTokenSymbol,
    toTokenSymbol,
    swapAmount,
    destinationAmount,
    pathResult,
    isLoadingPath,
    pathError,
    setFromToken,
    setToToken,
    setSwapAmount,
    findSwapPath,
    clearPath,
    resetSwap,
  } = useSwapStore();

  // Get token balances
  const swapFromTokenBalance = balanceItems.find(
    (item) => item.id === fromTokenId,
  );
  const swapToTokenBalance = balanceItems.find(
    (item) => item.id === toTokenId,
  );

  // Use validation hook
  const { amountError } = useSwapAmountValidation({
    swapAmount,
    swapFromTokenBalance,
    subentryCount: account?.subentryCount,
    swapFee,
    fromTokenSymbol,
  });

  // Use transaction hook
  const {
    isProcessing,
    executeSwap,
    prepareSwapTransaction,
    handleProcessingScreenClose,
    fromToken,
    toToken,
  } = useSwapTransaction({
    swapAmount,
    swapFromTokenBalance,
    swapToTokenBalance,
    pathResult,
    account,
    swapFee,
    swapTimeout,
    network,
    navigation,
    resetSwap,
  });

  // Use button state hook
  const { buttonText, isDisabled: isButtonDisabled, action } = useSwapButtonState({
    swapToTokenBalance,
    isLoadingPath,
    isBuilding: false, // Transaction building is now handled by useSwapTransactionFlow
    amountError,
    pathError,
    swapAmount,
    pathResult,
  });

  // Initialize from token on mount
  useEffect(() => {
    if (swapFromTokenId && swapFromTokenSymbol) {
      setFromToken(swapFromTokenId, swapFromTokenSymbol);
      setSwapAmount("0");
      setToToken("", ""); // Clear to token for fresh swap
    }
  }, [swapFromTokenId, swapFromTokenSymbol, setFromToken, setSwapAmount, setToToken]);

  // Auto-find swap path when conditions are met
  useEffect(() => {
    if (
      swapFromTokenBalance &&
      swapToTokenBalance &&
      swapAmount &&
      Number(swapAmount) > 0 &&
      !amountError &&
      account?.publicKey
    ) {
      findSwapPath({
        fromBalance: swapFromTokenBalance,
        toBalance: swapToTokenBalance,
        amount: swapAmount,
        slippage: swapSlippage,
        network,
        publicKey: account.publicKey,
      });
    } else {
      clearPath();
    }
  }, [
    swapFromTokenBalance,
    swapToTokenBalance,
    swapAmount,
    swapSlippage,
    network,
    account?.publicKey,
    amountError,
    findSwapPath,
    clearPath,
  ]);

  // Create menu actions
  const menuActions = useMemo(
    () => createSwapMenuActions(
      navigation,
      swapFee,
      swapTimeout,
      swapSlippage,
      SWAP_ROUTES
    ),
    [navigation, swapFee, swapSlippage, swapTimeout],
  );

  // Screen-specific handlers
  const handleTokenSelect = (tokenId: string, tokenSymbol: string) => {
    setToToken(tokenId, tokenSymbol);
  };

  const handleSetMax = () => {
    if (swapFromTokenBalance && account) {
      const spendableAmount = calculateSpendableAmount(
        swapFromTokenBalance,
        account.subentryCount || 0,
        swapFee,
      );
      setSwapAmount(spendableAmount.toString());
    }
  };

  return {
    // State
    isProcessing,
    amountError,
    swapAmount,
    destinationAmount,
    fromTokenSymbol,
    toTokenSymbol,
    swapFromTokenBalance,
    swapToTokenBalance,
    pathResult,
    isLoadingPath,
    pathError,
    network,
    
    // Actions
    setSwapAmount,
    handleTokenSelect,
    handleSetMax,
    executeSwap,
    prepareSwapTransaction,
    handleProcessingScreenClose,
    
    // UI state
    buttonText,
    isButtonDisabled,
    action,
    menuActions,
    
    // Processing tokens
    fromToken,
    toToken,
  };
}; 