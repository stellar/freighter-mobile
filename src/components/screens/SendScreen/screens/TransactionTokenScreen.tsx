import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { IconButton } from "components/IconButton";
import { TokensCollectiblesTabs } from "components/TokensCollectiblesTabs";
import { BaseLayout } from "components/layout/BaseLayout";
import { ContactRow } from "components/screens/SendScreen/components";
import Icon from "components/sds/Icon";
import { DEFAULT_PADDING } from "config/constants";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { pxValue } from "helpers/dimensions";
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
  const { recipientAddress, saveSelectedTokenId } =
    useTransactionSettingsStore();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const publicKey = account?.publicKey;

  const handleTokenPress = (tokenId: string) => {
    saveSelectedTokenId(tokenId);

    navigation.goBack();
  };

  const navigateToSelectContactScreen = () => {
    navigation.navigate(SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN);
  };

  return (
    <BaseLayout
      insets={{ top: false, bottom: false, left: false, right: false }}
    >
      <View className="flex-1">
        <View
          className="rounded-[16px] py-[12px] max-xs:py-[8px] px-[16px] bg-background-tertiary"
          style={{ marginHorizontal: pxValue(DEFAULT_PADDING) }}
        >
          <ContactRow
            isSingleRow
            onPress={navigateToSelectContactScreen}
            address={recipientAddress}
            rightElement={
              <IconButton Icon={Icon.ChevronRight} size="sm" variant="ghost" />
            }
          />
        </View>
        <View className="flex-1 mt-[16px]">
          <TokensCollectiblesTabs
            hideCollectibles
            showTokensSettings={false}
            publicKey={publicKey ?? ""}
            network={network}
            onTokenPress={handleTokenPress}
          />
        </View>
      </View>
    </BaseLayout>
  );
};

export default TransactionTokenScreen;
