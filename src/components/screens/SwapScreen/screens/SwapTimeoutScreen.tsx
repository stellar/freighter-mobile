import { NativeStackScreenProps } from "@react-navigation/native-stack";
import TimeoutSettings from "components/screens/shared/TimeoutSettings";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useSwapSettingsStore } from "ducks/swapSettings";
import React from "react";

type SwapTimeoutScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_TIMEOUT_SCREEN
>;

/**
 * SwapTimeoutScreen Component
 *
 * A wrapper screen for swap timeout configuration that uses the generic
 * timeout screen component with swap-specific store integration.
 *
 * @param {SwapTimeoutScreenProps} props - Component props
 * @returns {JSX.Element} The rendered component
 */
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
