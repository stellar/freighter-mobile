import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { TokensCollectiblesInline } from "components/TokensCollectiblesInline";
import { BaseLayout } from "components/layout/BaseLayout";
import { TransactionContext } from "config/constants";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import useAppTranslation from "hooks/useAppTranslation";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useLayoutEffect } from "react";
import { View } from "react-native";

type TransactionTokenScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_TOKEN_SCREEN
>;

const TransactionTokenScreen: React.FC<TransactionTokenScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const { saveSelectedTokenId, saveSelectedCollectibleDetails } =
    useTransactionSettingsStore();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const publicKey = account?.publicKey;

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("transactionTokenScreen.title") });
  }, [navigation, t]);

  const handleTokenPress = (tokenId: string) => {
    saveSelectedTokenId(tokenId);
    // Clear collectible details when selecting a token to prevent cross-flow contamination
    saveSelectedCollectibleDetails({ collectionAddress: "", tokenId: "" });

    if (route.params?.returnToAmount) {
      navigation.goBack();
      return;
    }

    navigation.navigate(SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN);
  };

  const handleCollectiblePress = (collectibleDetails: {
    collectionAddress: string;
    tokenId: string;
  }) => {
    saveSelectedCollectibleDetails(collectibleDetails);
    // Clear token selection when selecting a collectible to prevent cross-flow contamination
    saveSelectedTokenId("");

    navigation.navigate(
      SEND_PAYMENT_ROUTES.SEND_COLLECTIBLE_REVIEW,
      collectibleDetails,
    );
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
          balanceRowTestIDPrefix="send-token-option"
        />
      </View>
    </BaseLayout>
  );
};

export default TransactionTokenScreen;
