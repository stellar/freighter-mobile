/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { TokenSelectionContent } from "components/screens/SwapScreen/components";
import { descriptorFromBalance } from "components/screens/SwapScreen/helpers";
import { SWAP_SELECTION_TYPES, TransactionContext } from "config/constants";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapStore } from "ducks/swap";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
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
    destinationToken,
  } = useSwapStore();
  const { selectionType } = route.params;
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
  });

  const handleTokenPress = (tokenId: string, tokenSymbol: string) => {
    if (selectionType === SWAP_SELECTION_TYPES.SOURCE) {
      setSourceToken(tokenId, tokenSymbol);
    } else {
      // TODO(Task 12): SwapToScreen replaces this picker and dispatches
      // descriptors directly. Until then, resolve the balance from
      // balanceItems and project it to a descriptor (held-balance flow only).
      const balance = balanceItems.find((b) => b.id === tokenId);
      if (balance) {
        setDestinationToken(descriptorFromBalance(balance));
      }
    }

    navigation.goBack();
  };

  // Exclude the opposite token from the selection list
  const excludeTokenIds = useMemo(() => {
    if (selectionType === SWAP_SELECTION_TYPES.SOURCE) {
      return destinationToken ? [destinationToken.id] : [];
    }

    return sourceTokenId ? [sourceTokenId] : [];
  }, [selectionType, destinationToken, sourceTokenId]);

  return (
    <BaseLayout insets={{ top: false, bottom: false }}>
      <TokenSelectionContent
        onTokenPress={handleTokenPress}
        excludeTokenIds={excludeTokenIds}
        showSpendableAmount
        feeContext={TransactionContext.Swap}
      />
    </BaseLayout>
  );
};

export default SwapScreen;
