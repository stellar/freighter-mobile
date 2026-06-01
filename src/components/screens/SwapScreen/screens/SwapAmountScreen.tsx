import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BigNumber from "bignumber.js";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { TokenIconWithBadge } from "components/TokenIconWithBadge";
import TransactionSettingsBottomSheet from "components/TransactionSettingsBottomSheet";
import { SecurityDetailBottomSheet } from "components/blockaid";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  SwapReviewBottomSheet,
  SwapReviewFooter,
  SwapTokenRow,
  TrendingTokenDetailBottomSheet,
  XlmReserveBottomSheet,
} from "components/screens/SwapScreen/components";
import {
  descriptorFromBalance,
  recordTokenId,
} from "components/screens/SwapScreen/helpers";
import { useSwapPathFinding } from "components/screens/SwapScreen/hooks";
import { useSwapTokenLookup } from "components/screens/SwapScreen/hooks/useSwapTokenLookup";
import { useSwapTransaction } from "components/screens/SwapScreen/hooks/useSwapTransaction";
import { SwapProcessingScreen } from "components/screens/SwapScreen/screens";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  BASE_RESERVE,
  DEFAULT_DECIMALS,
  NATIVE_TOKEN_CODE,
  NETWORKS,
  SWAP_SELECTION_TYPES,
  TransactionContext,
} from "config/constants";
import { logger } from "config/logger";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { FormattedSearchTokenRecord } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useDebugStore } from "ducks/debug";
import { usePricesStore } from "ducks/prices";
import { destinationAsBalanceLike, useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import {
  calculateSpendableAmount,
  isAmountSpendable,
  hasXLMForFees,
} from "helpers/balances";
import { useDeviceSize, DeviceSize } from "helpers/deviceSize";
import {
  formatBalanceAmount,
  formatBigNumberForDisplay,
  formatFiatAmount,
} from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useInitialRecommendedFee } from "hooks/useInitialRecommendedFee";
import { useNetworkFees } from "hooks/useNetworkFees";
import { useRightHeaderButton } from "hooks/useRightHeader";
import { useTokenFiatConverter } from "hooks/useTokenFiatConverter";
import { useToast } from "providers/ToastProvider";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { analytics } from "services/analytics";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessTokenSecurity,
  assessTransactionSecurity,
  extractSecurityWarnings,
  synthesizeScanFromLevel,
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
  const headerHeight = useHeaderHeight();
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
  const xlmReserveBottomSheetRef = useRef<BottomSheetModal>(null);
  const amountInputRef = useRef<TextInput>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<{
    message: string;
    toastId: string;
    duration: number;
  } | null>(null);
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
    destinationToken: destinationTokenDescriptor,
    sourceTokenSymbol,
    sourceAmount,
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
    () =>
      destinationTokenDescriptor
        ? balanceItems.find((item) => item.id === destinationTokenDescriptor.id)
        : undefined,
    [balanceItems, destinationTokenDescriptor],
  );

  const spendableAmount = useMemo(() => {
    if (!sourceBalance || !account) return null;

    return calculateSpendableAmount({
      balance: sourceBalance,
      subentryCount: account.subentryCount || 0,
      transactionFee: swapFee,
    });
  }, [sourceBalance, account, swapFee]);

  // Token/fiat amount input is driven by the system keyboard via TextInput.
  // We mirror the converter's tokenAmount back into the swap store so that
  // the existing path-finding effect (keyed on sourceAmount) still fires.
  const {
    tokenAmount,
    tokenAmountDisplay,
    fiatAmountDisplay,
    showFiatAmount,
    setShowFiatAmount,
    setTokenAmount,
    setDisplayAmountFromText,
  } = useTokenFiatConverter({ selectedBalance: sourceBalance });

  // Sync the converter's token amount back into the swap store. The store's
  // sourceAmount stays the single source of truth for path-finding so
  // useSwapPathFinding can keep its existing dependency list.
  useEffect(() => {
    setSourceAmount(tokenAmount);
    setSourceAmountDisplay(tokenAmountDisplay);
  }, [
    tokenAmount,
    tokenAmountDisplay,
    setSourceAmount,
    setSourceAmountDisplay,
  ]);

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
      setActiveError({
        message: errorMessage,
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
      setActiveError({
        message: errorMessage,
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
  ]);

  // For held destinations, useSwapPathFinding / useSwapTransaction receive
  // the matching `destinationBalance`. For non-held destinations the balance
  // list doesn't include the token; we feed them a minimal balance-shaped
  // projection of the descriptor instead. The projection covers exactly the
  // fields findSwapPath / buildSwapTransaction read (token.code/issuer/type
  // + id + tokenCode + tokenType).
  // Cast: the held side is a full PricedBalance from balanceItems (which
  // always carries tokenType); the adapter projects the required subset.
  // Downstream consumers only read the documented fields.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const destinationForPath: any = useMemo(() => {
    if (destinationBalance) return destinationBalance;
    if (destinationTokenDescriptor) {
      return destinationAsBalanceLike(destinationTokenDescriptor);
    }
    return undefined;
  }, [destinationBalance, destinationTokenDescriptor]);

  useSwapPathFinding({
    sourceBalance,
    destinationBalance: destinationForPath,
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
    destinationBalance: destinationForPath,
    pathResult,

    account,
    network,
    navigation,
  });

  // Trending Tokens list (design doc §5.3 + §6.1). The list is held-inclusive
  // and rendered as the body of the screen's FlatList. It is hidden when:
  //   - we are not on PUBLIC (stellar.expert only indexes mainnet); or
  //   - stellar.expert is down (the source array is empty in either case).
  const { trendingTokens, stellarExpertDown, isTrendingLoading } =
    useSwapTokenLookup({
      network,
      publicKey: account?.publicKey,
      balanceItems,
    });

  const showTrending =
    network === NETWORKS.PUBLIC &&
    !stellarExpertDown &&
    trendingTokens.length > 0;

  // Show the trending section header + spinner placeholder when the fetch is
  // in flight and we don't have data yet (mainnet only, SE not down).
  const showTrendingSpinner =
    network === NETWORKS.PUBLIC &&
    !stellarExpertDown &&
    isTrendingLoading &&
    trendingTokens.length === 0;

  // Batch-fetch token prices when the Trending list updates so SwapTokenRow
  // can display the price + 24h chip via priceInfo.
  const fetchPricesForTokenIds = usePricesStore(
    (state) => state.fetchPricesForTokenIds,
  );
  const prices = usePricesStore((state) => state.prices);

  useEffect(() => {
    if (!showTrending || trendingTokens.length === 0) return;
    const ids = trendingTokens.map(recordTokenId);
    fetchPricesForTokenIds({ tokens: ids });
  }, [showTrending, trendingTokens, fetchPricesForTokenIds]);

  // Detail sheet for a tapped Trending row. The sheet is always mounted so
  // its imperative ref is available; we just toggle which record it renders.
  const trendingDetailSheetRef = useRef<BottomSheetModal>(null);
  const [selectedTrendingRecord, setSelectedTrendingRecord] =
    useState<FormattedSearchTokenRecord | null>(null);

  // Present the detail sheet after the record has propagated into the JSX.
  // Calling present() inline from the row press would target a sheet whose
  // ref is still null on first selection (the conditional render only runs
  // after the state update flushes).
  useEffect(() => {
    if (selectedTrendingRecord) {
      trendingDetailSheetRef.current?.present();
    }
  }, [selectedTrendingRecord]);

  // CTA state machine — see design doc §6.6.
  //
  //   select       no destination yet  ──► navigate to SwapToScreen
  //   enter        destination set, amount == 0  ──► focus the Sell input
  //   insufficient amount exceeds spendable  ──► disabled
  //   loading      path-finding in flight  ──► spinner
  //   review       path resolved, amount valid  ──► open Review sheet
  type CtaState =
    | { kind: "select" }
    | { kind: "enter" }
    | { kind: "insufficient" }
    | { kind: "loading" }
    | { kind: "review" };

  const ctaState: CtaState = useMemo(() => {
    if (!destinationTokenDescriptor) return { kind: "select" };

    const amountBN = new BigNumber(sourceAmount || "0");
    if (amountBN.isZero() || amountBN.isNaN()) return { kind: "enter" };

    if (spendableAmount && amountBN.gt(spendableAmount)) {
      return { kind: "insufficient" };
    }

    if (isLoadingPath || isBuilding) return { kind: "loading" };

    if (pathResult && !pathError) return { kind: "review" };

    // Path-finding finished without a result (or threw) — keep the user on
    // the amount step. The persistent toast (set up below) already surfaces
    // `pathError` when present, so we don't need a dedicated CTA state.
    return { kind: "enter" };
  }, [
    destinationTokenDescriptor,
    sourceAmount,
    spendableAmount,
    isLoadingPath,
    isBuilding,
    pathResult,
    pathError,
  ]);

  const ctaLabel = useMemo(() => {
    switch (ctaState.kind) {
      case "select":
        return t("swapScreen.cta.select");
      case "enter":
        return t("swapScreen.cta.enterAmount");
      case "insufficient":
        return t("swapScreen.cta.insufficientBalance");
      case "loading":
        return t("swapScreen.cta.review");
      case "review":
      default:
        return t("swapScreen.cta.review");
    }
  }, [ctaState, t]);

  const isCtaDisabled =
    ctaState.kind === "insufficient" || !!amountError || !!pathError;

  useEffect(() => {
    if (swapFromTokenId && swapFromTokenSymbol) {
      setSourceToken(swapFromTokenId, swapFromTokenSymbol);
      setSourceAmount("0");
      setDestinationToken(null); // cleared on source-token change
    }
  }, [
    swapFromTokenId,
    swapFromTokenSymbol,
    setSourceToken,
    setSourceAmount,
    setDestinationToken,
  ]);

  useInitialRecommendedFee(recommendedFee, TransactionContext.Swap);

  // Unified error toast effect
  useEffect(() => {
    if (activeError) {
      showToast({
        variant: "error",
        title: activeError.message,
        toastId: activeError.toastId,
        duration: activeError.duration,
      });
    }
  }, [activeError, showToast]);

  // Show persistent toast for path-related errors when user has entered amount and selected destination token
  useEffect(() => {
    const hasAmount = sourceAmount && Number(sourceAmount) > 0;
    const hasDestinationToken = !!destinationTokenDescriptor;

    // Only show toast when there's an actual pathError (not just a missing pathResult)
    if (pathError && hasAmount && hasDestinationToken) {
      setActiveError({
        message: pathError,
        toastId: "swap-path-error",
        duration: 0,
      });
    } else if (
      !pathError &&
      pathResult &&
      activeError?.toastId === "swap-path-error"
    ) {
      // A subsequent path-finding cycle resolved successfully — dismiss the
      // lingering path-error toast so it doesn't cover the keyboard while
      // the user is typing a valid amount.
      setActiveError(null);
    }
  }, [
    pathError,
    pathResult,
    sourceAmount,
    destinationTokenDescriptor,
    activeError?.toastId,
  ]);

  const handleSettingsPress = useCallback(() => {
    transactionSettingsBottomSheetModalRef.current?.present();
  }, []);

  useRightHeaderButton({
    icon: Icon.Settings04,
    onPress: handleSettingsPress,
  });

  const navigateToSelectDestinationTokenScreen = useCallback(
    (source: "cta" | "dropdown" = "dropdown") => {
      analytics.track(AnalyticsEvent.SWAP_TO_PICKER_OPENED, { source });
      navigation.navigate(SWAP_ROUTES.SWAP_SCREEN, {
        selectionType: SWAP_SELECTION_TYPES.DESTINATION,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigation],
  );

  const handleDestinationDropdownPress = useCallback(() => {
    navigateToSelectDestinationTokenScreen("dropdown");
  }, [navigateToSelectDestinationTokenScreen]);

  const navigateToSelectSourceTokenScreen = useCallback(() => {
    analytics.track(AnalyticsEvent.SWAP_TO_PICKER_OPENED, {
      source: "dropdown",
    });
    navigation.navigate(SWAP_ROUTES.SWAP_SCREEN, {
      selectionType: SWAP_SELECTION_TYPES.SOURCE,
    });
  }, [navigation]);

  const handlePercentagePress = useCallback(
    (percentage: number) => {
      if (!spendableAmount) return;

      if (percentage === 100) {
        analytics.track(AnalyticsEvent.SEND_PAYMENT_SET_MAX);
        setTokenAmount(spendableAmount.toString());
      } else {
        const targetAmount = spendableAmount.multipliedBy(percentage / 100);
        setTokenAmount(targetAmount.toFixed(DEFAULT_DECIMALS));
      }
    },
    [spendableAmount, setTokenAmount],
  );

  // Swap source ↔ destination via the chevron-down button between the cards
  // (Figma 11310-94387). Only sensible when the destination is held — we
  // can't make a non-held token the source, since there's no balance to sell.
  const canSwapDirection = !!sourceBalance && !!destinationBalance;
  const handleSwapDirection = useCallback(() => {
    if (!sourceBalance || !destinationBalance) return;
    const nextDestination = descriptorFromBalance(sourceBalance);
    setSourceToken(
      destinationBalance.id,
      destinationBalance.tokenCode ?? destinationBalance.displayName ?? "",
    );
    setDestinationToken(nextDestination);
    setTokenAmount("0");
  }, [
    sourceBalance,
    destinationBalance,
    setSourceToken,
    setDestinationToken,
    setTokenAmount,
  ]);

  // Fiat equivalent of the simulated destination amount for the Receive card.
  // Held: read currentPrice off the balance. Non-held: read from prices store
  // (already populated for trending tokens, with stellar.expert fallback).
  const destinationFiat = useMemo(() => {
    if (!destinationAmount || destinationAmount === "0") return undefined;
    const amount = new BigNumber(destinationAmount);
    if (!amount.isFinite() || amount.isZero()) return undefined;
    if (
      destinationBalance &&
      "currentPrice" in destinationBalance &&
      destinationBalance.currentPrice
    ) {
      return amount.times(destinationBalance.currentPrice);
    }
    if (destinationTokenDescriptor) {
      const tokenId = destinationTokenDescriptor.issuer
        ? `${destinationTokenDescriptor.tokenCode}:${destinationTokenDescriptor.issuer}`
        : destinationTokenDescriptor.tokenCode;
      const priceInfo = prices[tokenId];
      if (priceInfo?.currentPrice) {
        return amount.times(priceInfo.currentPrice);
      }
    }
    return undefined;
  }, [
    destinationAmount,
    destinationBalance,
    destinationTokenDescriptor,
    prices,
  ]);

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

        const errorMessage =
          error instanceof Error
            ? error.message
            : t("swapScreen.errors.failedToSetupTransaction");
        setActiveError({
          message: errorMessage,
          toastId: "failed-to-setup-transaction",
          duration: 0,
        });
      }
    },
    [setupSwapTransaction, t],
  );

  const handleConfirmSwap = useCallback(() => {
    swapReviewBottomSheetModalRef.current?.dismiss();

    // Execute swap without setTimeout - errors are handled in the hook itself
    // so they persist even if this component unmounts
    executeSwap();
  }, [executeSwap]);

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

  // Non-held destinations have no entry in `scanResults` (that map is the held
  // bulk-scan keyed by balance.id). Fall back to a scan synthesized from
  // `descriptor.securityLevel` — set by `useSwapTokenLookup`'s bulk scan
  // during discovery — so MALICIOUS / SUSPICIOUS signals route through the
  // same warning logic as held tokens (spec §9 + §6.4).
  const destBalanceSecurityAssessment = useMemo(
    () =>
      assessTokenSecurity(
        destinationBalance
          ? scanResults[destinationBalance.id.replace(":", "-")]
          : synthesizeScanFromLevel(destinationTokenDescriptor?.securityLevel),
        overriddenBlockaidResponse,
      ),
    [
      destinationBalance,
      destinationTokenDescriptor?.securityLevel,
      scanResults,
      overriddenBlockaidResponse,
    ],
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
      destinationTokenDescriptor?.id !== NATIVE_TOKEN_CODE,
    [destBalanceSecurityAssessment.isUnableToScan, destinationTokenDescriptor],
  );

  const handleMainButtonPress = useCallback(async () => {
    if (ctaState.kind === "select") {
      navigateToSelectDestinationTokenScreen("cta");
      return;
    }

    if (ctaState.kind === "enter") {
      amountInputRef.current?.focus();
      return;
    }

    if (ctaState.kind === "insufficient" || ctaState.kind === "loading") {
      // disabled / no-op
      return;
    }

    // review

    // Pre-flight XLM reserve check (design doc §6.5):
    // When the destination is a new token (trustline must be added) the user
    // needs at least 0.5 XLM spendable to cover the reserve bump. If not,
    // surface the XlmReserveBottomSheet instead of the review sheet.
    if (destinationTokenDescriptor?.isNew) {
      // Use the same spendable-amount semantics the source-side check uses
      // (lines 159-167): it subtracts the swap fee and accounts for subentries.
      // Plain xlmBalance.available is total - sellingLiabilities - minimumBalance
      // and does NOT include fee headroom, so for most accounts the bare check
      // never trips even when the user has no real reserve headroom.
      const xlmBalance = balanceItems.find(
        (b) => "token" in b && b.token.type === "native",
      );
      const xlmSpendable = xlmBalance
        ? calculateSpendableAmount({
            balance: xlmBalance,
            subentryCount: account?.subentryCount ?? 0,
            transactionFee: swapFee,
          })
        : new BigNumber(0);

      // When XLM is the source token, the sourceAmount is about to leave the
      // account in the swap. Subtract it so the gate evaluates post-swap headroom.
      const isXlmSource =
        sourceTokenId === "native" || sourceTokenId === NATIVE_TOKEN_CODE;
      // The combined trustline + path-payment tx has 2 ops, so the actual fee
      // is 2× the per-op fee. calculateSpendableAmount only deducted one op's
      // worth (via the transactionFee parameter), so deduct one more here so
      // the gate doesn't pass an account that lacks fee headroom for op #1.
      const extraTrustlineOpFee = new BigNumber(swapFee);
      const projectedSpendable = (
        isXlmSource
          ? xlmSpendable.minus(new BigNumber(sourceAmount || "0"))
          : xlmSpendable
      ).minus(extraTrustlineOpFee);

      // Use lte so the exact-boundary case (spendable === BASE_RESERVE) routes
      // to the reserve sheet — the user has zero margin after the trustline.
      if (projectedSpendable.lte(BASE_RESERVE)) {
        analytics.track(AnalyticsEvent.SWAP_XLM_RESERVE_INSUFFICIENT_SHOWN);
        xlmReserveBottomSheetRef.current?.present();
        return;
      }
    }

    const isUnableToScan =
      showSecurityWarningForSource || showSecurityWarningForDestination;

    if (isUnableToScan) {
      await prepareSwapTransaction(false);
      transactionSecurityWarningBottomSheetModalRef.current?.present();
    } else {
      await prepareSwapTransaction(true);
    }
  }, [
    ctaState,
    prepareSwapTransaction,
    navigateToSelectDestinationTokenScreen,
    showSecurityWarningForDestination,
    showSecurityWarningForSource,
    destinationTokenDescriptor,
    balanceItems,
    swapFee,
    account,
    sourceTokenId,
    sourceAmount,
  ]);

  // Reset everything on unmount
  useEffect(
    () => () => {
      resetSwap();
      resetTransaction();
      resetToDefaults();
      setActiveError(null);
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
        ...Object.values(scanResults).map((result) =>
          extractSecurityWarnings(result),
        ),
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

  // Sell card amounts: big = active mode (token/fiat), small = opposite mode.
  // Receive card amounts: big = destinationAmount (token mode) or its fiat
  // equivalent (fiat mode); small = the opposite.
  const sellBigText = showFiatAmount ? fiatAmountDisplay : tokenAmountDisplay;
  const sellSmallText = showFiatAmount
    ? `${tokenAmountDisplay || "0"} ${sourceTokenSymbol}`.trim()
    : formatFiatAmount(new BigNumber(fiatAmountDisplay || "0"));
  const destinationTokenLabel = destinationTokenDescriptor?.tokenCode ?? "";
  const destinationAmountToken = destinationAmount || "0";
  const destinationFiatString = destinationFiat
    ? formatFiatAmount(destinationFiat)
    : "$0.00";
  const receiveBigText = showFiatAmount
    ? destinationFiatString
    : destinationAmountToken;
  const receiveSmallText = showFiatAmount
    ? `${destinationAmountToken} ${destinationTokenLabel}`.trim()
    : destinationFiatString;
  // formatBalanceAmount returns "<amount> <code>" already — don't append the
  // code a second time (caused the "123.45 USDC USDC" double-code bug).
  const sourceBalanceRight = sourceBalance
    ? formatBalanceAmount(
        sourceBalance,
        sourceBalance.tokenCode ?? sourceTokenSymbol,
        spendableAmount ?? undefined,
      )
    : "";
  const destinationBalanceRight = destinationBalance
    ? formatBalanceAmount(
        destinationBalance,
        destinationBalance.tokenCode ?? destinationTokenLabel,
      )
    : "";

  // Inline pill: TokenIcon + code + chevron-down, tappable to open picker.
  // Matches Figma 11310-94387's right-side pill on each Sell/Receive card.
  const renderSelectedTokenPill = (
    side: "sell" | "receive",
    onPress: () => void,
  ) => {
    if (side === "sell" && sourceBalance) {
      return (
        <TouchableOpacity
          testID="swap-sell-pill"
          onPress={onPress}
          className="flex-row items-center rounded-full px-[10px] py-[6px] bg-background-secondary gap-[6px]"
        >
          <TokenIconWithBadge
            token={sourceBalance}
            size="sm"
            securityLevel={sourceBalanceSecurityAssessment.level}
          />
          <Text md medium primary>
            {sourceTokenSymbol}
          </Text>
          <Icon.ChevronDown size={16} color={themeColors.text.secondary} />
        </TouchableOpacity>
      );
    }

    if (side === "receive" && destinationTokenDescriptor) {
      const descriptorToken = destinationTokenDescriptor.issuer
        ? {
            type: destinationTokenDescriptor.tokenType,
            code: destinationTokenDescriptor.tokenCode,
            issuer: { key: destinationTokenDescriptor.issuer },
          }
        : ({ type: "native" as const, code: "XLM" as const } as const);
      return (
        <TouchableOpacity
          testID="swap-receive-pill"
          onPress={onPress}
          className="flex-row items-center rounded-full px-[10px] py-[6px] bg-background-secondary gap-[6px]"
        >
          <TokenIconWithBadge
            token={descriptorToken}
            size="sm"
            securityLevel={destinationTokenDescriptor.securityLevel}
          />
          <Text md medium primary>
            {destinationTokenLabel}
          </Text>
          <Icon.ChevronDown size={16} color={themeColors.text.secondary} />
        </TouchableOpacity>
      );
    }

    // Empty state for either side ("Select"). The Sell side can land here
    // when the selection-swap rule clears the source after the user picks
    // the same token on the Receive side (spec §12.4).
    return (
      <TouchableOpacity
        testID={
          side === "sell" ? "swap-sell-choose-pill" : "swap-receive-choose-pill"
        }
        onPress={onPress}
        className="flex-row items-center rounded-full px-[10px] py-[6px] bg-background-secondary gap-[6px]"
      >
        <View className="w-[20px] h-[20px] rounded-full items-center justify-center bg-gray-3">
          <Icon.Plus size={12} themeColor="gray" />
        </View>
        <Text md medium primary>
          {t("swapScreen.selectToken")}
        </Text>
        <Icon.ChevronDown size={16} color={themeColors.text.secondary} />
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View>
      {/* Sell card — Figma 11310-94387 / 11738-37895 / 11738-38058 */}
      <View
        testID="swap-sell-card"
        className="rounded-[16px] pt-[12px] pb-[12px] px-[16px] bg-background-tertiary"
      >
        <Text sm secondary>
          {t("swapScreen.youSell")}
        </Text>
        <View className="flex-row items-center justify-between mt-[4px]">
          <TextInput
            ref={amountInputRef}
            testID="swap-amount-input"
            value={sellBigText}
            onChangeText={setDisplayAmountFromText}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="0"
            placeholderTextColor={themeColors.text.secondary}
            style={{
              fontSize: isSmallScreen ? 28 : 32,
              fontWeight: "500",
              color: themeColors.text.primary,
              padding: 0,
              flex: 1,
              marginRight: 12,
            }}
          />
          {renderSelectedTokenPill("sell", navigateToSelectSourceTokenScreen)}
        </View>
        <View className="flex-row items-center justify-between mt-[4px]">
          <TouchableOpacity
            testID="swap-amount-fiat-toggle"
            className="flex-row items-center gap-[6px]"
            hitSlop={10}
            onPress={() => setShowFiatAmount(!showFiatAmount)}
          >
            <Text sm secondary numberOfLines={1}>
              {sellSmallText}
            </Text>
            <Icon.RefreshCw03 size={12} color={themeColors.text.secondary} />
          </TouchableOpacity>
          <Text sm secondary numberOfLines={1}>
            {sourceBalanceRight}
          </Text>
        </View>
      </View>

      {/* Swaps source ↔ destination. Disabled when destination
          isn't held — there's no balance to make it the source. */}
      <View className="items-center my-[-14px] z-10" pointerEvents="box-none">
        <TouchableOpacity
          testID="swap-direction-toggle"
          onPress={handleSwapDirection}
          disabled={!canSwapDirection}
          hitSlop={10}
          className="w-[40px] h-[40px] rounded-full items-center justify-center bg-background-secondary"
          style={{ opacity: canSwapDirection ? 1 : 0.4 }}
        >
          <Icon.ChevronDown size={16} color={themeColors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Receive card */}
      <View
        testID="swap-receive-card"
        className="rounded-[16px] pt-[12px] pb-[12px] px-[16px] bg-background-tertiary"
      >
        <Text sm secondary>
          {t("swapScreen.youReceive")}
        </Text>
        <View className="flex-row items-center justify-between mt-[4px]">
          <Display
            sm
            medium
            adjustsFontSizeToFit
            numberOfLines={1}
            minimumFontScale={0.6}
            color={
              destinationTokenDescriptor
                ? themeColors.text.primary
                : themeColors.text.secondary
            }
          >
            {destinationTokenDescriptor ? receiveBigText : "0"}
          </Display>
          {renderSelectedTokenPill("receive", handleDestinationDropdownPress)}
        </View>
        <View className="flex-row items-center justify-between mt-[4px]">
          <Text sm secondary numberOfLines={1}>
            {destinationTokenDescriptor ? receiveSmallText : "$0.00"}
          </Text>
          <Text sm secondary numberOfLines={1}>
            {destinationBalanceRight}
          </Text>
        </View>
      </View>

      <View className="items-center mt-[24px]">
        <View className="flex-row gap-[8px] w-full">
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
      </View>

      {(showTrending || showTrendingSpinner) && (
        // Figma node 11310-103377: parent frame has gap-[24px] between
        // header and each row. Match with 24px above and 24px below the title.
        <View className="mt-[24px] mb-[24px]">
          <Text md medium secondary>
            {t("swapScreen.trendingTokensSection")}
          </Text>
        </View>
      )}
    </View>
  );

  const renderTrendingItem = ({
    item,
    index,
  }: {
    item: FormattedSearchTokenRecord;
    index: number;
  }) => {
    const tokenId = recordTokenId(item);
    const priceInfo = prices[tokenId] ?? {};
    // Fallback to stellar.expert's spot price when /token-prices has no
    // entry for this token (common for long-tail trending tokens). No 24h%
    // available in the fallback case — design doc §5.3.
    const fallbackPrice =
      item.price !== undefined ? new BigNumber(item.price) : undefined;
    return (
      <View>
        <SwapTokenRow
          variant="trending"
          record={item}
          priceInfo={{
            currentPrice: priceInfo.currentPrice ?? fallbackPrice,
            percentagePriceChange24h:
              priceInfo.percentagePriceChange24h ?? undefined,
          }}
          network={network}
          onPress={() => {
            analytics.track(AnalyticsEvent.SWAP_TRENDING_TOKEN_TAPPED, {
              tokenCode: item.tokenCode,
              position: index,
            });
            setSelectedTrendingRecord(item);
            // present() fires via useEffect once the ref is mounted.
          }}
        />
      </View>
    );
  };

  return (
    // Not using BaseLayout's useKeyboardAvoidingView here: it wraps content
    // in a ScrollView, which nests our virtualized trending FlatList inside
    // a same-orientation ScrollView and triggers RN's nested-virtualized-list
    // warning (plus breaks windowing for long lists). We use a manual
    // KeyboardAvoidingView with the React Navigation header offset instead.
    <BaseLayout insets={{ top: false }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
        style={{ flex: 1 }}
        testID="swap-amount-screen"
      >
        <FlatList
          testID="swap-amount-trending-list"
          data={showTrending ? trendingTokens : []}
          keyExtractor={recordTokenId}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            showTrendingSpinner ? (
              <View className="items-center py-6">
                <Spinner size="large" testID="trending-loading-spinner" />
              </View>
            ) : null
          }
          renderItem={renderTrendingItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 16 }}
          style={{ flex: 1 }}
        />
        <Button
          tertiary
          onPress={handleMainButtonPress}
          disabled={isCtaDisabled}
          isLoading={ctaState.kind === "loading"}
          testID="swap-continue-button"
        >
          {ctaLabel}
        </Button>
      </KeyboardAvoidingView>

      {/* Clear errors when review is closed */}
      <BottomSheet
        modalRef={swapReviewBottomSheetModalRef}
        handleCloseModal={() => {
          swapReviewBottomSheetModalRef.current?.dismiss();
          // Clear all errors when review is closed
          setActiveError(null);
        }}
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
                : synthesizeScanFromLevel(
                    destinationTokenDescriptor?.securityLevel,
                  )
            }
            onSecurityWarningPress={() =>
              transactionSecurityWarningBottomSheetModalRef.current?.present()
            }
          />
        }
        scrollViewFooterComponent={renderFooterComponent}
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
      <BottomSheet
        modalRef={xlmReserveBottomSheetRef}
        handleCloseModal={() => xlmReserveBottomSheetRef.current?.dismiss()}
        customContent={
          <XlmReserveBottomSheet
            publicKey={account?.publicKey ?? ""}
            bottomSheetModalRef={xlmReserveBottomSheetRef}
          />
        }
      />
      {selectedTrendingRecord && (
        <BottomSheet
          modalRef={trendingDetailSheetRef}
          handleCloseModal={() => {
            trendingDetailSheetRef.current?.dismiss();
            setSelectedTrendingRecord(null);
          }}
          customContent={
            <TrendingTokenDetailBottomSheet
              record={selectedTrendingRecord}
              priceInfo={(() => {
                const p = prices[recordTokenId(selectedTrendingRecord)];
                const fallbackPrice =
                  selectedTrendingRecord.price !== undefined
                    ? new BigNumber(selectedTrendingRecord.price)
                    : undefined;
                return {
                  currentPrice: p?.currentPrice ?? fallbackPrice,
                  percentagePriceChange24h:
                    p?.percentagePriceChange24h ?? undefined,
                };
              })()}
              balanceItems={balanceItems}
              bottomSheetModalRef={trendingDetailSheetRef}
            />
          }
        />
      )}
    </BaseLayout>
  );
};

export default SwapAmountScreen;
