import useAppTranslation from "hooks/useAppTranslation";

interface SwapButtonStateParams {
  swapToTokenBalance: any; // PricedBalance or undefined
  isLoadingPath: boolean;
  isBuilding: boolean;
  amountError: string | null;
  pathError: string | null;
  swapAmount: string;
  pathResult: any; // SwapPathResult or null
}

interface SwapButtonState {
  buttonText: string;
  isDisabled: boolean;
  action: "selectAsset" | "review";
}

export const useSwapButtonState = ({
  swapToTokenBalance,
  isLoadingPath,
  isBuilding,
  amountError,
  pathError,
  swapAmount,
  pathResult,
}: SwapButtonStateParams): SwapButtonState => {
  const { t } = useAppTranslation();

  // Determine the action based on whether an asset is selected
  const action = swapToTokenBalance ? "review" : "selectAsset";

  // Calculate button text
  const getButtonText = (): string => {
    if (!swapToTokenBalance) {
      return t("swapScreen.selectAsset");
    }
    
    if (isLoadingPath) {
      return t("common.loading");
    }
    
    // Once an asset is selected, always show "Review"
    return t("common.review");
  };

  // Calculate disabled state
  const getIsDisabled = (): boolean => {
    // If no asset selected, button should work to open token selector
    if (!swapToTokenBalance) {
      return false;
    }

    // If asset is selected, disable for various validation reasons
    return (
      isBuilding ||
      isLoadingPath ||
      !!amountError ||
      !!pathError ||
      Number(swapAmount) <= 0 ||
      !pathResult // No valid swap path found
    );
  };

  return {
    buttonText: getButtonText(),
    isDisabled: getIsDisabled(),
    action,
  };
}; 