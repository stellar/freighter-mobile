/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { TokenSelectionContent } from "components/screens/SwapScreen/components";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useSwapStore } from "ducks/swap";
import React from "react";

type SwapScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_SCREEN
>;

const SwapScreen: React.FC<SwapScreenProps> = ({ navigation }) => {
  const { setSourceToken } = useSwapStore();

  const handleTokenPress = (tokenId: string, tokenSymbol: string) => {
    setSourceToken(tokenId, tokenSymbol);

    navigation.goBack();
  };

  return (
    <BaseLayout insets={{ top: false, bottom: false }}>
      <TokenSelectionContent onTokenPress={handleTokenPress} />
    </BaseLayout>
  );
};

export default SwapScreen;
