import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BalanceRow } from "components/BalanceRow";
import BottomSheet from "components/BottomSheet";
import { IconButton } from "components/IconButton";
import NumericKeyboard from "components/NumericKeyboard";
import TransactionSettingsBottomSheet from "components/TransactionSettingsBottomSheet";
import { BaseLayout } from "components/layout/BaseLayout";
import { SwapReviewBottomSheet } from "components/screens/SwapScreen/components";
import { useSwapPathFinding } from "components/screens/SwapScreen/hooks";
import { useSwapTransaction } from "components/screens/SwapScreen/hooks/useSwapTransaction";
import { SwapProcessingScreen } from "components/screens/SwapScreen/screens";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  DEFAULT_DECIMALS,
  SWAP_SELECTION_TYPES,
  TransactionSettingsContext,
} from "config/constants";
import { logger } from "config/logger";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import {
  calculateSpendableAmount,
  isAmountSpendable,
  hasXLMForFees,
} from "helpers/balances";
import { useDeviceSize, DeviceSize } from "helpers/deviceSize";
import { pxValue } from "helpers/dimensions";
import {
  formatBigNumberForLocale,
  parseLocaleNumberToBigNumber,
} from "helpers/formatAmount";
import { formatNumericInput } from "helpers/numericInput";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useRightHeaderButton } from "hooks/useRightHeader";
import { useToast } from "providers/ToastProvider";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text as RNText, TouchableOpacity } from "react-native";
import { analytics } from "services/analytics";

type SwapAmountScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_AMOUNT_SCREEN
>;

const SwapAmountScreen: React.FC<SwapAmountScreenProps> = ({
  navigation,
  route,
}) => {
  const { tokenId: swapFromTokenId, tokenSymbol: swapFromTokenSymbol } =
    route.params;
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { swapFee, swapSlippage, resetToDefaults } = useSwapSettingsStore();
  const { isBuilding, resetTransaction } = useTransactionBuilderStore();

  const swapReviewBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const transactionSettingsBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const { showToast } = useToast();
  const deviceSize = useDeviceSize();
  const isSmallScreen = deviceSize === DeviceSize.XS;

  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    shouldPoll: false,
  });

  const {
    sourceTokenId,
    destinationTokenId,
    sourceTokenSymbol,
    sourceAmount,
    destinationAmount,
    pathResult,
    isLoadingPath,
    pathError,
    setSourceToken,
    setDestinationToken,
    setSourceAmount,
    resetSwap,
  } = useSwapStore();

  const sourceBalance = useMemo(
    () => balanceItems.find((item) => item.id === sourceTokenId),
    [balanceItems, sourceTokenId],
  );

  const destinationBalance = useMemo(
    () => balanceItems.find((item) => item.id === destinationTokenId),
    [balanceItems, destinationTokenId],
  );

  const spendableAmount = useMemo(() => {
    if (!sourceBalance || !account) return null;

    return calculateSpendableAmount({
      balance: sourceBalance,
      subentryCount: account.subentryCount || 0,
      transactionFee: swapFee,
    });
  }, [sourceBalance, account, swapFee]);

  useEffect(() => {
    if (!sourceBalance || !sourceAmount || sourceAmount === "0") {
      setAmountError(null);
      return;
    }

    if (!hasXLMForFees(balanceItems, swapFee)) {
      const errorMessage = t("swapScreen.errors.insufficientXlmForFees", {
        fee: swapFee,
      });
      setAmountError(errorMessage);
      showToast({
        variant: "error",
        title: t("swapScreen.errors.insufficientXlmForFees", {
          fee: swapFee,
        }),
        toastId: "insufficient-xlm-for-fees",
        duration: 3000,
      });
      return;
    }

    if (
      !isAmountSpendable({
        amount: sourceAmount,
        balance: sourceBalance,
        subentryCount: account?.subentryCount,
        transactionFee: swapFee,
      })
    ) {
      const errorMessage = t("swapScreen.errors.insufficientBalance", {
        amount: spendableAmount?.toFixed() || "0",
        symbol: sourceTokenSymbol,
      });
      setAmountError(errorMessage);
      showToast({
        variant: "error",
        title: t("swapScreen.errors.insufficientBalance", {
          amount: spendableAmount?.toFixed() || "0",
          symbol: sourceTokenSymbol,
        }),
        toastId: "insufficient-balance",
        duration: 3000,
      });
    } else {
      setAmountError(null);
    }
  }, [
    sourceAmount,
    spendableAmount,
    sourceTokenSymbol,
    t,
    account?.subentryCount,
    swapFee,
    sourceBalance,
    balanceItems,
    showToast,
  ]);

  useSwapPathFinding({
    sourceBalance,
    destinationBalance,
    sourceAmount,
    swapSlippage,
    network,
    publicKey: account?.publicKey,
    amountError,
  });

  const {
    isProcessing,
    executeSwap,
    setupSwapTransaction,
    handleProcessingScreenClose,
    sourceToken,
    destinationToken,
  } = useSwapTransaction({
    sourceAmount,
    sourceBalance,
    destinationBalance,
    pathResult,
    account,
    network,
    navigation,
  });

  const isButtonDisabled = destinationBalance
    ? isBuilding ||
      !!amountError ||
      !!pathError ||
      parseLocaleNumberToBigNumber(sourceAmount).isLessThanOrEqualTo(0) ||
      !pathResult
    : false;

  useEffect(() => {
    if (swapFromTokenId && swapFromTokenSymbol) {
      setSourceToken(swapFromTokenId, swapFromTokenSymbol);
      setSourceAmount("0");
      setDestinationToken("", "");
    }
  }, [
    swapFromTokenId,
    swapFromTokenSymbol,
    setSourceToken,
    setSourceAmount,
    setDestinationToken,
  ]);

  useEffect(() => {
    if (swapError) {
      setSwapError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceAmount, pathResult]);

  useRightHeaderButton({
    icon: Icon.Settings04,
    onPress: () => {
      transactionSettingsBottomSheetModalRef.current?.present();
    },
  });

  const navigateToSelectDestinationTokenScreen = () => {
    navigation.navigate(SWAP_ROUTES.SWAP_SCREEN, {
      selectionType: SWAP_SELECTION_TYPES.DESTINATION,
    });
  };

  const navigateToSelectSourceTokenScreen = () => {
    navigation.navigate(SWAP_ROUTES.SWAP_SCREEN, {
      selectionType: SWAP_SELECTION_TYPES.SOURCE,
    });
  };

  const handleAmountChange = (key: string) => {
    const newAmount = formatNumericInput(sourceAmount, key, DEFAULT_DECIMALS);
    setSourceAmount(newAmount);
  };

  const handleSetMax = () => {
    if (spendableAmount) {
      analytics.track(AnalyticsEvent.SEND_PAYMENT_SET_MAX);

      // Use locale-aware formatting for the max amount
      setSourceAmount(
        formatBigNumberForLocale(spendableAmount, {
          decimalPlaces: DEFAULT_DECIMALS,
          useGrouping: false,
        }),
      );
    }
  };

  const handlePercentagePress = (percentage: number) => {
    if (!spendableAmount) return;

    if (percentage === 100) {
      handleSetMax();
    } else {
      const targetAmount = spendableAmount.multipliedBy(percentage / 100);
      // Use locale-aware formatting for the amount
      setSourceAmount(
        formatBigNumberForLocale(targetAmount, {
          decimalPlaces: DEFAULT_DECIMALS,
          useGrouping: false,
        }),
      );
    }
  };

  const prepareSwapTransaction = async (shouldOpenReview = false) => {
    try {
      await setupSwapTransaction();

      if (shouldOpenReview) {
        swapReviewBottomSheetModalRef.current?.present();
      }
    } catch (error) {
      logger.error(
        "SwapAmountScreen",
        "Failed to setup swap transaction:",
        error,
      );

      const errorMessage = t("swapScreen.errors.failedToSetupTransaction");
      setSwapError(errorMessage);
      showToast({
        variant: "error",
        title: t("swapScreen.errors.failedToSetupTransaction"),
        toastId: "failed-to-setup-transaction",
        duration: 3000,
      });
    }
  };

  const handleConfirmSwap = () => {
    swapReviewBottomSheetModalRef.current?.dismiss();

    setTimeout(() => {
      executeSwap().catch((error) => {
        logger.error("SwapAmountScreen", "Swap transaction failed:", error);

        const errorMessage = t("swapScreen.errors.swapTransactionFailed");
        setSwapError(errorMessage);
        showToast({
          variant: "error",
          title: t("swapScreen.errors.swapTransactionFailed"),
          toastId: "swap-transaction-failed",
          duration: 3000,
        });
      });
    }, 100);
  };

  const handleOpenSettings = () => {
    transactionSettingsBottomSheetModalRef.current?.present();
  };

  const handleCancelSettings = () => {
    transactionSettingsBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmSettings = () => {
    transactionSettingsBottomSheetModalRef.current?.dismiss();
  };

  const handleSettingsChange = () => {
    // Settings have changed, rebuild the transaction with new values
    prepareSwapTransaction(false);
  };

  const handleMainButtonPress = () => {
    if (destinationBalance) {
      prepareSwapTransaction(true);
    } else {
      navigateToSelectDestinationTokenScreen();
    }
  };

  // Reset everything on unmount
  useEffect(
    () => () => {
      resetSwap();
      resetTransaction();
      resetToDefaults();
    },
    [resetSwap, resetTransaction, resetToDefaults],
  );

  if (isProcessing) {
    return (
      <SwapProcessingScreen
        onClose={handleProcessingScreenClose}
        sourceAmount={sourceAmount}
        sourceToken={sourceToken}
        destinationAmount={destinationAmount || "0"}
        destinationToken={destinationToken}
      />
    );
  }

  return (
    <BaseLayout useKeyboardAvoidingView insets={{ top: false }}>
      <View className="flex-1">
        <View className="flex-none items-center py-[24px] max-xs:py-[16px] px-6">
          <View className="flex-row items-center gap-1">
            <Display
              size={isSmallScreen ? "lg" : "xl"}
              medium
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.6}
            >
              {sourceAmount}{" "}
              <RNText style={{ color: themeColors.text.secondary }}>
                {sourceTokenSymbol}
              </RNText>
            </Display>
          </View>
        </View>

        <View className="flex-none gap-3 mt-[16px]">
          <View className="rounded-[16px] py-[12px] px-[16px] bg-background-tertiary">
            {sourceBalance && (
              <BalanceRow
                isSingleRow
                balance={sourceBalance}
                onPress={navigateToSelectSourceTokenScreen}
                rightContent={
                  <IconButton
                    Icon={Icon.ChevronRight}
                    size="sm"
                    variant="ghost"
                  />
                }
              />
            )}
          </View>

          <View className="rounded-[16px] py-[12px] px-[16px] bg-background-tertiary">
            {destinationBalance ? (
              <BalanceRow
                isSingleRow
                balance={destinationBalance}
                onPress={navigateToSelectDestinationTokenScreen}
                rightContent={
                  <IconButton
                    Icon={Icon.ChevronRight}
                    size="sm"
                    variant="ghost"
                  />
                }
              />
            ) : (
              <TouchableOpacity
                className="flex-row w-full h-[44px] justify-between items-center"
                onPress={navigateToSelectDestinationTokenScreen}
              >
                <View className="flex-row items-center flex-1 mr-4">
                  <View className="flex-row items-center gap-16px">
                    <View className="w-[40px] h-[40px] rounded-full border justify-center items-center mr-4 bg-gray-3 border-gray-6 p-[7.5px]">
                      <Icon.Plus size={pxValue(25)} themeColor="gray" />
                    </View>
                    <View className="flex-col flex-1">
                      <Text>{t("swapScreen.receive")}</Text>
                      <Text sm secondary>
                        {t("swapScreen.chooseToken")}
                      </Text>
                    </View>
                  </View>
                </View>
                <IconButton
                  Icon={Icon.ChevronRight}
                  size="sm"
                  variant="ghost"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View className="flex-1 items-center mt-[24px] gap-[24px]">
          <View className="flex-row gap-[8px]">
            <View className="flex-1">
              <Button secondary onPress={() => handlePercentagePress(25)}>
                {t("transactionAmountScreen.percentageButtons.twentyFive")}
              </Button>
            </View>
            <View className="flex-1">
              <Button secondary onPress={() => handlePercentagePress(50)}>
                {t("transactionAmountScreen.percentageButtons.fifty")}
              </Button>
            </View>
            <View className="flex-1">
              <Button secondary onPress={() => handlePercentagePress(75)}>
                {t("transactionAmountScreen.percentageButtons.seventyFive")}
              </Button>
            </View>
            <View className="flex-1">
              <Button secondary onPress={() => handlePercentagePress(100)}>
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
              onPress={handleMainButtonPress}
              disabled={isButtonDisabled}
              isLoading={isLoadingPath || isBuilding}
            >
              {destinationBalance
                ? t("common.review")
                : t("swapScreen.selectToken")}
            </Button>
          </View>
        </View>
      </View>

      <BottomSheet
        modalRef={swapReviewBottomSheetModalRef}
        handleCloseModal={() =>
          swapReviewBottomSheetModalRef.current?.dismiss()
        }
        snapPoints={["90%"]}
        analyticsEvent={AnalyticsEvent.VIEW_SWAP_CONFIRM}
        customContent={
          <SwapReviewBottomSheet
            onCancel={() => swapReviewBottomSheetModalRef.current?.dismiss()}
            onConfirm={handleConfirmSwap}
            onSettingsPress={handleOpenSettings}
          />
        }
      />

      <BottomSheet
        modalRef={transactionSettingsBottomSheetModalRef}
        handleCloseModal={() =>
          transactionSettingsBottomSheetModalRef.current?.dismiss()
        }
        customContent={
          <TransactionSettingsBottomSheet
            context={TransactionSettingsContext.Swap}
            onCancel={handleCancelSettings}
            onConfirm={handleConfirmSettings}
            onSettingsChange={handleSettingsChange}
          />
        }
      />
    </BaseLayout>
  );
};

export default SwapAmountScreen;
