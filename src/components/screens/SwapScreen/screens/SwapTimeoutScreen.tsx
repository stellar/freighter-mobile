import { NativeStackScreenProps } from "@react-navigation/native-stack";
import TimeoutSettings from "components/screens/shared/TimeoutSettings";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useSwapSettingsStore } from "ducks/swapSettings";
import React from "react";

type SwapTimeoutScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_TIMEOUT_SCREEN
>;

const SwapTimeoutScreen: React.FC<SwapTimeoutScreenProps> = ({
  navigation,
}) => {
  const { swapTimeout, saveSwapTimeout } = useSwapSettingsStore();

  const handleSave = (timeout: number) => {
    saveSwapTimeout(timeout);
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <TimeoutSettings
      currentTimeout={swapTimeout}
      onSave={handleSave}
      onGoBack={handleGoBack}
    />
  );
};

export default SwapTimeoutScreen;
