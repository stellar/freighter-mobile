/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BalanceRow } from "components/BalanceRow";
import BottomSheet from "components/BottomSheet";
import ContextMenuButton from "components/ContextMenuButton";
import NumericKeyboard from "components/NumericKeyboard";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  ContactRow,
  SendReviewBottomSheet,
} from "components/screens/SendScreen/components";
import { TransactionProcessingScreen } from "components/screens/SendScreen/screens";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import {
  MAIN_TAB_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  SEND_PAYMENT_ROUTES,
  SendPaymentStackParamList,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { formatAssetAmount, formatFiatAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useTokenFiatConverter } from "hooks/useTokenFiatConverter";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";

type TransactionAmountScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN
>;

/**
 * TransactionAmountScreen Component
 *
 * A screen for entering transaction amounts in either token or fiat currency.
 * Supports switching between token and fiat input modes with automatic conversion.
 *
 * @param {TransactionAmountScreenProps} props - Component props
 * @returns {JSX.Element} The rendered component
 */
const TransactionAmountScreen: React.FC<TransactionAmountScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { address, tokenId } = route.params;
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { transactionMemo, transactionFee, transactionTimeout, resetSettings } =
    useTransactionSettingsStore();

  const publicKey = account?.publicKey;
  const reviewBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset transaction settings when entering the screen
  useEffect(() => {
    resetSettings();
  }, [resetSettings]);

  const navigateToSendScreen = () => {
    try {
      navigation.popTo(SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN);
    } catch (error) {
      navigation.popToTop();
    }
  };

  const { balanceItems } = useBalancesList({
    publicKey: publicKey ?? "",
    network,
    shouldPoll: false,
  });

  const selectedBalance = balanceItems.find((item) => item.id === tokenId);

  const {
    tokenAmount,
    fiatAmount,
    showFiatAmount,
    setShowFiatAmount,
    handleAmountChange,
    handlePercentagePress,
  } = useTokenFiatConverter({ selectedBalance });

  const menuActions = useMemo(
    () => [
      {
        title: t("transactionAmountScreen.menu.fee", { fee: transactionFee }),
        systemIcon: "arrow.trianglehead.swap",
        onPress: () => {
          navigation.navigate(SEND_PAYMENT_ROUTES.TRANSACTION_FEE_SCREEN);
        },
      },
      {
        title: t("transactionAmountScreen.menu.timeout", {
          timeout: transactionTimeout,
        }),
        systemIcon: "clock",
        onPress: () => {
          navigation.navigate(SEND_PAYMENT_ROUTES.TRANSACTION_TIMEOUT_SCREEN);
        },
      },
      {
        title: transactionMemo
          ? t("transactionAmountScreen.menu.editMemo")
          : t("transactionAmountScreen.menu.addMemo"),
        systemIcon: "text.page",
        onPress: () => {
          navigation.navigate(SEND_PAYMENT_ROUTES.TRANSACTION_MEMO_SCREEN);
        },
      },
    ],
    [t, navigation, transactionFee, transactionTimeout, transactionMemo],
  );

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <ContextMenuButton
          contextMenuProps={{
            actions: menuActions,
          }}
        >
          <Icon.Settings04 size={24} color={themeColors.base[1]} />
        </ContextMenuButton>
      ),
    });
  }, [navigation, menuActions, themeColors]);

  const handleTransactionConfirmation = () => {
    reviewBottomSheetModalRef.current?.dismiss();
    setIsProcessing(true);
    // TODO: Implement the actual transaction submission logic here
  };

  if (isProcessing) {
    return (
      <TransactionProcessingScreen
        selectedBalance={selectedBalance}
        tokenValue={tokenAmount}
        address={address}
        onClose={() => {
          setIsProcessing(false);
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [
                {
                  name: ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK,
                  state: {
                    index: 0,
                    routes: [{ name: MAIN_TAB_ROUTES.TAB_HISTORY }],
                  },
                },
              ],
            }),
          );
        }}
      />
    );
  }

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1">
        <View className="items-center gap-[12px]">
          <View className="rounded-[12px] gap-[8px] py-[32px] px-[24px]">
            <Display
              lg
              medium
              {...(Number(showFiatAmount ? fiatAmount : tokenAmount) > 0
                ? { primary: true }
                : { secondary: true })}
            >
              {showFiatAmount
                ? formatFiatAmount(fiatAmount)
                : formatAssetAmount(tokenAmount, selectedBalance?.tokenCode)}
            </Display>
            <View className="flex-row items-center justify-center">
              <Text lg medium secondary>
                {showFiatAmount
                  ? formatAssetAmount(tokenAmount, selectedBalance?.tokenCode)
                  : formatFiatAmount(fiatAmount)}
              </Text>
              <TouchableOpacity
                className="ml-2"
                onPress={() => setShowFiatAmount(!showFiatAmount)}
              >
                <Icon.RefreshCcw03
                  size={16}
                  color={themeColors.text.secondary}
                />
              </TouchableOpacity>
            </View>
          </View>
          <View className="rounded-[12px] py-[12px] px-[16px] bg-background-secondary">
            {selectedBalance && (
              <BalanceRow
                balance={selectedBalance}
                rightContent={
                  <Button secondary lg onPress={() => navigation.goBack()}>
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
              rightElement={
                <Button secondary lg onPress={navigateToSendScreen}>
                  {t("common.edit")}
                </Button>
              }
            />
          </View>
        </View>
        <View className="flex-1 items-center mt-[24px] gap-[24px]">
          <View className="flex-row gap-[8px]">
            <View className="flex-1">
              <Button secondary lg onPress={() => handlePercentagePress(25)}>
                {t("transactionAmountScreen.percentageButtons.twentyFive")}
              </Button>
            </View>
            <View className="flex-1">
              <Button secondary lg onPress={() => handlePercentagePress(50)}>
                {t("transactionAmountScreen.percentageButtons.fifty")}
              </Button>
            </View>
            <View className="flex-1">
              <Button secondary lg onPress={() => handlePercentagePress(75)}>
                {t("transactionAmountScreen.percentageButtons.seventyFive")}
              </Button>
            </View>
            <View className="flex-1">
              <Button secondary lg onPress={() => handlePercentagePress(100)}>
                {t("transactionAmountScreen.percentageButtons.max")}
              </Button>
            </View>
          </View>
          <View className="w-full">
            <NumericKeyboard onPress={handleAmountChange} />
          </View>
          <View className="w-full mt-auto mb-4">
            <Button
              tertiary
              xl
              onPress={() => reviewBottomSheetModalRef.current?.present()}
              disabled={Number(tokenAmount) <= 0}
            >
              {t("transactionAmountScreen.reviewButton")}
            </Button>
          </View>
        </View>
      </View>

      <BottomSheet
        modalRef={reviewBottomSheetModalRef}
        handleCloseModal={() => reviewBottomSheetModalRef.current?.dismiss()}
        customContent={
          <SendReviewBottomSheet
            selectedBalance={selectedBalance}
            tokenValue={tokenAmount}
            address={address}
            account={account}
            publicKey={publicKey}
            onCancel={() => reviewBottomSheetModalRef.current?.dismiss()}
            onConfirm={handleTransactionConfirmation}
          />
        }
        bottomSheetModalProps={{ enablePanDownToClose: true }}
        snapPoints={["80%"]}
      />
    </BaseLayout>
  );
};

export default TransactionAmountScreen;
