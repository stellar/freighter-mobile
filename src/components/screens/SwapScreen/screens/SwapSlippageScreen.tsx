import { NativeStackScreenProps } from "@react-navigation/native-stack";
import SlippageSettings from "components/screens/shared/SlippageSettings";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useSwapSettingsStore } from "ducks/swapSettings";
import React from "react";

type SwapSlippageScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_SLIPPAGE_SCREEN
>;

const SwapSlippageScreen: React.FC<SwapSlippageScreenProps> = ({
  navigation,
}) => {
  const { swapSlippage, saveSwapSlippage } = useSwapSettingsStore();

  const handleSave = (slippage: number) => {
    saveSwapSlippage(slippage);
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <SlippageSettings
      currentSlippage={swapSlippage}
      onSave={handleSave}
      onGoBack={handleGoBack}
    />
  );
};

export default SwapSlippageScreen;
