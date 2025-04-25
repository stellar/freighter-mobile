/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BalanceRow } from "components/BalanceRow";
import { BaseLayout } from "components/layout/BaseLayout";
import { ContactRow } from "components/screens/SendPaymentScreen/ContactRow";
import NumericKeyboard from "components/screens/SendPaymentScreen/NumericKeyboard";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { formatAssetAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect } from "react";
import { TouchableOpacity, View } from "react-native";

type TransactionValueScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_VALUE_SCREEN
>;

const TransactionValueScreen: React.FC<TransactionValueScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const { address, tokenId } = route.params;
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const publicKey = account?.publicKey;
  const [value, setValue] = React.useState("0.00");

  const { balanceItems } = useBalancesList({
    publicKey: publicKey ?? "",
    network,
    shouldPoll: false,
  });

  const selectedBalance = balanceItems.find((item) => item.id === tokenId);

  const handleKeyboardPress = (key: string) => {
    if (key === "") {
      // Handle delete
      setValue((prev) => {
        if (prev === "0.00") return "0.00";
        // Remove the decimal point and work with the whole string
        const withoutDecimal = prev.replace(".", "");
        // Remove the last digit
        const newStr = withoutDecimal.slice(0, -1);
        // If we have no digits left, return 0.00
        if (newStr === "" || newStr === "0") return "0.00";
        // Add leading zeros if needed
        const paddedStr = newStr.padStart(3, "0");
        // Insert the decimal point
        return `${paddedStr.slice(0, -2)}.${paddedStr.slice(-2)}`;
      });
    } else {
      // Handle number input
      setValue((prev) => {
        // Remove the decimal point and work with the whole string
        const withoutDecimal = prev.replace(".", "");
        // If we're at 0.00, just start with the new digit
        if (withoutDecimal === "000") {
          return `0.0${key}`;
        }
        // Add the new digit
        const newStr = withoutDecimal + key;
        // Insert the decimal point
        return `${newStr.slice(0, -2)}.${newStr.slice(-2)}`;
      });
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => {}}>
          <Icon.Settings04 size={24} color={THEME.colors.base.secondary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1">
        <View className="items-center gap-[12px]">
          <View className="rounded-[12px] gap-[8px] py-[32px] px-[24px]">
            <Display
              lg
              medium
              {...(Number(value) > 0 ? { primary: true } : { secondary: true })}
            >
              {formatAssetAmount(value, selectedBalance?.tokenCode)}
            </Display>
            <View className="flex-row items-center justify-center">
              <Text lg medium secondary>
                $0.00
              </Text>
              <TouchableOpacity className="ml-2">
                <Icon.RefreshCcw03
                  size={16}
                  color={THEME.colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
          </View>
          <View className="rounded-[12px] py-[12px] px-[16px] bg-background-secondary">
            {selectedBalance && (
              <BalanceRow
                balance={selectedBalance}
                rightContent={
                  <Button
                    variant="secondary"
                    size="lg"
                    onPress={() => navigation.goBack()}
                  >
                    {t("common.edit")}
                  </Button>
                }
                isSingleRow
              />
            )}
          </View>
          <View className="rounded-[12px] py-[12px] px-[16px] bg-background-secondary">
            <ContactRow
              address={address}
              showDots={false}
              rightElement={
                <Button
                  variant="secondary"
                  size="lg"
                  onPress={() =>
                    navigation.navigate(SEND_PAYMENT_ROUTES.SEND_PAYMENT_SCREEN)
                  }
                >
                  {t("common.edit")}
                </Button>
              }
            />
          </View>
        </View>
        <View className="flex-1 items-center mt-[24px] gap-[24px]">
          <View className="p-[8px]">
            <View className="flex-row gap-[8px]">
              <View style={{ width: 82.5 }}>
                <Button variant="secondary" size="lg" onPress={() => {}}>
                  25%
                </Button>
              </View>
              <View style={{ width: 82.5 }}>
                <Button variant="secondary" size="lg" onPress={() => {}}>
                  50%
                </Button>
              </View>
              <View style={{ width: 82.5 }}>
                <Button variant="secondary" size="lg" onPress={() => {}}>
                  75%
                </Button>
              </View>
              <View style={{ width: 82.5 }}>
                <Button variant="secondary" size="lg" onPress={() => {}}>
                  Max
                </Button>
              </View>
            </View>
          </View>
          <View className="w-full">
            <NumericKeyboard onPress={handleKeyboardPress} />
          </View>
        </View>
      </View>
    </BaseLayout>
  );
};

export default TransactionValueScreen;
