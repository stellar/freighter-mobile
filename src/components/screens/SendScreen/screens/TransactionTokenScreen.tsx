import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { TokensCollectiblesInline } from "components/screens/SendScreen/components/TokensCollectiblesInline";
import { TransactionContext } from "config/constants";
import {
  SEND_PAYMENT_ROUTES,
  ScreenTransition,
  SendPaymentStackParamList,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React from "react";
import { View } from "react-native";

type TransactionTokenScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_TOKEN_SCREEN
>;

const TransactionTokenScreen: React.FC<TransactionTokenScreenProps> = ({
  navigation,
  route,
}) => {
  const { saveSelectedTokenId, saveSelectedCollectibleDetails } =
    useTransactionSettingsStore();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const publicKey = account?.publicKey;

  const handleTokenPress = (tokenId: string) => {
    saveSelectedTokenId(tokenId);
    // Clear collectible details when selecting a token to prevent cross-flow contamination
    saveSelectedCollectibleDetails({ collectionAddress: "", tokenId: "" });

    if (route.params?.dismissToPreviousScreen) {
      navigation.goBack();
      return;
    }

    navigation.push(SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN, {
      transition: ScreenTransition.SlideFromRight,
    });
  };

  const handleCollectiblePress = (collectibleDetails: {
    collectionAddress: string;
    tokenId: string;
  }) => {
    saveSelectedCollectibleDetails(collectibleDetails);
    // Clear token selection when selecting a collectible to prevent cross-flow contamination
    saveSelectedTokenId("");

    navigation.push(SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN, {
      transition: ScreenTransition.SlideFromRight,
    });
  };

  return (
    <BaseLayout
      insets={{ top: false, bottom: false, left: false, right: false }}
    >
      <View className="flex-1">
        <TokensCollectiblesInline
          publicKey={publicKey ?? ""}
          network={network}
          onTokenPress={handleTokenPress}
          onCollectiblePress={handleCollectiblePress}
          showSpendableAmount
          feeContext={TransactionContext.Send}
          balanceRowTestIDPrefix="token-option"
        />
      </View>
    </BaseLayout>
  );
};

export default TransactionTokenScreen;
