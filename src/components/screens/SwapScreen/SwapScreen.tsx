/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { TokenSelectionContent } from "components/screens/SwapScreen/components";
import { SWAP_SELECTION_TYPES } from "config/constants";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useSwapStore } from "ducks/swap";
import React, { useMemo } from "react";

type SwapScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_SCREEN
>;

const SwapScreen: React.FC<SwapScreenProps> = ({ navigation, route }) => {
  const {
    setSourceToken,
    setDestinationToken,
    sourceTokenId,
    destinationTokenId,
  } = useSwapStore();
  const { selectionType } = route.params;

  const handleTokenPress = (tokenId: string, tokenSymbol: string) => {
    if (selectionType === SWAP_SELECTION_TYPES.SOURCE) {
      setSourceToken(tokenId, tokenSymbol);
    } else {
      setDestinationToken(tokenId, tokenSymbol);
    }

    navigation.goBack();
  };

  // Exclude the opposite token from the selection list
  const excludeTokenIds = useMemo(() => {
    if (selectionType === SWAP_SELECTION_TYPES.SOURCE) {
      return destinationTokenId ? [destinationTokenId] : [];
    }

    return sourceTokenId ? [sourceTokenId] : [];
  }, [selectionType, destinationTokenId, sourceTokenId]);

  return (
    <BaseLayout insets={{ top: false, bottom: false }}>
      <TokenSelectionContent
        onTokenPress={handleTokenPress}
        excludeTokenIds={excludeTokenIds}
      />
    </BaseLayout>
  );
};

export default SwapScreen;
