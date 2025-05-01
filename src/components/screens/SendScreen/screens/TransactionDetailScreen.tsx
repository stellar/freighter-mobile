import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BalancesList } from "components/BalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { ContactRow } from "components/screens/SendScreen/components";
import { Button } from "components/sds/Button";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React from "react";
import { View } from "react-native";

type TransactionDetailScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_DETAIL_SCREEN
>;

const TransactionDetailScreen: React.FC<TransactionDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const { address } = route.params;
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const publicKey = account?.publicKey;

  const handleTokenPress = (tokenId: string) => {
    navigation.navigate(SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN, {
      address,
      tokenId,
    });
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1">
        <View className="rounded-[12px] py-[12px] px-[16px] bg-background-secondary">
          <ContactRow
            address={address}
            showDots={false}
            rightElement={
              <Button
                variant="secondary"
                size="lg"
                onPress={() => navigation.goBack()}
              >
                {t("common.edit")}
              </Button>
            }
          />
        </View>
        <View className="flex-1 mt-[32px]">
          <BalancesList
            publicKey={publicKey ?? ""}
            network={network}
            showTitleIcon
            onTokenPress={handleTokenPress}
          />
        </View>
      </View>
    </BaseLayout>
  );
};

export default TransactionDetailScreen;
