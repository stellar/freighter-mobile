import { NativeStackScreenProps } from "@react-navigation/native-stack";
import FeeSettings from "components/screens/shared/FeeSettings";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useSwapSettingsStore } from "ducks/swapSettings";
import React from "react";

type SwapFeeScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_FEE_SCREEN
>;

const SwapFeeScreen: React.FC<SwapFeeScreenProps> = ({ navigation }) => {
  const { swapFee, saveSwapFee } = useSwapSettingsStore();

  const handleSave = (fee: string) => {
    saveSwapFee(fee);
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <FeeSettings
      currentFee={swapFee}
      onSave={handleSave}
      onGoBack={handleGoBack}
    />
  );
};

export default SwapFeeScreen;
