/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BigNumber } from "bignumber.js";
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
import { DEFAULT_DECIMALS, FIAT_DECIMALS } from "config/constants";
import { logger } from "config/logger";
import {
  SEND_PAYMENT_ROUTES,
  SendPaymentStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  MAIN_TAB_ROUTES,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { calculateSpendableAmount } from "helpers/balances";
import { formatAssetAmount, formatFiatAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useTokenFiatConverter } from "hooks/useTokenFiatConverter";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { TouchableOpacity, View, Text as RNText } from "react-native";

// Define amount error types
enum AmountError {
  TOO_HIGH = "amount too high",
  // DEC_MAX handled by formatNumericInput
  // SEND_MAX is less critical for mobile? (Extension has it)
}

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
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const {
    transactionMemo,
    transactionFee,
    transactionTimeout,
    recipientAddress,
    selectedTokenId,
  } = useTransactionSettingsStore();

  const {
    buildTransaction,
    signTransaction,
    submitTransaction,
    resetTransaction,
    isBuilding,
  } = useTransactionBuilderStore();

  const publicKey = account?.publicKey;
  const reviewBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [amountError, setAmountError] = useState<AmountError | null>(null);

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

  const selectedBalance = balanceItems.find(
    (item) => item.id === selectedTokenId,
  );

  const {
    tokenAmount,
    fiatAmount,
    showFiatAmount,
    setShowFiatAmount,
    handleAmountChange,
    setTokenAmount,
    setFiatAmount,
  } = useTokenFiatConverter({ selectedBalance });

  const spendableBalance = useMemo(() => {
    if (!selectedBalance || !account) return BigNumber(0);

    return calculateSpendableAmount({
      balance: selectedBalance,
      subentryCount: account.subentryCount,
      transactionFee,
    });
  }, [selectedBalance, account, transactionFee]);

  const handlePercentagePress = (percentage: number) => {
    if (!selectedBalance) return;

    let targetAmount: BigNumber;

    if (percentage === 100) {
      targetAmount = spendableBalance;
    } else {
      const totalBalance = BigNumber(selectedBalance.total);
      targetAmount = totalBalance.multipliedBy(percentage / 100);
    }

    if (showFiatAmount) {
      const tokenPrice = selectedBalance.currentPrice || BigNumber(0);
      const calculatedFiatAmount = targetAmount.multipliedBy(tokenPrice);
      setFiatAmount(calculatedFiatAmount.toFixed(FIAT_DECIMALS));
    } else {
      setTokenAmount(targetAmount.toFixed(DEFAULT_DECIMALS));
    }
  };

  useEffect(() => {
    const currentTokenAmount = BigNumber(tokenAmount);

    // Check if amount exceeds available balance
    if (
      spendableBalance &&
      currentTokenAmount.isGreaterThan(spendableBalance)
    ) {
      setAmountError(AmountError.TOO_HIGH);
    } else {
      setAmountError(null);
    }
  }, [tokenAmount, spendableBalance]);

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

  const handleOpenReview = async () => {
    try {
      await buildTransaction({
        tokenAmount,
        selectedBalance,
        recipientAddress,
        transactionMemo,
        transactionFee,
        transactionTimeout,
        network,
        senderAddress: publicKey,
      });

      reviewBottomSheetModalRef.current?.present();
    } catch (error) {
      logger.error(
        "TransactionAmountScreen",
        "Failed to build transaction:",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const handleTransactionConfirmation = () => {
    reviewBottomSheetModalRef.current?.dismiss();

    // Wait for the bottom sheet to dismiss before showing the processing screen
    setTimeout(() => {
      setIsProcessing(true);
    }, 100);

    const processTransaction = async () => {
      try {
        if (!account) {
          throw new Error("Unable to retrieve account");
        }

        const { privateKey } = account;

        if (!privateKey) {
          throw new Error("Unable to retrieve account secret key");
        }

        signTransaction({
          secretKey: privateKey,
          network,
        });

        await submitTransaction({
          network,
        });
      } catch (error) {
        logger.error(
          "TransactionAmountScreen",
          "Transaction submission failed:",
          error instanceof Error ? error.message : String(error),
        );
      }
    };

    processTransaction();
  };

  const handleProcessingScreenClose = () => {
    setIsProcessing(false);
    resetTransaction();

    navigation.reset({
      index: 0,
      routes: [
        {
          // @ts-expect-error: Cross-stack navigation to MainTabStack with History tab
          name: ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK,
          state: {
            routes: [{ name: MAIN_TAB_ROUTES.TAB_HISTORY }],
            index: 0,
          },
        },
      ],
    });
  };

  if (isProcessing) {
    return (
      <TransactionProcessingScreen
        key={selectedTokenId}
        onClose={handleProcessingScreenClose}
        transactionAmount={tokenAmount}
        selectedBalance={selectedBalance}
      />
    );
  }

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1">
        <View className="items-center gap-[12px] max-xs:gap-[6px]">
          <View className="rounded-[12px] gap-[8px] max-xs:gap-[4px] py-[32px] max-xs:py-[16px] px-[24px] max-xs:px-[16px] items-center">
            {showFiatAmount ? (
              <Display
                xl
                medium
                adjustsFontSizeToFit
                numberOfLines={1}
                minimumFontScale={0.6}
                {...(Number(fiatAmount) > 0
                  ? { primary: true }
                  : { secondary: true })}
              >
                {formatFiatAmount(fiatAmount)}
              </Display>
            ) : (
              <View className="flex-row items-center gap-[4px]">
                <Display
                  xl
                  medium
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  minimumFontScale={0.6}
                  {...(Number(tokenAmount) > 0
                    ? { primary: true }
                    : { secondary: true })}
                >
                  {tokenAmount}{" "}
                  <RNText style={{ color: themeColors.text.secondary }}>
                    {selectedBalance?.tokenCode}
                  </RNText>
                </Display>
              </View>
            )}
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
          <View className="rounded-[12px] py-[12px] max-xs:py-[8px] px-[16px] bg-background-secondary">
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
          <View className="rounded-[12px] py-[12px] max-xs:py-[8px] px-[16px] bg-background-secondary">
            <ContactRow
              address={recipientAddress}
              rightElement={
                <Button secondary lg onPress={navigateToSendScreen}>
                  {t("common.edit")}
                </Button>
              }
            />
          </View>
        </View>
        <View className="flex-1 items-center mt-[24px] max-xs:mt-[12px] gap-[24px] max-xs:gap-[12px]">
          <View className="flex-row gap-[8px] max-xs:gap-[4px]">
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
          <View className="w-full mt-auto mb-4 max-xs:mb-2">
            <Button
              tertiary
              xl
              onPress={handleOpenReview}
              disabled={
                !!amountError ||
                BigNumber(tokenAmount).isLessThanOrEqualTo(0) ||
                isBuilding
              }
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
            tokenAmount={tokenAmount}
            onCancel={() => reviewBottomSheetModalRef.current?.dismiss()}
            onConfirm={handleTransactionConfirmation}
          />
        }
      />
    </BaseLayout>
  );
};

export default TransactionAmountScreen;
