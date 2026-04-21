import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { TokensCollectiblesTabs } from "components/TokensCollectiblesTabs";
import { BaseLayout } from "components/layout/BaseLayout";
import { TransactionContext } from "config/constants";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
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
}) => {
  const {
    recipientAddress,
    saveSelectedTokenId,
    saveSelectedCollectibleDetails,
  } = useTransactionSettingsStore();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const publicKey = account?.publicKey;

  const handleTokenPress = (tokenId: string) => {
    saveSelectedTokenId(tokenId);
    // Clear collectible details when selecting a token to prevent cross-flow contamination
    saveSelectedCollectibleDetails({ collectionAddress: "", tokenId: "" });

    navigation.goBack();
  };

  const handleCollectiblePress = (collectibleDetails: {
    collectionAddress: string;
    tokenId: string;
  }) => {
    saveSelectedCollectibleDetails(collectibleDetails);
    // Clear token selection when selecting a collectible to prevent cross-flow contamination
    saveSelectedTokenId("");

    if (recipientAddress) {
      navigation.navigate(
        SEND_PAYMENT_ROUTES.SEND_COLLECTIBLE_REVIEW,
        collectibleDetails,
      );
    } else {
      navigation.navigate(SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN);
    }
  };

  return (
    <BaseLayout
      insets={{ top: false, bottom: false, left: false, right: false }}
    >
      <View className="flex-1">
        <TokensCollectiblesTabs
          showTokensSettings={false}
          showCollectiblesSettings={false}
          publicKey={publicKey ?? ""}
          network={network}
          onTokenPress={handleTokenPress}
          onCollectiblePress={handleCollectiblePress}
          showSpendableAmount
          feeContext={TransactionContext.Send}
        />
      </View>
    </BaseLayout>
  );
};

export default TransactionTokenScreen;
