import Blockaid from "@blockaid/client";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BigNumber } from "bignumber.js";
import BottomSheet from "components/BottomSheet";
import FeeBreakdownBottomSheet from "components/FeeBreakdownBottomSheet";
import InformationBottomSheet from "components/InformationBottomSheet";
import MuxedAddressWarningBottomSheet from "components/MuxedAddressWarningBottomSheet";
import { TokenIcon } from "components/TokenIcon";
import TransactionSettingsBottomSheet from "components/TransactionSettingsBottomSheet";
import SecurityDetailBottomSheet from "components/blockaid/SecurityDetailBottomSheet";
import { BaseLayout } from "components/layout/BaseLayout";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import {
  ContactRow,
  SendReviewBottomSheet,
  SendReviewFooter,
} from "components/screens/SendScreen/components";
import { SendType } from "components/screens/SendScreen/components/SendReviewBottomSheet";
import {
  useSendBannerContent,
  getTransactionSecurity,
  buildUnfundedContext,
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
  ScreenTransition,
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
import { waitForKeyboardDismiss } from "helpers/keyboard";
import { fsValue, pxValue } from "helpers/dimensions";
import {
  formatTokenForDisplay,
  formatFiatInputDisplay,
} from "helpers/formatAmount";
import { checkContractMuxedSupport } from "helpers/muxedAddress";
import { isSorobanTransaction } from "helpers/soroban";
import {
  isFederationAddress,
  isMuxedAccount,
  truncateFedAddress,
} from "helpers/stellar";
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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Keyboard, TextInput, TouchableOpacity, View } from "react-native";
import { analytics } from "services/analytics";
import { TransactionOperationType } from "services/analytics/types";
import { SecurityContext } from "services/blockaid/constants";
import { type UnfundedDestinationContext } from "services/blockaid/helper";

type TransactionAmountScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN
>;

const AVAILABLE_BALANCE_FONT_SIZES = [
  { maxLen: 28, size: fsValue(16) },
  { maxLen: 42, size: fsValue(14) },
  { maxLen: Infinity, size: fsValue(12) },
] as const;

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
  const {
    tokenId,
    recipientAddress: routeRecipientAddress,
    recipientName: routeRecipientName,
  } = route.params;
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { overriddenBlockaidResponse } = useDebugStore();
  const {
    transactionFee,
    recipientAddress,
    federationAddress,
    recipientName,
    selectedTokenId,
    transactionMemo,
    saveSelectedTokenId,
    saveRecipientAddress,
    saveFederationAddress,
    saveRecipientName,
    saveSelectedCollectibleDetails,
    saveMemo,
    resetSettings,
  } = useTransactionSettingsStore();

  const { resetSendRecipient, isDestinationFunded } = useSendRecipientStore();
  const { fetchAccountHistory } = useHistoryStore();

  // Ensure defaults when entering the screen
  useEffect(() => {
    // Clear collectible details when entering token flow to prevent cross-flow contamination
    saveSelectedCollectibleDetails({ collectionAddress: "", tokenId: "" });
    saveSelectedTokenId(tokenId || "");

    // Explicitly set or clear recipient fields based on route params to avoid stale state
    // from previous screens. If route params are missing, clear the store fields.
    saveRecipientAddress(
      typeof routeRecipientAddress === "string" ? routeRecipientAddress : "",
    );
    // routeRecipientName carries a display label. Route it to federationAddress
    // when it looks like a federation address (user*domain), otherwise treat it
    // as a wallet/contact nickname.
    if (routeRecipientName && isFederationAddress(routeRecipientName)) {
      saveFederationAddress(routeRecipientName);
      saveRecipientName("");
    } else {
      saveFederationAddress("");
      saveRecipientName(routeRecipientName ?? "");
    }
  }, [
    tokenId,
    routeRecipientAddress,
    routeRecipientName,
    saveSelectedTokenId,
    saveSelectedCollectibleDetails,
    saveRecipientAddress,
    saveFederationAddress,
    saveRecipientName,
  ]);

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

  const { isValidatingMemo, isMemoMissing } =
    useValidateTransactionMemo(transactionXDR);

  const { scanTransaction } = useBlockaidTransaction();
  const { recommendedFee } = useNetworkFees();

  useInitialRecommendedFee(recommendedFee, TransactionContext.Send);

  const publicKey = account?.publicKey;
  const amountInputRef = useRef<TextInput>(null);
  const previousNativeInputRef = useRef<string>("0");
  const focusRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reviewBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleCloseSendFlow = useCallback(() => {
    // Clean up state before exiting the send flow to prevent stale data.
    useSendRecipientStore.getState().resetSendRecipient();
    useTransactionSettingsStore.getState().resetSettings();
    useTransactionBuilderStore.getState().resetTransaction();
    navigation.getParent()?.goBack();
  }, [navigation]);

  const renderCloseHeaderButton = useCallback(
    () => <CustomHeaderButton icon={Icon.X} onPress={handleCloseSendFlow} />,
    [handleCloseSendFlow],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: renderCloseHeaderButton,
    });
  }, [navigation, renderCloseHeaderButton]);

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
  const addMemoExplanationBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const transactionSettingsBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const feeBreakdownBottomSheetModalRef = useRef<BottomSheetModal>(null);
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
      amountInputRef.current?.blur();
      // Wait for the keyboard's hide animation before presenting the sheet so
      // it opens at its final height instead of jumping down.
      waitForKeyboardDismiss().then(() => {
        transactionSettingsBottomSheetModalRef.current?.present();
      });
    },
  });

  const focusAmountInput = useCallback(() => {
    amountInputRef.current?.focus();

    if (focusRetryTimeoutRef.current) {
      clearTimeout(focusRetryTimeoutRef.current);
    }

    // iOS can occasionally ignore focus on fully hidden inputs; retry on next tick.
    focusRetryTimeoutRef.current = setTimeout(() => {
      if (!amountInputRef.current?.isFocused()) {
        amountInputRef.current?.focus();
      }
    }, 0);
  }, []);

  useEffect(
    () => () => {
      if (focusRetryTimeoutRef.current) {
        clearTimeout(focusRetryTimeoutRef.current);
      }
    },
    [],
  );

  const onConfirmAddMemo = useCallback(() => {
    amountInputRef.current?.blur();
    addMemoExplanationBottomSheetModalRef.current?.dismiss();
    // Wait for the keyboard's hide animation before presenting the sheet so
    // it opens at its final height instead of jumping down.
    waitForKeyboardDismiss().then(() => {
      transactionSettingsBottomSheetModalRef.current?.present();
    });
  }, []);

  const onCancelAddMemo = () => {
    addMemoExplanationBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmTransactionSettings = () => {
    transactionSettingsBottomSheetModalRef.current?.dismiss();
  };

  const handleOpenSettingsFromReview = () => {
    amountInputRef.current?.blur();
    // Wait for the keyboard's hide animation before presenting the sheet so
    // it opens at its final height instead of jumping down.
    waitForKeyboardDismiss().then(() => {
      transactionSettingsBottomSheetModalRef.current?.present();
    });
  };

  const handleCancelTransactionSettings = () => {
    addMemoExplanationBottomSheetModalRef.current?.dismiss();
    transactionSettingsBottomSheetModalRef.current?.dismiss();
    focusAmountInput();
  };

  const navigateToSelectTokenScreen = () => {
    navigation.navigate(SEND_PAYMENT_ROUTES.TRANSACTION_TOKEN_SCREEN, {
      dismissToPreviousScreen: true,
      transition: ScreenTransition.SlideFromBottom,
    });
  };

  const navigateToSelectContactScreen = () => {
    navigation.navigate(SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN, {
      dismissToPreviousScreen: true,
      transition: ScreenTransition.SlideFromBottom,
    });
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
    tokenAmount,
    tokenAmountDisplay,
    tokenAmountDisplayRaw,
    fiatAmountDisplay,
    fiatAmountDisplayRaw,
    showFiatAmount,
    setShowFiatAmount,
    handleDisplayAmountChange,
    setTokenAmount,
    updateFiatDisplay,
  } = useTokenFiatConverter({ selectedBalance });

  // Raw fallback ensures programmatic updates (e.g. percentage buttons) still populate
  // the input when tokenAmountDisplayRaw is null but display is non-empty.
  const amountInputValue = showFiatAmount
    ? (fiatAmountDisplayRaw ?? fiatAmountDisplay)
    : (tokenAmountDisplayRaw ?? tokenAmountDisplay);

  useEffect(() => {
    previousNativeInputRef.current = amountInputValue.replace(/[^0-9.,]/g, "");
  }, [amountInputValue]);

  // Empty when tokenAmount is 0 AND the user has no active raw input beyond plain "0".
  // This lets partial inputs like "0," or "0,2" show while still displaying the
  // placeholder for the initial/reset state (tokenAmountDisplayRaw === null).
  const isAmountEmpty = showFiatAmount
    ? BigNumber(tokenAmount).isLessThanOrEqualTo(0) &&
      (fiatAmountDisplayRaw === null || fiatAmountDisplayRaw === "0")
    : BigNumber(tokenAmount).isLessThanOrEqualTo(0) &&
      (tokenAmountDisplayRaw === null || tokenAmountDisplayRaw === "0");

  const getAmountFontSize = () => {
    const len = amountInputValue.length;
    if (len <= 9) return 32;
    if (len <= 15) return 24;
    return 18;
  };

  const handleNativeAmountChange = useCallback(
    (text: string) => {
      const sanitizedText = text.replace(/[^0-9.,]/g, "");
      const previousText = previousNativeInputRef.current;

      if (sanitizedText === previousText) {
        return;
      }

      // Use key/backspace semantics for one-char diffs to preserve reducer behavior,
      // and fallback to full-text path for paste/replace edits.
      if (
        sanitizedText.length > previousText.length &&
        sanitizedText.startsWith(previousText)
      ) {
        const appendedText = sanitizedText.slice(previousText.length);
        if (appendedText.length === 1) {
          handleDisplayAmountChange(appendedText);
        } else {
          handleDisplayAmountChange(sanitizedText);
        }
      } else if (
        sanitizedText.length < previousText.length &&
        previousText.startsWith(sanitizedText)
      ) {
        const deleteCount = previousText.length - sanitizedText.length;
        for (let i = 0; i < deleteCount; i += 1) {
          handleDisplayAmountChange("");
        }
      } else {
        handleDisplayAmountChange(sanitizedText);
      }

      previousNativeInputRef.current = sanitizedText;
    },
    [handleDisplayAmountChange],
  );

  const unfundedContext: UnfundedDestinationContext | undefined = useMemo(
    () =>
      buildUnfundedContext({
        selectedBalance,
        isDestinationFunded,
        tokenAmount,
        recipientAddress,
      }),
    [selectedBalance, isDestinationFunded, tokenAmount, recipientAddress],
  );

  const {
    transactionSecurityAssessment,
    transactionSecurityWarnings,
    transactionSecuritySeverity,
  } = getTransactionSecurity(
    transactionScanResult,
    overriddenBlockaidResponse,
    unfundedContext,
  );

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
        amountInputRef.current?.blur();
        Keyboard.dismiss();
        const security = getTransactionSecurity(
          scanResult,
          overriddenBlockaidResponse,
          unfundedContext,
        );
        if (security.transactionSecurityAssessment.isUnableToScan) {
          transactionSecurityWarningBottomSheetModalRef.current?.present();
        } else {
          reviewBottomSheetModalRef.current?.present();
        }
      }
    },
    [overriddenBlockaidResponse, unfundedContext],
  );

  const handleTransactionScanError = useCallback(
    (shouldOpenReview: boolean) => {
      setTransactionScanResult(undefined);
      if (shouldOpenReview) {
        amountInputRef.current?.blur();
        Keyboard.dismiss();
        // When scan fails, treat as unable to scan and open security detail sheet
        const security = getTransactionSecurity(
          undefined,
          overriddenBlockaidResponse,
          unfundedContext,
        );
        if (security.transactionSecurityAssessment.isUnableToScan) {
          transactionSecurityWarningBottomSheetModalRef.current?.present();
        } else {
          reviewBottomSheetModalRef.current?.present();
        }
      }
    },
    [overriddenBlockaidResponse, unfundedContext],
  );

  const prepareTransaction = useCallback(
    async (shouldOpenReview = false, feeEstimationAmount?: string) => {
      const effectiveAmount = feeEstimationAmount ?? tokenAmount;
      const numberEffectiveAmount = new BigNumber(effectiveAmount);

      const hasRequiredParams =
        recipientAddress &&
        selectedBalance &&
        (feeEstimationAmount !== undefined ||
          numberEffectiveAmount.isGreaterThan(0));
      if (!hasRequiredParams) {
        return;
      }

      try {
        // Get fresh settings values each time the function is called
        const {
          transactionMemo: freshTransactionMemo,
          transactionMemoType: freshTransactionMemoType,
          transactionFee: freshTransactionFee,
          transactionTimeout: freshTransactionTimeout,
          recipientAddress: storeRecipientAddress,
        } = useTransactionSettingsStore.getState();

        const finalXDR = await buildTransaction({
          tokenAmount: effectiveAmount,
          selectedBalance,
          recipientAddress: storeRecipientAddress,
          transactionMemo: freshTransactionMemo,
          transactionMemoType: freshTransactionMemoType,
          transactionFee: freshTransactionFee,
          transactionTimeout: freshTransactionTimeout,
          network,
          senderAddress: publicKey,
        });

        // Skip scan when building only for fee estimation (dummy amount).
        // A scan result from a non-real amount would be meaningless.
        if (feeEstimationAmount) return;

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

  // Tracks the (balanceId, recipient) pair for which auto-simulation has
  // already been requested. Prevents re-triggering after isBuilding drops back
  // to false at the end of the estimation build itself.
  const lastAutoSimulatedKey = useRef<string | null>(null);

  // Auto-simulate Soroban fee breakdown as soon as token + recipient are set.
  // Uses /simulate-tx with amount 0 for early fee estimation so the user can
  // see the resource fee breakdown before entering an amount.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const currentKey = `${selectedBalance?.id}|${recipientAddress}`;

    if (
      !isBuilding &&
      lastAutoSimulatedKey.current !== currentKey &&
      isSorobanTransaction(selectedBalance, recipientAddress) &&
      recipientAddress &&
      selectedBalance
    ) {
      timer = setTimeout(() => {
        lastAutoSimulatedKey.current = currentKey;
        prepareTransaction(false, "0");
      }, 300);
    }

    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [selectedBalance, recipientAddress, isBuilding, prepareTransaction]);

  const handleSettingsChange = () => {
    if (isBuilding) return;

    const needsEstimation =
      isSorobanTransaction(selectedBalance, recipientAddress) &&
      !new BigNumber(tokenAmount).isGreaterThan(0);
    prepareTransaction(false, needsEstimation ? "0" : undefined);
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
    focusAmountInput();
  }, [focusAmountInput]);

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
      amountInputRef.current?.blur();
      Keyboard.dismiss();
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
    unfundedContext,
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

    amountInputRef.current?.blur();
    Keyboard.dismiss();
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

  const hasUsdPrice =
    !!selectedBalance?.currentPrice && !selectedBalance.currentPrice.isZero();

  if (!hasUsdPrice && showFiatAmount) {
    setShowFiatAmount(false);
  }

  const secondaryConversionAmount = showFiatAmount
    ? formatTokenForDisplay(tokenAmount, selectedBalance?.tokenCode)
    : formatFiatInputDisplay(fiatAmountDisplay);

  const availableAmountText = spendableBalance
    ? formatTokenForDisplay(
        spendableBalance.toString(),
        selectedBalance?.tokenCode,
      )
    : null;

  const availableBalanceText = availableAmountText
    ? `${availableAmountText} ${t("common.available")}`
    : null;

  const getAvailableBalanceFontSize = () =>
    AVAILABLE_BALANCE_FONT_SIZES.find(
      ({ maxLen }) => (availableBalanceText?.length ?? 0) <= maxLen,
    )!.size;

  // recipientName takes priority — it carries wallet nicknames and future
  // user-editable custom labels. Falls back to the federation address when
  // no custom name is set, then to undefined (the row will show the truncated
  // public key on its own).
  const recipientDisplayName =
    recipientName ||
    (federationAddress ? truncateFedAddress(federationAddress) : undefined);

  return (
    <BaseLayout useKeyboardAvoidingView insets={{ top: false }}>
      <View className="flex-1" testID="send-amount-screen">
        <View className="items-center gap-[12px] max-xs:gap-[6px]">
          <View className="rounded-[12px] py-[12px] px-[16px] bg-background-tertiary max-xs:mt-[4px] w-full">
            <ContactRow
              isSingleRow
              hasDarkBackground
              onPress={navigateToSelectContactScreen}
              address={recipientAddress}
              name={recipientDisplayName}
              testID="send-recipient-row"
              rightElement={
                <View className="w-[36px] h-[36px] items-center justify-center rounded-full bg-background-primary">
                  <Icon.ChevronRight
                    size={14}
                    color={themeColors.text.secondary}
                  />
                </View>
              }
            />
          </View>

          <View className="rounded-[12px] gap-[12px] py-[12px] max-xs:py-[8px] px-[16px] max-xs:px-[12px] bg-background-tertiary w-full pt-5 pb-4">
            <View className="flex-row items-end justify-between">
              <Text md secondary style={{ lineHeight: pxValue(16) }}>
                {t("transactionAmountScreen.sendingLabel")}
              </Text>
              {!!availableBalanceText && (
                <Text
                  medium
                  secondary
                  numberOfLines={1}
                  textAlign="right"
                  style={{
                    fontSize: getAvailableBalanceFontSize(),
                    lineHeight: getAvailableBalanceFontSize(),
                    flexShrink: 1,
                    marginLeft: pxValue(8),
                    marginRight: pxValue(4),
                  }}
                >
                  {availableBalanceText}
                </Text>
              )}
            </View>

            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                className="flex-1"
                onPressIn={focusAmountInput}
                activeOpacity={1}
                accessible={false}
                testID="send-amount-focus-trigger"
              >
                <View className="flex-row items-center">
                  {showFiatAmount && (
                    <Display
                      style={{
                        fontSize: getAmountFontSize(),
                        fontWeight: "500",
                        color: isAmountEmpty
                          ? themeColors.text.secondary
                          : themeColors.text.primary,
                      }}
                    >
                      $
                    </Display>
                  )}
                  <TextInput
                    ref={amountInputRef}
                    testID="amount-text-input"
                    accessibilityLabel={t("transactionAmountScreen.setAmount")}
                    accessibilityHint={t("transactionAmountScreen.title")}
                    keyboardType="decimal-pad"
                    showSoftInputOnFocus
                    autoFocus
                    value={isAmountEmpty ? "" : amountInputValue}
                    placeholder="0"
                    placeholderTextColor={themeColors.text.secondary}
                    onChangeText={handleNativeAmountChange}
                    onSubmitEditing={() => Keyboard.dismiss()}
                    underlineColorAndroid="transparent"
                    style={{
                      flex: 1,
                      fontSize: getAmountFontSize(),
                      fontWeight: "500",
                      color: themeColors.text.primary,
                      padding: 0,
                      includeFontPadding: false,
                    }}
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={navigateToSelectTokenScreen}
                className="flex-row items-center gap-[6px] ml-[12px] rounded-full bg-background-primary px-[12px] py-[8px]"
                testID="send-token-row"
              >
                {selectedBalance && (
                  <TokenIcon token={selectedBalance} size="md" />
                )}
                <Text md medium>
                  {selectedBalance?.tokenCode}
                </Text>
                <Icon.ChevronDown size={18} color={themeColors.text.primary} />
              </TouchableOpacity>
            </View>

            {hasUsdPrice && (
              <View className="flex-row items-center gap-[4px] mb-1">
                <Text
                  sm
                  medium
                  secondary
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {secondaryConversionAmount}
                </Text>
                <TouchableOpacity
                  hitSlop={10}
                  onPress={() => setShowFiatAmount(!showFiatAmount)}
                >
                  <Icon.RefreshCcw03
                    size={14}
                    color={themeColors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            )}
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
        </View>
      </View>

      <View className="w-full mt-auto mb-[8px]">
        <Button
          tertiary
          xl
          onPress={handleContinueButtonPress}
          disabled={isContinueButtonDisabled}
          testID="send-continue-button"
        >
          {getContinueButtonText()}
        </Button>
      </View>
      <BottomSheet
        modalRef={reviewBottomSheetModalRef}
        handleCloseModal={handleCancelReview}
        analyticsEvent={AnalyticsEvent.VIEW_SEND_CONFIRM}
        scrollable
        bottomSheetModalProps={{ accessible: false }}
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
        scrollViewFooterComponent={renderFooterComponent}
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
        handleCloseModal={handleCancelTransactionSettings}
        customContent={
          <TransactionSettingsBottomSheet
            context={TransactionContext.Send}
            onCancel={handleCancelTransactionSettings}
            onConfirm={handleConfirmTransactionSettings}
            onSettingsChange={handleSettingsChange}
            onOpenFeeBreakdown={() =>
              feeBreakdownBottomSheetModalRef.current?.present()
            }
          />
        }
      />
      <BottomSheet
        modalRef={feeBreakdownBottomSheetModalRef}
        handleCloseModal={() =>
          feeBreakdownBottomSheetModalRef.current?.dismiss()
        }
        customContent={
          <FeeBreakdownBottomSheet
            onClose={() => feeBreakdownBottomSheetModalRef.current?.dismiss()}
            isSorobanContext={isSorobanTransaction(
              selectedBalance,
              recipientAddress,
            )}
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
