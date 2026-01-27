import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BalanceRow } from "components/BalanceRow";
import BottomSheet from "components/BottomSheet";
import { IconButton } from "components/IconButton";
import NumericKeyboard from "components/NumericKeyboard";
import TransactionSettingsBottomSheet from "components/TransactionSettingsBottomSheet";
import { SecurityDetailBottomSheet } from "components/blockaid";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  SwapReviewBottomSheet,
  SwapReviewFooter,
} from "components/screens/SwapScreen/components";
import { useSwapPathFinding } from "components/screens/SwapScreen/hooks";
import { useSwapTransaction } from "components/screens/SwapScreen/hooks/useSwapTransaction";
import { SwapProcessingScreen } from "components/screens/SwapScreen/screens";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  DEFAULT_DECIMALS,
  NATIVE_TOKEN_CODE,
  SWAP_SELECTION_TYPES,
  TransactionContext,
} from "config/constants";
import { logger } from "config/logger";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useDebugStore } from "ducks/debug";
import { useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import {
  calculateSpendableAmount,
  isAmountSpendable,
  hasXLMForFees,
} from "helpers/balances";
import { useDeviceSize, DeviceSize } from "helpers/deviceSize";
import {
  formatBigNumberForDisplay,
  parseDisplayNumberToBigNumber,
} from "helpers/formatAmount";
import { formatNumericInput } from "helpers/numericInput";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useInitialRecommendedFee } from "hooks/useInitialRecommendedFee";
import { useNetworkFees } from "hooks/useNetworkFees";
import { useRightHeaderButton } from "hooks/useRightHeader";
import { useToast } from "providers/ToastProvider";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { View, Text as RNText, TouchableOpacity } from "react-native";
import { analytics } from "services/analytics";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessTokenSecurity,
  assessTransactionSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";

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
  const { overriddenBlockaidResponse } = useDebugStore();
  const { isBuilding, resetTransaction } = useTransactionBuilderStore();
  const { transactionXDR, transactionHash } = useTransactionBuilderStore();

  const swapReviewBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const transactionSecurityWarningBottomSheetModalRef =
    useRef<BottomSheetModal>(null);
  const transactionSettingsBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const { showToast } = useToast();
  const deviceSize = useDeviceSize();
  const isSmallScreen = deviceSize === DeviceSize.XS;

  const { balanceItems, scanResults } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
  });

  const { recommendedFee } = useNetworkFees();

  const {
    sourceTokenId,
    destinationTokenId,
    sourceTokenSymbol,
    sourceAmount,
    sourceAmountDisplay,
    destinationAmount,
    pathResult,
    isLoadingPath,
    pathError,
    setSourceToken,
    setDestinationToken,
    setSourceAmount,
    setSourceAmountDisplay,

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
      }) &&
      !transactionHash
    ) {
      const errorMessage = t("swapScreen.errors.insufficientBalance", {
        amount: spendableAmount
          ? formatBigNumberForDisplay(spendableAmount, {
              decimalPlaces: DEFAULT_DECIMALS,
            })
          : "0",
        symbol: sourceTokenSymbol,
      });
      setAmountError(errorMessage);
      showToast({
        variant: "error",
        title: t("swapScreen.errors.insufficientBalance", {
          amount: spendableAmount
            ? formatBigNumberForDisplay(spendableAmount, {
                decimalPlaces: DEFAULT_DECIMALS,
              })
            : "0",
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
    transactionHash,
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
    transactionScanResult,
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
      Number(sourceAmount) <= 0 ||
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

  useInitialRecommendedFee(recommendedFee, TransactionContext.Swap);

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

  const navigateToSelectDestinationTokenScreen = useCallback(() => {
    navigation.navigate(SWAP_ROUTES.SWAP_SCREEN, {
      selectionType: SWAP_SELECTION_TYPES.DESTINATION,
    });
  }, [navigation]);

  const navigateToSelectSourceTokenScreen = useCallback(() => {
    navigation.navigate(SWAP_ROUTES.SWAP_SCREEN, {
      selectionType: SWAP_SELECTION_TYPES.SOURCE,
    });
  }, [navigation]);

  const handleDisplayAmountChange = useCallback(
    (key: string) => {
      const newAmount = formatNumericInput(
        sourceAmountDisplay,
        key,
        DEFAULT_DECIMALS,
      );
      // Update display value immediately to preserve formatting
      setSourceAmountDisplay(newAmount);
      // Convert locale-formatted input to internal dot notation
      const internalAmount = parseDisplayNumberToBigNumber(newAmount);
      // Update internal value for calculations, preserving display value
      setSourceAmount(internalAmount.toString(), true);
    },
    [setSourceAmount, setSourceAmountDisplay, sourceAmountDisplay],
  );

  const handlePercentagePress = useCallback(
    (percentage: number) => {
      if (!spendableAmount) return;

      if (percentage === 100) {
        if (spendableAmount) {
          analytics.track(AnalyticsEvent.SEND_PAYMENT_SET_MAX);
          setSourceAmount(spendableAmount.toString());
        }
      } else {
        const targetAmount = spendableAmount.multipliedBy(percentage / 100);
        setSourceAmount(targetAmount.toFixed(DEFAULT_DECIMALS));
      }
    },
    [spendableAmount, setSourceAmount],
  );

  const prepareSwapTransaction = useCallback(
    async (shouldOpenReview = false) => {
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
    },
    [setupSwapTransaction, t, showToast],
  );

  const handleConfirmSwap = useCallback(() => {
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
  }, [executeSwap, t, showToast]);

  const handleOpenSettings = useCallback(() => {
    transactionSettingsBottomSheetModalRef.current?.present();
  }, []);

  const handleConfirmTransactionSettings = useCallback(() => {
    transactionSettingsBottomSheetModalRef.current?.dismiss();
  }, []);

  const handleCancelTransactionSettings = useCallback(() => {
    transactionSettingsBottomSheetModalRef.current?.dismiss();
  }, []);

  const handleSettingsChange = useCallback(() => {
    // Settings have changed, rebuild the swap transaction with new values
    prepareSwapTransaction(false);
  }, [prepareSwapTransaction]);

  const transactionSecurityAssessment = useMemo(
    () =>
      assessTransactionSecurity(
        transactionScanResult,
        overriddenBlockaidResponse,
      ),
    [transactionScanResult, overriddenBlockaidResponse],
  );

  const sourceBalanceSecurityAssessment = useMemo(
    () =>
      assessTokenSecurity(
        sourceBalance
          ? scanResults[sourceBalance.id.replace(":", "-")]
          : undefined,
        overriddenBlockaidResponse,
      ),
    [sourceBalance, scanResults, overriddenBlockaidResponse],
  );

  const destBalanceSecurityAssessment = useMemo(
    () =>
      assessTokenSecurity(
        destinationBalance
          ? scanResults[destinationBalance.id.replace(":", "-")]
          : undefined,
        overriddenBlockaidResponse,
      ),
    [destinationBalance, scanResults, overriddenBlockaidResponse],
  );

  const showSecurityWarningForSource = useMemo(
    () =>
      sourceBalanceSecurityAssessment.isUnableToScan &&
      sourceTokenId !== NATIVE_TOKEN_CODE,
    [sourceBalanceSecurityAssessment.isUnableToScan, sourceTokenId],
  );

  const showSecurityWarningForDestination = useMemo(
    () =>
      destBalanceSecurityAssessment.isUnableToScan &&
      destinationTokenId !== NATIVE_TOKEN_CODE,
    [destBalanceSecurityAssessment.isUnableToScan, destinationTokenId],
  );

  const handleMainButtonPress = useCallback(async () => {
    if (destinationBalance) {
      const isUnableToScan =
        showSecurityWarningForSource || showSecurityWarningForDestination;

      if (isUnableToScan) {
        await prepareSwapTransaction(false);
        transactionSecurityWarningBottomSheetModalRef.current?.present();
      } else {
        await prepareSwapTransaction(true);
      }
    } else {
      navigateToSelectDestinationTokenScreen();
    }
  }, [
    destinationBalance,
    prepareSwapTransaction,
    navigateToSelectDestinationTokenScreen,
    showSecurityWarningForDestination,
    showSecurityWarningForSource,
  ]);

  // Reset everything on unmount
  useEffect(
    () => () => {
      resetSwap();
      resetTransaction();
      resetToDefaults();
    },
    [resetSwap, resetTransaction, resetToDefaults],
  );

  const handleCancelSecurityWarning = () => {
    transactionSecurityWarningBottomSheetModalRef.current?.dismiss();
  };

  const securityWarnings = useMemo(() => {
    const warnings = [];

    // Add warnings for malicious and suspicious cases
    if (
      transactionSecurityAssessment.isMalicious ||
      transactionSecurityAssessment.isSuspicious ||
      sourceBalanceSecurityAssessment.isMalicious ||
      sourceBalanceSecurityAssessment.isSuspicious ||
      destBalanceSecurityAssessment.isMalicious ||
      destBalanceSecurityAssessment.isSuspicious
    ) {
      const extractedWarnings = [
        ...extractSecurityWarnings(transactionScanResult),
        ...Object.values(scanResults).map(extractSecurityWarnings),
      ].flat();

      if (Array.isArray(extractedWarnings) && extractedWarnings.length > 0) {
        warnings.push(...extractedWarnings);
      }
    }

    if (showSecurityWarningForSource) {
      warnings.push({
        id: "unable-to-scan-source",
        description: t("blockaid.unableToScan.sourceToken"),
      });
    }

    if (showSecurityWarningForDestination) {
      warnings.push({
        id: "unable-to-scan-destination",
        description: t("blockaid.unableToScan.destinationToken"),
      });
    }

    return warnings;
  }, [
    transactionSecurityAssessment.isMalicious,
    transactionSecurityAssessment.isSuspicious,
    sourceBalanceSecurityAssessment.isMalicious,
    sourceBalanceSecurityAssessment.isSuspicious,
    destBalanceSecurityAssessment.isMalicious,
    destBalanceSecurityAssessment.isSuspicious,
    showSecurityWarningForDestination,
    showSecurityWarningForSource,
    transactionScanResult,
    scanResults,
    t,
  ]);

  const { isMalicious: isTxMalicious, isSuspicious: isTxSuspicious } =
    transactionSecurityAssessment;
  const { isMalicious: isSourceMalicious, isSuspicious: isSourceSuspicious } =
    sourceBalanceSecurityAssessment;
  const { isMalicious: isDestMalicious, isSuspicious: isDestSuspicious } =
    destBalanceSecurityAssessment;
  const isMalicious = isTxMalicious || isSourceMalicious || isDestMalicious;
  const isSuspicious = isTxSuspicious || isSourceSuspicious || isDestSuspicious;

  const isUnableToScan =
    showSecurityWarningForSource || showSecurityWarningForDestination;

  const transactionSecuritySeverity = useMemo(() => {
    if (transactionSecurityAssessment.isMalicious)
      return SecurityLevel.MALICIOUS;
    if (transactionSecurityAssessment.isSuspicious)
      return SecurityLevel.SUSPICIOUS;
    if (isUnableToScan) return SecurityLevel.UNABLE_TO_SCAN;

    return undefined;
  }, [
    transactionSecurityAssessment.isMalicious,
    transactionSecurityAssessment.isSuspicious,
    isUnableToScan,
  ]);

  const handleConfirmAnyway = () => {
    transactionSecurityWarningBottomSheetModalRef.current?.dismiss();

    const isUnableToScanConfirm =
      showSecurityWarningForSource || showSecurityWarningForDestination;

    if (isUnableToScanConfirm) {
      swapReviewBottomSheetModalRef.current?.present();
    } else {
      handleConfirmSwap();
    }
  };

  const handleCancelSwap = useCallback(() => {
    swapReviewBottomSheetModalRef.current?.dismiss();
  }, []);

  const footerProps = useMemo(
    () => ({
      onCancel: handleCancelSwap,
      onConfirm: handleConfirmSwap,
      isBuilding,
      isMalicious,
      isSuspicious,
      transactionXDR: transactionXDR ?? undefined,
      onSettingsPress: handleOpenSettings,
    }),
    [
      handleCancelSwap,
      handleConfirmSwap,
      isBuilding,
      isMalicious,
      isSuspicious,
      transactionXDR,
      handleOpenSettings,
    ],
  );

  const renderFooterComponent = useCallback(
    () => <SwapReviewFooter {...footerProps} />,
    [footerProps],
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
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1" testID="swap-amount-screen">
        <View className="flex-none items-center py-[24px] max-xs:py-[16px] px-6">
          <View className="flex-row items-center gap-1">
            <Display
              size={isSmallScreen ? "lg" : "xl"}
              medium
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.6}
            >
              {sourceAmountDisplay}{" "}
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
                scanResult={scanResults[sourceBalance.id.replace(":", "-")]}
                onPress={navigateToSelectSourceTokenScreen}
                spendableAmount={spendableAmount || undefined}
                testID="swap-from-token-row"
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
                scanResult={
                  scanResults[destinationBalance.id.replace(":", "-")]
                }
                onPress={navigateToSelectDestinationTokenScreen}
                testID="swap-to-token-row"
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
                testID="swap-to-choose-token"
              >
                <View className="flex-row items-center flex-1 mr-4">
                  <View className="flex-row items-center gap-16px">
                    <View className="w-[40px] h-[40px] rounded-full border justify-center items-center mr-4 bg-gray-3 border-gray-6 p-[7.5px]">
                      <Icon.Plus size={25} themeColor="gray" />
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
            <NumericKeyboard onPress={handleDisplayAmountChange} />
          </View>
          <View className="w-full mt-auto mb-4">
            <Button
              tertiary
              onPress={handleMainButtonPress}
              disabled={isButtonDisabled}
              isLoading={isLoadingPath || isBuilding}
              testID="swap-continue-button"
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
        snapPoints={["80%"]}
        scrollable
        analyticsEvent={AnalyticsEvent.VIEW_SWAP_CONFIRM}
        customContent={
          <SwapReviewBottomSheet
            transactionScanResult={transactionScanResult}
            sourceTokenScanResult={
              sourceBalance
                ? scanResults[sourceBalance.id.replace(":", "-")]
                : undefined
            }
            destTokenScanResult={
              destinationBalance
                ? scanResults[destinationBalance.id.replace(":", "-")]
                : undefined
            }
            onSecurityWarningPress={() =>
              transactionSecurityWarningBottomSheetModalRef.current?.present()
            }
          />
        }
        renderFooterComponent={renderFooterComponent}
      />
      <BottomSheet
        modalRef={transactionSecurityWarningBottomSheetModalRef}
        handleCloseModal={handleCancelSecurityWarning}
        customContent={
          <SecurityDetailBottomSheet
            warnings={securityWarnings}
            onCancel={handleCancelSecurityWarning}
            onProceedAnyway={handleConfirmAnyway}
            onClose={handleCancelSecurityWarning}
            severity={transactionSecuritySeverity}
            proceedAnywayText={
              isUnableToScan
                ? t("common.continue")
                : t("transactionAmountScreen.confirmAnyway")
            }
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
            context={TransactionContext.Swap}
            onCancel={handleCancelTransactionSettings}
            onConfirm={handleConfirmTransactionSettings}
            onSettingsChange={handleSettingsChange}
          />
        }
      />
    </BaseLayout>
  );
};

export default SwapAmountScreen;
