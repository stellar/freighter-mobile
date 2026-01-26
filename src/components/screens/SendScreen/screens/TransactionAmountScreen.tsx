import Blockaid from "@blockaid/client";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BigNumber } from "bignumber.js";
import { BalanceRow } from "components/BalanceRow";
import BottomSheet from "components/BottomSheet";
import { IconButton } from "components/IconButton";
import InformationBottomSheet from "components/InformationBottomSheet";
import MuxedAddressWarningBottomSheet from "components/MuxedAddressWarningBottomSheet";
import NumericKeyboard from "components/NumericKeyboard";
import TransactionSettingsBottomSheet from "components/TransactionSettingsBottomSheet";
import SecurityDetailBottomSheet from "components/blockaid/SecurityDetailBottomSheet";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  ContactRow,
  HighlightedAmountDisplay,
  SendReviewBottomSheet,
  SendReviewFooter,
} from "components/screens/SendScreen/components";
import { SendType } from "components/screens/SendScreen/components/SendReviewBottomSheet";
import {
  useSendBannerContent,
  getTransactionSecurity,
} from "components/screens/SendScreen/helpers";
import { TransactionProcessingScreen } from "components/screens/SendScreen/screens";
import { useSignTransactionDetails } from "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  DEFAULT_DECIMALS,
  NATIVE_TOKEN_CODE,
  TransactionContext,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { logger } from "config/logger";
import {
  SEND_PAYMENT_ROUTES,
  SendPaymentStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  MAIN_TAB_ROUTES,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useDebugStore } from "ducks/debug";
import { useHistoryStore } from "ducks/history";
import { useSendRecipientStore } from "ducks/sendRecipient";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { calculateSpendableAmount, hasXLMForFees } from "helpers/balances";
import { useDeviceSize, DeviceSize } from "helpers/deviceSize";
import {
  formatTokenForDisplay,
  formatFiatInputDisplay,
} from "helpers/formatAmount";
import { checkContractMuxedSupport } from "helpers/muxedAddress";
import { isMuxedAccount } from "helpers/stellar";
import { useBlockaidTransaction } from "hooks/blockaid/useBlockaidTransaction";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useInitialRecommendedFee } from "hooks/useInitialRecommendedFee";
import { useNetworkFees } from "hooks/useNetworkFees";
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
import { TransactionOperationType } from "services/analytics/types";
import { SecurityContext } from "services/blockaid/constants";

type TransactionAmountScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN
>;

/**
 * Checks if a raw input value should skip highlighting.
 * Only skip if it's exactly "0" (no decimal separator or trailing characters).
 * Values like "0,", "0,00", ",00" should be highlighted.
 */
const shouldSkipHighlighting = (rawInput: string | null): boolean =>
  // Only skip if it's exactly "0" (no separator, no trailing zeros) or empty
  !rawInput || rawInput === "0" || rawInput === "";
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
  const { overriddenBlockaidResponse } = useDebugStore();
  const {
    transactionFee,
    recipientAddress,
    selectedTokenId,
    transactionMemo,
    saveSelectedTokenId,
    saveRecipientAddress,
    saveSelectedCollectibleDetails,
    saveMemo,
    resetSettings,
  } = useTransactionSettingsStore();

  const { resetSendRecipient } = useSendRecipientStore();
  const { fetchAccountHistory } = useHistoryStore();

  // Ensure defaults when entering the screen
  useEffect(() => {
    // Clear collectible details when entering token flow to prevent cross-flow contamination
    saveSelectedCollectibleDetails({ collectionAddress: "", tokenId: "" });
    // Clear recipient address when entering the screen
    saveRecipientAddress("");

    if (tokenId) {
      saveSelectedTokenId(tokenId);
    } else {
      saveSelectedTokenId("");
    }
  }, [
    tokenId,
    saveSelectedTokenId,
    saveSelectedCollectibleDetails,
    saveRecipientAddress,
  ]);

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
    transactionHash,
    error: transactionBuilderError,
  } = useTransactionBuilderStore();

  // Reset transaction, recipient, and token on unmount
  useEffect(
    () => () => {
      resetTransaction();
      saveSelectedTokenId("");
      saveRecipientAddress("");
      resetSendRecipient();
      resetSettings();
    },
    [
      resetTransaction,
      saveSelectedTokenId,
      saveRecipientAddress,
      resetSendRecipient,
      resetSettings,
    ],
  );

  const { isValidatingMemo, isMemoMissing } =
    useValidateTransactionMemo(transactionXDR);

  const { scanTransaction } = useBlockaidTransaction();
  const { recommendedFee } = useNetworkFees();

  useInitialRecommendedFee(recommendedFee, TransactionContext.Send);

  const publicKey = account?.publicKey;
  const reviewBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const { showToast } = useToast();

  // Show toast when transaction builder error occurs
  const previousErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      transactionBuilderError &&
      transactionBuilderError !== previousErrorRef.current
    ) {
      previousErrorRef.current = transactionBuilderError;
      showToast({
        variant: "error",
        title: transactionBuilderError,
        toastId: "transaction-builder-error",
        duration: 5000,
      });
    }
  }, [transactionBuilderError, showToast]);
  const deviceSize = useDeviceSize();
  const isSmallScreen = deviceSize === DeviceSize.XS;
  const addMemoExplanationBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const transactionSettingsBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const muxedAddressInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [transactionScanResult, setTransactionScanResult] = useState<
    Blockaid.StellarTransactionScanResponse | undefined
  >(undefined);
  const transactionSecurityWarningBottomSheetModalRef =
    useRef<BottomSheetModal>(null);
  const [contractSupportsMuxed, setContractSupportsMuxed] = useState<
    boolean | null
  >(null);
  const signTransactionDetails = useSignTransactionDetails({
    xdr: transactionXDR ?? "",
  });

  useRightHeaderButton({
    icon: Icon.Settings04,
    onPress: () => {
      transactionSettingsBottomSheetModalRef.current?.present();
    },
  });

  const onConfirmAddMemo = useCallback(() => {
    addMemoExplanationBottomSheetModalRef.current?.dismiss();
    transactionSettingsBottomSheetModalRef.current?.present();
  }, []);

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
    (item) => item.id === (selectedTokenId || NATIVE_TOKEN_CODE),
  );

  // Check if selected balance is a custom token (SorobanBalance with contractId)
  const isCustomToken = Boolean(
    selectedBalance &&
      "contractId" in selectedBalance &&
      Boolean(selectedBalance.contractId),
  );

  // Check if recipient is M address
  const isRecipientMuxed = Boolean(
    recipientAddress && isMuxedAccount(recipientAddress),
  );

  // Clear memo for all M addresses (memo is encoded in the address)
  useEffect(() => {
    if (isRecipientMuxed && transactionMemo) {
      saveMemo("");
    }
  }, [isRecipientMuxed, transactionMemo, saveMemo]);

  const contractId = useMemo(() => {
    if (
      selectedBalance &&
      "contractId" in selectedBalance &&
      selectedBalance.contractId
    ) {
      return selectedBalance.contractId;
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBalance?.id, selectedBalance]);

  useEffect(() => {
    const checkContract = async () => {
      if (!isCustomToken || !recipientAddress || !network || !contractId) {
        setContractSupportsMuxed(null);
        return;
      }

      try {
        const networkDetails = mapNetworkToNetworkDetails(network);
        const supportsMuxed = await checkContractMuxedSupport({
          contractId,
          networkDetails,
        });
        setContractSupportsMuxed(supportsMuxed);
      } catch (error) {
        // On error, assume no support for safety
        setContractSupportsMuxed(false);
      }
    };

    checkContract();
  }, [isCustomToken, recipientAddress, network, contractId]);

  // Determine if M address + contract doesn't support muxed
  const isMuxedAddressWithoutMemoSupport = Boolean(
    isRecipientMuxed && isCustomToken && contractSupportsMuxed === false,
  );

  const isRequiredMemoMissing = isMemoMissing && !isValidatingMemo;

  const spendableBalance = useMemo(() => {
    if (!selectedBalance || !account) {
      return BigNumber(0);
    }

    const result = calculateSpendableAmount({
      balance: selectedBalance,
      subentryCount: account.subentryCount,
      transactionFee,
    });

    return result;
  }, [selectedBalance, account, transactionFee]);

  const {
    transactionSecurityAssessment,
    transactionSecurityWarnings,
    transactionSecuritySeverity,
  } = getTransactionSecurity(transactionScanResult, overriddenBlockaidResponse);

  const {
    tokenAmount,
    tokenAmountDisplay,
    fiatAmountDisplay,
    fiatAmountDisplayRaw,
    showFiatAmount,
    setShowFiatAmount,
    handleDisplayAmountChange,
    setTokenAmount,
    updateFiatDisplay,
  } = useTokenFiatConverter({ selectedBalance });

  const handlePercentagePress = (percentage: number) => {
    if (!selectedBalance) return;

    // For custom tokens, spendableBalance is in base units, convert to decimal-aware
    // For native tokens, spendableBalance is already in decimal-aware format
    const decimals =
      isCustomToken && "decimals" in selectedBalance
        ? selectedBalance.decimals
        : DEFAULT_DECIMALS;

    const decimalAwareSpendable = isCustomToken
      ? spendableBalance.shiftedBy(-decimals)
      : spendableBalance;

    let targetAmount: BigNumber;

    if (percentage === 100) {
      targetAmount = decimalAwareSpendable;

      analytics.track(AnalyticsEvent.SEND_PAYMENT_SET_MAX);
    } else {
      targetAmount = decimalAwareSpendable.multipliedBy(percentage / 100);
    }

    // Ensure targetAmount never exceeds spendableBalance
    const cappedTargetAmount = BigNumber.minimum(
      targetAmount,
      spendableBalance,
    );

    if (showFiatAmount) {
      const tokenPrice = selectedBalance.currentPrice || BigNumber(0);
      if (!tokenPrice.isZero()) {
        let calculatedFiatAmount = cappedTargetAmount.multipliedBy(tokenPrice);
        let fiatAmountString = calculatedFiatAmount.toFixed(2);

        let convertedBackToTokens = new BigNumber(fiatAmountString).dividedBy(
          tokenPrice,
        );
        if (convertedBackToTokens.isGreaterThan(spendableBalance)) {
          // Subtract 1 cent to fix USD value going over max tokens
          calculatedFiatAmount = calculatedFiatAmount.minus(0.01);
          fiatAmountString = calculatedFiatAmount.toFixed(2);
          convertedBackToTokens = new BigNumber(fiatAmountString).dividedBy(
            tokenPrice,
          );
        }

        const finalTokenAmount = BigNumber.minimum(
          convertedBackToTokens,
          spendableBalance,
        );
        const finalFiatAmount = finalTokenAmount.multipliedBy(tokenPrice);
        const finalFiatAmountString = finalFiatAmount.toFixed(2);

        updateFiatDisplay(finalFiatAmountString);
        setTokenAmount(finalTokenAmount.toFixed(DEFAULT_DECIMALS));
      }
    } else {
      setTokenAmount(cappedTargetAmount.toFixed(DEFAULT_DECIMALS));
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

    // For custom tokens, spendableBalance is in base units, convert to decimal-aware for comparison
    // For native tokens, spendableBalance is already in decimal-aware format
    const decimals =
      isCustomToken && selectedBalance && "decimals" in selectedBalance
        ? selectedBalance.decimals
        : DEFAULT_DECIMALS;

    const decimalAwareSpendable = isCustomToken
      ? spendableBalance.shiftedBy(-decimals)
      : spendableBalance;

    if (
      decimalAwareSpendable &&
      currentTokenAmount.isGreaterThan(decimalAwareSpendable) &&
      !transactionHash
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
    transactionHash,
    isCustomToken,
    selectedBalance,
    t,
    showToast,
  ]);

  const handleTransactionScanSuccess = useCallback(
    (
      scanResult: Blockaid.StellarTransactionScanResponse | undefined,
      shouldOpenReview: boolean,
    ) => {
      logger.info("TransactionAmountScreen", "scanResult", scanResult);
      setTransactionScanResult(scanResult);

      if (shouldOpenReview) {
        const security = getTransactionSecurity(
          scanResult,
          overriddenBlockaidResponse,
        );
        if (security.transactionSecurityAssessment.isUnableToScan) {
          transactionSecurityWarningBottomSheetModalRef.current?.present();
        } else {
          reviewBottomSheetModalRef.current?.present();
        }
      }
    },
    [overriddenBlockaidResponse],
  );

  const handleTransactionScanError = useCallback(
    (shouldOpenReview: boolean) => {
      setTransactionScanResult(undefined);
      if (shouldOpenReview) {
        // When scan fails, treat as unable to scan and open security detail sheet
        const security = getTransactionSecurity(
          undefined,
          overriddenBlockaidResponse,
        );
        if (security.transactionSecurityAssessment.isUnableToScan) {
          transactionSecurityWarningBottomSheetModalRef.current?.present();
        } else {
          reviewBottomSheetModalRef.current?.present();
        }
      }
    },
    [overriddenBlockaidResponse],
  );

  const prepareTransaction = useCallback(
    async (shouldOpenReview = false) => {
      const numberTokenAmount = new BigNumber(tokenAmount);

      const hasRequiredParams =
        recipientAddress &&
        selectedBalance &&
        numberTokenAmount.isGreaterThan(0);
      if (!hasRequiredParams) {
        return;
      }

      try {
        // Get fresh settings values each time the function is called
        const {
          transactionMemo: freshTransactionMemo,
          transactionFee: freshTransactionFee,
          transactionTimeout: freshTransactionTimeout,
          recipientAddress: storeRecipientAddress,
        } = useTransactionSettingsStore.getState();

        const finalXDR = await buildTransaction({
          tokenAmount,
          selectedBalance,
          recipientAddress: storeRecipientAddress,
          transactionMemo: freshTransactionMemo,
          transactionFee: freshTransactionFee,
          transactionTimeout: freshTransactionTimeout,
          network,
          senderAddress: publicKey,
        });

        if (!finalXDR) return;

        // Always scan the transaction to keep the hook updated
        scanTransaction(finalXDR, "internal")
          .then((scanResult) =>
            handleTransactionScanSuccess(scanResult, shouldOpenReview),
          )
          .catch(() => handleTransactionScanError(shouldOpenReview));
      } catch (error) {
        logger.error(
          "TransactionAmountScreen",
          "Failed to build transaction:",
          error,
        );
      }
    },
    [
      tokenAmount,
      selectedBalance,
      network,
      publicKey,
      buildTransaction,
      scanTransaction,
      recipientAddress,
      handleTransactionScanSuccess,
      handleTransactionScanError,
    ],
  );

  const handleSettingsChange = () => {
    // Settings have changed, rebuild the transaction with new values
    prepareTransaction(false);
  };

  const handleTransactionConfirmation = useCallback(() => {
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
            operationType: TransactionOperationType.Payment,
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
          operationType: TransactionOperationType.Payment,
        });
      }
    };

    processTransaction();
  }, [
    account,
    selectedBalance,
    signTransaction,
    network,
    submitTransaction,
    recipientAddress,
  ]);

  const handleProcessingScreenClose = () => {
    setIsProcessing(false);
    resetTransaction();
    // Clean up stores when exiting the send flow
    saveSelectedTokenId("");
    resetSendRecipient();
    resetSettings();

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

  const handleCancelReview = useCallback(() => {
    reviewBottomSheetModalRef.current?.dismiss();
  }, []);

  const footerProps = useMemo(
    () => ({
      onCancel: handleCancelReview,
      onConfirm: isRequiredMemoMissing
        ? onConfirmAddMemo
        : handleTransactionConfirmation,
      isRequiredMemoMissing,
      isMalicious: transactionSecurityAssessment.isMalicious,
      isSuspicious: transactionSecurityAssessment.isSuspicious,
      isUnableToScan: transactionSecurityAssessment.isUnableToScan,
      isExpectedToFail: transactionSecurityAssessment.isExpectedToFail,
      isMuxedAddressWithoutMemoSupport,
      isValidatingMemo,
      onSettingsPress: handleOpenSettingsFromReview,
      amountError,
    }),
    [
      handleCancelReview,
      isRequiredMemoMissing,
      transactionSecurityAssessment.isMalicious,
      transactionSecurityAssessment.isSuspicious,
      transactionSecurityAssessment.isUnableToScan,
      transactionSecurityAssessment.isExpectedToFail,
      isMuxedAddressWithoutMemoSupport,
      amountError,
      onConfirmAddMemo,
      handleTransactionConfirmation,
      isValidatingMemo,
    ],
  );

  const renderFooterComponent = useCallback(
    () => <SendReviewFooter {...footerProps} />,
    [footerProps],
  );

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

  const handleConfirmAnyway = useCallback(() => {
    transactionSecurityWarningBottomSheetModalRef.current?.dismiss();

    const isUnableToScan =
      !transactionScanResult || transactionSecurityAssessment.isUnableToScan;

    if (isUnableToScan) {
      reviewBottomSheetModalRef.current?.present();
    } else {
      handleTransactionConfirmation();
    }
  }, [
    handleTransactionConfirmation,
    transactionScanResult,
    transactionSecurityAssessment.isUnableToScan,
  ]);

  const openSecurityWarningBottomSheet = useCallback(() => {
    transactionSecurityWarningBottomSheetModalRef.current?.present();
  }, []);

  const openAddMemoExplanationBottomSheet = useCallback(() => {
    addMemoExplanationBottomSheetModalRef.current?.present();
  }, []);

  const openMuxedAddressWarningBottomSheet = useCallback(() => {
    muxedAddressInfoBottomSheetModalRef.current?.present();
  }, []);

  const handleCancelMuxedAddressWarning = useCallback(() => {
    muxedAddressInfoBottomSheetModalRef.current?.dismiss();
  }, []);

  const bannerContent = useSendBannerContent({
    isMalicious: transactionSecurityAssessment.isMalicious,
    isSuspicious: transactionSecurityAssessment.isSuspicious,
    isExpectedToFail: transactionSecurityAssessment.isExpectedToFail,
    isUnableToScan: transactionSecurityAssessment.isUnableToScan,
    isRequiredMemoMissing,
    isMuxedAddressWithoutMemoSupport,
    scanResult: transactionScanResult,
    onSecurityWarningPress: openSecurityWarningBottomSheet,
    onMemoMissingPress: openAddMemoExplanationBottomSheet,
    onMuxedAddressWithoutMemoSupportPress: openMuxedAddressWarningBottomSheet,
  });

  if (isProcessing) {
    return (
      <TransactionProcessingScreen
        type={SendType.Token}
        key={selectedTokenId}
        onClose={handleProcessingScreenClose}
        transactionAmount={tokenAmount}
        selectedBalance={selectedBalance}
      />
    );
  }

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
              <HighlightedAmountDisplay
                rawInput={
                  fiatAmountDisplayRaw !== null &&
                  !shouldSkipHighlighting(fiatAmountDisplayRaw)
                    ? fiatAmountDisplayRaw
                    : null
                }
                formattedDisplay={formatFiatInputDisplay(fiatAmountDisplay)}
                isSmallScreen={isSmallScreen}
                highlightColor={themeColors.text.primary}
                normalColor={themeColors.text.primary}
                secondaryColor={themeColors.text.secondary}
              />
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
                  {tokenAmountDisplay}{" "}
                  <RNText style={{ color: themeColors.text.secondary }}>
                    {selectedBalance?.tokenCode}
                  </RNText>
                </Display>
              </View>
            )}
            <View className="flex-row items-center justify-center">
              <Text lg medium secondary>
                {showFiatAmount
                  ? formatTokenForDisplay(
                      tokenAmount,
                      selectedBalance?.tokenCode,
                    )
                  : formatFiatInputDisplay(fiatAmountDisplay)}
              </Text>
              <TouchableOpacity
                className="ml-2"
                hitSlop={10}
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
                spendableAmount={spendableBalance}
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
            <NumericKeyboard onPress={handleDisplayAmountChange} />
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
        scrollable
        customContent={
          <SendReviewBottomSheet
            type={SendType.Token}
            selectedBalance={selectedBalance}
            tokenAmount={tokenAmount}
            onBannerPress={bannerContent?.onPress}
            // is passed here so the entire layout is ready when modal mounts, otherwise leaves a gap at the bottom related to the warning size
            isRequiredMemoMissing={isRequiredMemoMissing}
            bannerText={bannerContent?.text}
            bannerVariant={bannerContent?.variant}
            signTransactionDetails={signTransactionDetails}
            amountError={amountError}
          />
        }
        renderFooterComponent={renderFooterComponent}
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
            context={TransactionContext.Send}
            onCancel={handleCancelTransactionSettings}
            onConfirm={handleConfirmTransactionSettings}
            onSettingsChange={handleSettingsChange}
          />
        }
      />
      <BottomSheet
        modalRef={muxedAddressInfoBottomSheetModalRef}
        handleCloseModal={handleCancelMuxedAddressWarning}
        customContent={
          <MuxedAddressWarningBottomSheet
            onCancel={handleCancelMuxedAddressWarning}
            onClose={handleCancelMuxedAddressWarning}
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
            securityContext={SecurityContext.TRANSACTION}
            proceedAnywayText={
              transactionSecurityAssessment.isUnableToScan
                ? t("common.continue")
                : t("transactionAmountScreen.confirmAnyway")
            }
          />
        }
      />
    </BaseLayout>
  );
};

export default TransactionAmountScreen;
