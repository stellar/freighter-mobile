import { NativeStackScreenProps } from "@react-navigation/native-stack";
import FeeSettings from "components/screens/shared/FeeSettings";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useSwapSettingsStore } from "ducks/swapSettings";
import React from "react";

type SwapFeeScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_FEE_SCREEN
>;

/**
 * SwapFeeScreen Component
 *
 * A wrapper screen for swap fee configuration that uses the generic
 * fee screen component with swap-specific store integration.
 *
 * @param {SwapFeeScreenProps} props - Component props
 * @returns {JSX.Element} The rendered component
 */
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
