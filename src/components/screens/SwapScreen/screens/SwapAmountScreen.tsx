import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Asset, Horizon } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { AmountCard } from "components/AmountCard";
import BottomSheet from "components/BottomSheet";
import { PercentageButtons } from "components/PercentageButtons";
import Spinner from "components/Spinner";
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
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  BASE_RESERVE,
  DEFAULT_DECIMALS,
  mapNetworkToNetworkDetails,
  NATIVE_TOKEN_CODE,
  NETWORKS,
  SWAP_SELECTION_TYPES,
  TransactionContext,
} from "config/constants";
import { logger } from "config/logger";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import {
  FormattedSearchTokenRecord,
  PricedBalance,
  Token,
  TokenTypeWithCustomToken,
} from "config/types";
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
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
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

/**
 * Dismiss the keyboard and resolve only AFTER the keyboardDidHide event
 * fires, so a bottom sheet presented next animates in at its final height
 * instead of starting at the keyboard-occluded position and jumping down
 * (the UI glitch users see on tap of "Review swap").
 *
 * Resolves immediately when the keyboard isn't visible.
 */
const waitForKeyboardDismiss = (): Promise<void> => {
  if (!Keyboard.isVisible()) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      sub.remove();
      resolve();
    });
    Keyboard.dismiss();
  });
};

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

  // Highest-value non-XLM classic balance the user holds. Used by the
  // XlmReserveBottomSheet's "Swap for 0.5 XLM" affordance — when the user
  // has no XLM headroom for a new trustline, we offer to swap their most
  // valuable other token for the needed XLM. Falls back to total when
  // fiatTotal is missing (e.g. unsupported price). Returns undefined when
  // the user holds only XLM (or has zero non-XLM classic balance).
  const bestNonXlmClassicBalance = useMemo(() => {
    const candidates = balanceItems
      .filter(
        (b) =>
          (b.tokenType === TokenTypeWithCustomToken.CREDIT_ALPHANUM4 ||
            b.tokenType === TokenTypeWithCustomToken.CREDIT_ALPHANUM12) &&
          b.id !== "native" &&
          b.id !== NATIVE_TOKEN_CODE &&
          b.total?.gt(0),
      )
      .sort((a, b) => {
        const aFiat = a.fiatTotal ?? new BigNumber(0);
        const bFiat = b.fiatTotal ?? new BigNumber(0);
        if (!aFiat.eq(bFiat)) return bFiat.comparedTo(aFiat);
        return (b.total ?? new BigNumber(0)).comparedTo(
          a.total ?? new BigNumber(0),
        );
      });
    return candidates[0];
  }, [balanceItems]);
  const canOfferSwapToXlm = !!bestNonXlmClassicBalance;

  // Token/fiat amount input is driven by the system keyboard via TextInput.
  // We mirror the converter's tokenAmount back into the swap store so that
  // the existing path-finding effect (keyed on sourceAmount) still fires.
  const converter = useTokenFiatConverter({ selectedBalance: sourceBalance });
  const {
    tokenAmount,
    tokenAmountDisplay,
    fiatAmountDisplay,
    showFiatAmount,
    setTokenAmount,
  } = converter;

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
  const {
    trendingTokens,
    stellarExpertDown,
    isTrendingLoading,
    refreshTrending,
  } = useSwapTokenLookup({
    network,
    publicKey: account?.publicKey,
    balanceItems,
  });

  // Pull-to-refresh state for the Trending list. On failure, surface a
  // toast so the user knows the cached list they're seeing is stale; on
  // success, the SWR refresh swaps the data in silently.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handlePullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshTrending();
    } catch {
      showToast({
        variant: "error",
        title: t("swapScreen.refreshFailed"),
        toastId: "trending-refresh-failed",
        duration: 3000,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshTrending, showToast, t]);

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
    | { kind: "select"; missingSide: "source" | "destination" }
    | { kind: "enter" }
    | { kind: "insufficient" }
    | { kind: "loading" }
    | { kind: "review" };

  const ctaState: CtaState = useMemo(() => {
    // "Select a token" fires whenever EITHER side is empty — picking the
    // missing side first is what the user expects. Source-first ordering
    // when both are empty so we resolve the upstream input before the
    // downstream destination.
    if (!sourceBalance) return { kind: "select", missingSide: "source" };
    if (!destinationTokenDescriptor) {
      return { kind: "select", missingSide: "destination" };
    }

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
    sourceBalance,
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

  const navigateToSelectSourceTokenScreen = useCallback(
    (source: "cta" | "dropdown") => {
      analytics.track(AnalyticsEvent.SWAP_TO_PICKER_OPENED, { source });
      navigation.navigate(SWAP_ROUTES.SWAP_SCREEN, {
        selectionType: SWAP_SELECTION_TYPES.SOURCE,
      });
    },
    [navigation],
  );

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

  // Tapped from inside XlmReserveBottomSheet. Picks the user's most valuable
  // non-XLM classic balance as the new Sell token, sets XLM as the Receive
  // token, and asks Horizon's strictReceivePaths how much of the Sell token
  // it would take to receive at least 0.5 XLM. If a path exists, the result
  // is dropped into sourceAmount and the existing path-finding pipeline
  // re-runs from there (Insufficient balance / Review CTA emerges naturally
  // depending on whether the chosen source can cover the path).
  const handleSwapForXlmFromSheet = useCallback(async () => {
    if (!bestNonXlmClassicBalance) return;
    const sellTokenCode = bestNonXlmClassicBalance.tokenCode;
    const sellIssuer =
      "token" in bestNonXlmClassicBalance &&
      bestNonXlmClassicBalance.token &&
      "issuer" in bestNonXlmClassicBalance.token
        ? bestNonXlmClassicBalance.token.issuer?.key
        : undefined;
    if (!sellTokenCode || !sellIssuer) return;

    let receivedSourceAmount: string | null = null;
    try {
      const networkDetails = mapNetworkToNetworkDetails(network);
      const server = new Horizon.Server(networkDetails.networkUrl);
      const sellAsset = new Asset(sellTokenCode, sellIssuer);
      const result = await server
        .strictReceivePaths([sellAsset], Asset.native(), "0.5")
        .limit(1)
        .call();
      receivedSourceAmount = result.records[0]?.source_amount ?? null;
    } catch (error) {
      // No path / network error — fall back to setting source+dest without
      // a pre-filled amount so the user can still adjust manually.
      logger.error(
        "SwapAmountScreen.handleSwapForXlmFromSheet",
        "strictReceivePaths failed",
        error,
      );
    }

    setSourceToken(bestNonXlmClassicBalance.id, sellTokenCode);
    setDestinationToken({
      id: NATIVE_TOKEN_CODE,
      tokenCode: NATIVE_TOKEN_CODE,
      decimals: DEFAULT_DECIMALS,
      tokenType: TokenTypeWithCustomToken.NATIVE,
      isNew: false,
    });
    if (receivedSourceAmount) {
      setTokenAmount(receivedSourceAmount);
    }
    xlmReserveBottomSheetRef.current?.dismiss();
  }, [
    bestNonXlmClassicBalance,
    network,
    setSourceToken,
    setDestinationToken,
    setTokenAmount,
  ]);

  // Swap source ↔ destination via the chevron-down button between the cards.
  // Always enabled: the held source token can always be moved down to the
  // receive slot. The receive-side token only moves UP to the sell slot
  // when it's held (there's a balance to sell from). Otherwise the sell
  // side resets to the "Select" empty state.
  const handleSwapDirection = useCallback(() => {
    // Sell slot gets the previous destination IF that destination is held.
    if (destinationBalance) {
      setSourceToken(
        destinationBalance.id,
        destinationBalance.tokenCode ?? destinationBalance.displayName ?? "",
      );
    } else {
      // Previous destination is non-held — clear sell so the chip renders
      // its "Select" empty state. The picker stays tappable.
      setSourceToken("", "");
    }
    // Receive slot gets the previous source's descriptor (if there was one).
    if (sourceBalance) {
      setDestinationToken(descriptorFromBalance(sourceBalance));
    } else {
      setDestinationToken(null);
    }
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
    // "enter" branch focuses the input — let the keyboard rise naturally.
    if (ctaState.kind === "enter") {
      amountInputRef.current?.focus();
      return;
    }

    // Every other branch either navigates to the picker or presents a
    // bottom sheet. Wait for the keyboard's hide animation to finish
    // before continuing so any sheet we present next opens at its final
    // position rather than at the keyboard-occluded height first and
    // then jumping down.
    await waitForKeyboardDismiss();

    if (ctaState.kind === "select") {
      if (ctaState.missingSide === "source") {
        navigateToSelectSourceTokenScreen("cta");
      } else {
        navigateToSelectDestinationTokenScreen("cta");
      }
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
    navigateToSelectSourceTokenScreen,
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

  // Sell card secondary amount: opposite of the active editable mode.
  // Receive card amounts: big = destinationAmount (token mode) or its fiat
  // equivalent (fiat mode); small = the opposite.
  const sellSmallText = showFiatAmount
    ? `${tokenAmountDisplay || "0"} ${sourceTokenSymbol}`.trim()
    : formatFiatAmount(new BigNumber(fiatAmountDisplay || "0"));
  const destinationTokenLabel = destinationTokenDescriptor?.tokenCode ?? "";

  // Pick the most-complete token shape we can hand to AmountCard's picker
  // chip: prefer the held PricedBalance, fall back to a synthetic Token
  // built from the descriptor (issuer = classic; no issuer = native XLM),
  // and finally undefined when the user hasn't picked anything yet.
  let destinationPickerToken: PricedBalance | Token | undefined;
  if (destinationBalance) {
    destinationPickerToken = destinationBalance;
  } else if (destinationTokenDescriptor?.issuer) {
    destinationPickerToken = {
      type: destinationTokenDescriptor.tokenType,
      code: destinationTokenDescriptor.tokenCode,
      issuer: { key: destinationTokenDescriptor.issuer },
    } as Token;
  } else if (destinationTokenDescriptor) {
    destinationPickerToken = { type: "native", code: "XLM" } as Token;
  }
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
  // code a second time (caused the "123.45 USDC USDC" double-code bug). The
  // trailing " available" string matches the Send card's wording for
  // cross-flow consistency.
  const sourceBalanceRight = sourceBalance
    ? `${formatBalanceAmount(
        sourceBalance,
        sourceBalance.tokenCode ?? sourceTokenSymbol,
        spendableAmount ?? undefined,
      )} ${t("common.available")}`
    : "";
  const listHeader = (
    <View>
      {/* Sell card */}
      <AmountCard
        mode="editable"
        testID="swap-sell-card"
        label={t("swapScreen.youSell")}
        selectedToken={sourceBalance ?? undefined}
        pickerLabel={
          sourceBalance ? sourceTokenSymbol : t("swapScreen.selectToken")
        }
        pickerSecurityLevel={sourceBalanceSecurityAssessment.level}
        onPickerPress={() => navigateToSelectSourceTokenScreen("dropdown")}
        pickerTestID={
          sourceBalance ? "swap-sell-pill" : "swap-sell-choose-pill"
        }
        inputTestID="swap-amount-input"
        focusTriggerTestID="swap-amount-focus-trigger"
        fiatToggleTestID="swap-amount-fiat-toggle"
        inputRef={amountInputRef}
        accessibilityLabel={t("swapScreen.cta.enterAmount")}
        accessibilityHint={t("swapScreen.title")}
        availableBalanceText={sourceBalanceRight || null}
        converter={converter}
        hasUsdPrice={
          !!sourceBalance?.currentPrice && !sourceBalance.currentPrice.isZero()
        }
        secondaryAmountText={sellSmallText}
      />

      {/* Swaps source ↔ destination. Always enabled — when the previous
          destination is non-held the sell side resets to "Select" rather
          than being prevented. */}
      <View className="items-center my-[-14px] z-10" pointerEvents="box-none">
        <TouchableOpacity
          testID="swap-direction-toggle"
          onPress={handleSwapDirection}
          hitSlop={10}
          className="w-[40px] h-[40px] rounded-full items-center justify-center bg-background-secondary"
        >
          <Icon.ChevronDown size={16} color={themeColors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Receive card */}
      <AmountCard
        mode="readonly"
        testID="swap-receive-card"
        label={t("swapScreen.youReceive")}
        selectedToken={destinationPickerToken}
        pickerLabel={
          destinationTokenDescriptor
            ? destinationTokenLabel
            : t("swapScreen.selectToken")
        }
        pickerSecurityLevel={destinationTokenDescriptor?.securityLevel}
        onPickerPress={handleDestinationDropdownPress}
        pickerTestID={
          destinationTokenDescriptor
            ? "swap-receive-pill"
            : "swap-receive-choose-pill"
        }
        primaryAmount={destinationTokenDescriptor ? receiveBigText : "0"}
        secondaryAmount={
          destinationTokenDescriptor ? receiveSmallText : "$0.00"
        }
        placeholderActive={!destinationTokenDescriptor}
      />

      <View className="items-center mt-[24px]">
        <PercentageButtons onPress={handlePercentagePress} />
      </View>

      {(showTrending || showTrendingSpinner) && (
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
            // Dismiss the keyboard so the trending detail sheet has full
            // unblocked space; otherwise the sheet pops over a raised
            // keyboard and the Buy CTA sits under it.
            Keyboard.dismiss();
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
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              // Wrap in a void arrow so React Native's onRefresh signature
              // (() => void) doesn't complain about a returned Promise.
              onRefresh={() => {
                handlePullToRefresh();
              }}
              tintColor={themeColors.text.secondary}
            />
          }
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
            tokenCode={destinationTokenDescriptor?.tokenCode}
            bottomSheetModalRef={xlmReserveBottomSheetRef}
            canOfferSwapToXlm={canOfferSwapToXlm}
            onSwapForXlm={handleSwapForXlmFromSheet}
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
          // Clear the selected record on every dismiss path — swipe-down,
          // backdrop tap, X tap, programmatic dismiss. onChange(index=-1)
          // fires consistently for all of them. This guarantees the next
          // tap on the SAME row goes null → record → effect → present()
          // rather than being a no-op state update.
          bottomSheetModalProps={{
            onChange: (index: number) => {
              if (index === -1) setSelectedTrendingRecord(null);
            },
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
