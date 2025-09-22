import Blockaid from "@blockaid/client";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BigNumber } from "bignumber.js";
import { BalanceRow } from "components/BalanceRow";
import BottomSheet from "components/BottomSheet";
import { IconButton } from "components/IconButton";
import InformationBottomSheet from "components/InformationBottomSheet";
import NumericKeyboard from "components/NumericKeyboard";
import TransactionSettingsBottomSheet from "components/TransactionSettingsBottomSheet";
import SecurityDetailBottomSheet from "components/blockaid/SecurityDetailBottomSheet";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  ContactRow,
  SendReviewBottomSheet,
} from "components/screens/SendScreen/components";
import { TransactionProcessingScreen } from "components/screens/SendScreen/screens";
import { useSignTransactionDetails } from "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  DEFAULT_DECIMALS,
  FIAT_DECIMALS,
  TransactionSettingsContext,
} from "config/constants";
import { logger } from "config/logger";
import {
  SEND_PAYMENT_ROUTES,
  SendPaymentStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  MAIN_TAB_ROUTES,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useHistoryStore } from "ducks/history";
import { useSendRecipientStore } from "ducks/sendRecipient";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { calculateSpendableAmount, hasXLMForFees } from "helpers/balances";
import { useDeviceSize, DeviceSize } from "helpers/deviceSize";
import {
  formatFiatAmount,
  formatBigNumberForLocale,
  formatTokenAmount,
} from "helpers/formatAmount";
import { useBlockaidTransaction } from "hooks/blockaid/useBlockaidTransaction";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useRightHeaderButton } from "hooks/useRightHeader";
import { useTokenFiatConverter } from "hooks/useTokenFiatConverter";
import { useValidateTransactionMemo } from "hooks/useValidateTransactionMemo";
import { useToast } from "providers/ToastProvider";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TouchableOpacity, View, Text as RNText } from "react-native";
import { analytics } from "services/analytics";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessTransactionSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";

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
  const { tokenId, recipientAddress: routeRecipientAddress } = route.params;
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const {
    transactionFee,
    recipientAddress,
    selectedTokenId,
    saveSelectedTokenId,
    saveRecipientAddress,
    saveMemo,
    resetSettings,
  } = useTransactionSettingsStore();

  const { resetSendRecipient } = useSendRecipientStore();
  const { fetchAccountHistory } = useHistoryStore();

  useEffect(() => {
    if (tokenId) {
      saveSelectedTokenId(tokenId);
    }
  }, [tokenId, saveSelectedTokenId]);

  useEffect(() => {
    if (routeRecipientAddress && typeof routeRecipientAddress === "string") {
      saveRecipientAddress(routeRecipientAddress);
    }
  }, [routeRecipientAddress, saveRecipientAddress]);

  const {
    buildTransaction,
    signTransaction,
    submitTransaction,
    resetTransaction,
    isBuilding,
    transactionXDR,
  } = useTransactionBuilderStore();

  // Reset everything on unmount
  useEffect(
    () => () => {
      saveSelectedTokenId("");
      resetSendRecipient();
      resetSettings();
      resetTransaction();
    },
    [resetSettings, resetSendRecipient, saveSelectedTokenId, resetTransaction],
  );

  const { isValidatingMemo, isMemoMissing } =
    useValidateTransactionMemo(transactionXDR);

  const { scanTransaction } = useBlockaidTransaction();

  const publicKey = account?.publicKey;
  const reviewBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const { showToast } = useToast();
  const deviceSize = useDeviceSize();
  const isSmallScreen = deviceSize === DeviceSize.XS;
  const addMemoExplanationBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const transactionSettingsBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [transactionScanResult, setTransactionScanResult] = useState<
    Blockaid.StellarTransactionScanResponse | undefined
  >(undefined);
  const transactionSecurityWarningBottomSheetModalRef =
    useRef<BottomSheetModal>(null);
  const signTransactionDetails = useSignTransactionDetails({
    xdr: transactionXDR ?? "",
  });

  const onConfirmAddMemo = () => {
    reviewBottomSheetModalRef.current?.dismiss();
    transactionSettingsBottomSheetModalRef.current?.present();
  };

  const onCancelAddMemo = () => {
    addMemoExplanationBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmTransactionSettings = () => {
    transactionSettingsBottomSheetModalRef.current?.dismiss();
  };

  const handleOpenSettingsFromReview = () => {
    transactionSettingsBottomSheetModalRef.current?.present();
  };

  const handleCancelTransactionSettings = () => {
    addMemoExplanationBottomSheetModalRef.current?.dismiss();
    transactionSettingsBottomSheetModalRef.current?.dismiss();
  };

  const navigateToSelectTokenScreen = () => {
    navigation.navigate(SEND_PAYMENT_ROUTES.TRANSACTION_TOKEN_SCREEN);
  };

  const navigateToSelectContactScreen = () => {
    navigation.navigate(SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN);
  };

  const { balanceItems } = useBalancesList({
    publicKey: publicKey ?? "",
    network,
  });

  const selectedBalance = balanceItems.find(
    (item) => item.id === selectedTokenId,
  );

  const isRequiredMemoMissing = isMemoMissing && !isValidatingMemo;

  const transactionSecurityAssessment = useMemo(
    () => assessTransactionSecurity(transactionScanResult),
    [transactionScanResult],
  );

  const {
    tokenAmount,
    tokenAmountInternal,
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

      analytics.track(AnalyticsEvent.SEND_PAYMENT_SET_MAX);
    } else {
      const totalBalance = BigNumber(selectedBalance.total);
      targetAmount = totalBalance.multipliedBy(percentage / 100);
    }

    if (showFiatAmount) {
      const tokenPrice = selectedBalance.currentPrice || BigNumber(0);
      const calculatedFiatAmount = targetAmount.multipliedBy(tokenPrice);
      // Use locale-aware formatting for fiat amount
      setFiatAmount(
        formatBigNumberForLocale(calculatedFiatAmount, {
          decimalPlaces: FIAT_DECIMALS,
          useGrouping: false,
        }),
      );
    } else {
      // Use locale-aware formatting for token amount
      setTokenAmount(
        formatBigNumberForLocale(targetAmount, {
          decimalPlaces: DEFAULT_DECIMALS,
          useGrouping: false,
        }),
      );
    }
  };

  useEffect(() => {
    const currentTokenAmount = BigNumber(tokenAmount);

    if (!hasXLMForFees(balanceItems, transactionFee)) {
      const errorMessage = t(
        "transactionAmountScreen.errors.insufficientXlmForFees",
        {
          fee: transactionFee,
        },
      );
      setAmountError(errorMessage);
      showToast({
        variant: "error",
        title: t("transactionAmountScreen.errors.insufficientXlmForFees", {
          fee: transactionFee,
        }),
        toastId: "insufficient-xlm-for-fees",
        duration: 3000,
      });
      return;
    }

    if (
      spendableBalance &&
      currentTokenAmount.isGreaterThan(spendableBalance)
    ) {
      const errorMessage = t("transactionAmountScreen.errors.amountTooHigh");
      setAmountError(errorMessage);
      showToast({
        variant: "error",
        title: t("transactionAmountScreen.errors.amountTooHigh"),
        toastId: "amount-too-high",
        duration: 3000,
      });
    } else {
      setAmountError(null);
    }
  }, [
    tokenAmount,
    spendableBalance,
    balanceItems,
    transactionFee,
    t,
    showToast,
  ]);

  useRightHeaderButton({
    icon: Icon.Settings04,
    onPress: () => {
      transactionSettingsBottomSheetModalRef.current?.present();
    },
  });

  const prepareTransaction = useCallback(
    async (shouldOpenReview = false) => {
      if (!recipientAddress || !selectedBalance) {
        return;
      }

      try {
        // Get fresh settings values each time the function is called
        const {
          transactionMemo,
          transactionFee: freshTransactionFee,
          transactionTimeout,
          recipientAddress: storeRecipientAddress,
        } = useTransactionSettingsStore.getState();

        // Use internal value (already in dot notation) for transaction building

        const finalXDR = await buildTransaction({
          tokenAmount: tokenAmountInternal,
          selectedBalance,
          recipientAddress: storeRecipientAddress,
          transactionMemo,
          transactionFee: freshTransactionFee,
          transactionTimeout,
          network,
          senderAddress: publicKey,
        });

        if (!finalXDR) return;

        if (shouldOpenReview) {
          scanTransaction(finalXDR, "internal")
            .then((scanResult) => {
              logger.info("TransactionAmountScreen", "scanResult", scanResult);
              setTransactionScanResult(scanResult);
            })
            .catch(() => {
              setTransactionScanResult(undefined);
            })
            .finally(() => {
              reviewBottomSheetModalRef.current?.present();
            });
        }
      } catch (error) {
        logger.error(
          "TransactionAmountScreen",
          "Failed to build transaction:",
          error,
        );
      }
    },
    [
      tokenAmountInternal,
      selectedBalance,
      network,
      publicKey,
      buildTransaction,
      scanTransaction,
      recipientAddress,
    ],
  );

  const handleSettingsChange = () => {
    // Settings have changed, rebuild the transaction with new values
    prepareTransaction(false);
  };

  const handleTransactionConfirmation = () => {
    setIsProcessing(true);
    reviewBottomSheetModalRef.current?.dismiss();

    const processTransaction = async () => {
      try {
        if (!account?.privateKey || !selectedBalance || !recipientAddress) {
          throw new Error("Missing account or balance information");
        }

        const { privateKey } = account;

        signTransaction({
          secretKey: privateKey,
          network,
        });

        const success = await submitTransaction({
          network,
        });

        if (success) {
          analytics.trackSendPaymentSuccess({
            sourceToken: selectedBalance?.tokenCode || "unknown",
          });
        } else {
          analytics.trackTransactionError({
            error: "Transaction failed",
            transactionType: "payment",
          });
        }
      } catch (error) {
        logger.error(
          "TransactionAmountScreen",
          "Transaction submission failed:",
          error,
        );

        analytics.trackTransactionError({
          error: error instanceof Error ? error.message : String(error),
          transactionType: "payment",
        });
      }
    };

    processTransaction();
    saveMemo("");
  };

  const handleProcessingScreenClose = () => {
    setIsProcessing(false);
    resetTransaction();

    if (account?.publicKey) {
      fetchAccountHistory({
        publicKey: account.publicKey,
        network,
        isBackgroundRefresh: true,
        hasRecentTransaction: true,
      });
    }

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

  const handleCancelSecurityWarning = () => {
    transactionSecurityWarningBottomSheetModalRef.current?.dismiss();
  };

  const transactionSecurityWarnings = useMemo(() => {
    if (
      transactionSecurityAssessment.isMalicious ||
      transactionSecurityAssessment.isSuspicious
    ) {
      const warnings = extractSecurityWarnings(transactionScanResult);

      if (Array.isArray(warnings) && warnings.length > 0) {
        return warnings;
      }
    }

    return [];
  }, [
    transactionSecurityAssessment.isMalicious,
    transactionSecurityAssessment.isSuspicious,
    transactionScanResult,
  ]);

  const transactionSecuritySeverity = useMemo(() => {
    if (transactionSecurityAssessment.isMalicious)
      return SecurityLevel.MALICIOUS;
    if (transactionSecurityAssessment.isSuspicious)
      return SecurityLevel.SUSPICIOUS;

    return undefined;
  }, [
    transactionSecurityAssessment.isMalicious,
    transactionSecurityAssessment.isSuspicious,
  ]);

  const isContinueButtonDisabled = useMemo(() => {
    if (!recipientAddress) {
      return false;
    }

    return (
      !!amountError ||
      BigNumber(tokenAmount).isLessThanOrEqualTo(0) ||
      isBuilding
    );
  }, [amountError, tokenAmount, isBuilding, recipientAddress]);

  if (isProcessing) {
    return (
      <TransactionProcessingScreen
        key={selectedTokenId}
        onClose={handleProcessingScreenClose}
        transactionAmount={tokenAmountInternal}
        selectedBalance={selectedBalance}
      />
    );
  }

  const handleConfirmAnyway = () => {
    transactionSecurityWarningBottomSheetModalRef.current?.dismiss();

    handleTransactionConfirmation();
  };

  const onBannerPress = () => {
    if (isRequiredMemoMissing) {
      addMemoExplanationBottomSheetModalRef.current?.present();
    } else {
      transactionSecurityWarningBottomSheetModalRef.current?.present();
    }
  };
  const handleContinueButtonPress = () => {
    if (!recipientAddress) {
      navigateToSelectContactScreen();
      return;
    }

    prepareTransaction(true);
  };

  const getContinueButtonText = () => {
    if (!recipientAddress) {
      return t("transactionAmountScreen.chooseRecipient");
    }

    if (BigNumber(tokenAmount).isLessThanOrEqualTo(0)) {
      return t("transactionAmountScreen.setAmount");
    }

    return t("transactionAmountScreen.reviewButton");
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1">
        <View className="items-center gap-[12px] max-xs:gap-[6px]">
          <View className="rounded-[12px] gap-[8px] max-xs:gap-[4px] py-[12px] max-xs:py-[8px] px-[16px] max-xs:px-[12px] items-center">
            {showFiatAmount ? (
              <Display
                size={isSmallScreen ? "lg" : "xl"}
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
                  size={isSmallScreen ? "lg" : "xl"}
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
                  ? formatTokenAmount(
                      tokenAmountInternal,
                      selectedBalance?.tokenCode,
                    )
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
          <View className="rounded-[16px] py-[12px] px-[16px] bg-background-tertiary">
            {selectedBalance && (
              <BalanceRow
                isSingleRow
                onPress={navigateToSelectTokenScreen}
                balance={selectedBalance}
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
          <View className="rounded-[16px] py-[12px] px-[16px] bg-background-tertiary max-xs:mt-[4px]">
            <ContactRow
              isSingleRow
              onPress={navigateToSelectContactScreen}
              address={recipientAddress}
              rightElement={
                <IconButton
                  Icon={Icon.ChevronRight}
                  size="sm"
                  variant="ghost"
                />
              }
            />
          </View>
        </View>
        <View className="flex-1 items-center mt-[24px] gap-[24px]">
          <View className="flex-row gap-[8px]">
            <View className="flex-1">
              <Button secondary xl onPress={() => handlePercentagePress(25)}>
                {t("transactionAmountScreen.percentageButtons.twentyFive")}
              </Button>
            </View>
            <View className="flex-1">
              <Button secondary xl onPress={() => handlePercentagePress(50)}>
                {t("transactionAmountScreen.percentageButtons.fifty")}
              </Button>
            </View>
            <View className="flex-1">
              <Button secondary xl onPress={() => handlePercentagePress(75)}>
                {t("transactionAmountScreen.percentageButtons.seventyFive")}
              </Button>
            </View>
            <View className="flex-1">
              <Button secondary xl onPress={() => handlePercentagePress(100)}>
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
              onPress={handleContinueButtonPress}
              disabled={isContinueButtonDisabled}
            >
              {getContinueButtonText()}
            </Button>
          </View>
        </View>
      </View>

      <BottomSheet
        modalRef={reviewBottomSheetModalRef}
        handleCloseModal={() => reviewBottomSheetModalRef.current?.dismiss()}
        analyticsEvent={AnalyticsEvent.VIEW_SEND_CONFIRM}
        customContent={
          <SendReviewBottomSheet
            selectedBalance={selectedBalance}
            tokenAmountInternal={tokenAmountInternal}
            onBannerPress={onBannerPress}
            onCancel={() => reviewBottomSheetModalRef.current?.dismiss()}
            onConfirm={
              isRequiredMemoMissing
                ? onConfirmAddMemo
                : handleTransactionConfirmation
            }
            onSettingsPress={handleOpenSettingsFromReview}
            // is passed here so the entire layout is ready when modal mounts, otherwise leaves a gap at the bottom related to the warning size
            isRequiredMemoMissing={isRequiredMemoMissing}
            isValidatingMemo={isValidatingMemo}
            isMalicious={transactionSecurityAssessment.isMalicious}
            isSuspicious={transactionSecurityAssessment.isSuspicious}
            signTransactionDetails={signTransactionDetails}
          />
        }
      />
      <BottomSheet
        modalRef={addMemoExplanationBottomSheetModalRef}
        handleCloseModal={onCancelAddMemo}
        customContent={
          <InformationBottomSheet
            title={t("addMemoExplanationBottomSheet.title")}
            onClose={onCancelAddMemo}
            onConfirm={onConfirmAddMemo}
            headerElement={
              <View className="bg-red-3 p-2 rounded-[8px]">
                <Icon.InfoOctagon
                  color={themeColors.status.error}
                  size={28}
                  withBackground
                />
              </View>
            }
            texts={[
              {
                key: "description",
                value: t("addMemoExplanationBottomSheet.description"),
              },
              {
                key: "disabledWarning",
                value: t("addMemoExplanationBottomSheet.disabledWarning"),
              },
              {
                key: "checkMemoRequirements",
                value: t("addMemoExplanationBottomSheet.checkMemoRequirements"),
              },
            ]}
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
            context={TransactionSettingsContext.Transaction}
            onCancel={handleCancelTransactionSettings}
            onConfirm={handleConfirmTransactionSettings}
            onSettingsChange={handleSettingsChange}
          />
        }
      />

      <BottomSheet
        modalRef={transactionSecurityWarningBottomSheetModalRef}
        handleCloseModal={handleCancelSecurityWarning}
        customContent={
          <SecurityDetailBottomSheet
            warnings={transactionSecurityWarnings}
            onCancel={handleCancelSecurityWarning}
            onProceedAnyway={handleConfirmAnyway}
            onClose={handleCancelSecurityWarning}
            severity={transactionSecuritySeverity}
            proceedAnywayText={t("transactionAmountScreen.confirmAnyway")}
          />
        }
      />
    </BaseLayout>
  );
};

export default TransactionAmountScreen;
