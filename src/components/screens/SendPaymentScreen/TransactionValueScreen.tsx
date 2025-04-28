/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BigNumber } from "bignumber.js";
import { BalanceRow } from "components/BalanceRow";
import ContextMenuButton from "components/ContextMenuButton";
import { BaseLayout } from "components/layout/BaseLayout";
import { ContactRow } from "components/screens/SendPaymentScreen/ContactRow";
import NumericKeyboard from "components/screens/SendPaymentScreen/NumericKeyboard";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { formatAssetAmount, formatFiatAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useTokenFiatConverter } from "hooks/useTokenFiatConverter";
import React, { useEffect, useMemo } from "react";
import { TouchableOpacity, View } from "react-native";

type TransactionValueScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_VALUE_SCREEN
>;

/**
 * TransactionValueScreen Component
 *
 * A screen for entering transaction values in either token or fiat currency.
 * Supports switching between token and fiat input modes with automatic conversion.
 *
 * @param {TransactionValueScreenProps} props - Component props
 * @returns {JSX.Element} The rendered component
 */
const TransactionValueScreen: React.FC<TransactionValueScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const { address, tokenId } = route.params;
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const publicKey = account?.publicKey;

  const { balanceItems } = useBalancesList({
    publicKey: publicKey ?? "",
    network,
    shouldPoll: false,
  });

  const selectedBalance = balanceItems.find((item) => item.id === tokenId);

  const {
    tokenValue,
    fiatValue,
    showDollarValue,
    setShowDollarValue,
    handleValueChange,
    handlePercentagePress,
  } = useTokenFiatConverter({ selectedBalance });

  const menuActions = useMemo(
    () => [
      {
        title: t("transactionValueScreen.menu.fee", { fee: "0.025" }),
        systemIcon: "arrow.trianglehead.swap",
        onPress: () => {},
      },
      {
        title: t("transactionValueScreen.menu.timeout", { timeout: "180" }),
        systemIcon: "clock",
        onPress: () => {
          navigation.navigate(SEND_PAYMENT_ROUTES.TRANSACTION_TIMEOUT_SCREEN, {
            address,
            tokenId,
          });
        },
      },
      {
        title: t("transactionValueScreen.menu.addMemo"),
        systemIcon: "text.page",
        onPress: () => {
          navigation.navigate(SEND_PAYMENT_ROUTES.MEMO_SCREEN, {
            address,
            tokenId,
          });
        },
      },
    ],
    [t, navigation, address, tokenId],
  );

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <ContextMenuButton
          contextMenuProps={{
            actions: menuActions,
          }}
        >
          <Icon.Settings04 size={24} color={THEME.colors.base.secondary} />
        </ContextMenuButton>
      ),
    });
  }, [navigation, menuActions]);

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1">
        <View className="items-center gap-[12px]">
          <View className="rounded-[12px] gap-[8px] py-[32px] px-[24px]">
            <Display
              lg
              medium
              {...(Number(showDollarValue ? fiatValue : tokenValue) > 0
                ? { primary: true }
                : { secondary: true })}
            >
              {showDollarValue
                ? formatFiatAmount(new BigNumber(fiatValue))
                : formatAssetAmount(tokenValue, selectedBalance?.tokenCode)}
            </Display>
            <View className="flex-row items-center justify-center">
              <Text lg medium secondary>
                {showDollarValue
                  ? formatAssetAmount(tokenValue, selectedBalance?.tokenCode)
                  : formatFiatAmount(new BigNumber(fiatValue))}
              </Text>
              <TouchableOpacity
                className="ml-2"
                onPress={() => setShowDollarValue(!showDollarValue)}
              >
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
                <Button
                  variant="secondary"
                  size="lg"
                  onPress={() => handlePercentagePress(25)}
                >
                  {t("transactionValueScreen.percentageButtons.twentyFive")}
                </Button>
              </View>
              <View style={{ width: 82.5 }}>
                <Button
                  variant="secondary"
                  size="lg"
                  onPress={() => handlePercentagePress(50)}
                >
                  {t("transactionValueScreen.percentageButtons.fifty")}
                </Button>
              </View>
              <View style={{ width: 82.5 }}>
                <Button
                  variant="secondary"
                  size="lg"
                  onPress={() => handlePercentagePress(75)}
                >
                  {t("transactionValueScreen.percentageButtons.seventyFive")}
                </Button>
              </View>
              <View style={{ width: 82.5 }}>
                <Button
                  variant="secondary"
                  size="lg"
                  onPress={() => handlePercentagePress(100)}
                >
                  {t("transactionValueScreen.percentageButtons.max")}
                </Button>
              </View>
            </View>
          </View>
          <View className="w-full">
            <NumericKeyboard onPress={handleValueChange} />
          </View>
          <View className="w-full">
            <Button variant="tertiary" size="xl" onPress={() => {}}>
              {t("transactionValueScreen.reviewButton")}
            </Button>
          </View>
        </View>
      </View>
    </BaseLayout>
  );
};

export default TransactionValueScreen;
