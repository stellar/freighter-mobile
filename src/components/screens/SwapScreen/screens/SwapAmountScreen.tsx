import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
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
  TrendingListItem,
  TrendingTokenDetailBottomSheet,
  XlmReserveBottomSheet,
} from "components/screens/SwapScreen/components";
import {
  buildDestinationPickerToken,
  buildReceiveTexts,
  buildSellSecondaryText,
  buildSourceBalanceRight,
  computeDestinationFiat,
  recordTokenId,
  shouldShowXlmReservePreflight,
} from "components/screens/SwapScreen/helpers";
import {
  SWAP_TOAST_IDS,
  useSwapAmountError,
  useSwapBalances,
  useSwapCtaState,
  useSwapDirectionToggle,
  useSwapFooter,
  useSwapForXlmReserve,
  useSwapNavigation,
  useSwapPathFinding,
  useSwapSecurityAssessments,
  useSwapTransactionSettings,
  useSwapTokenPrices,
  useTrendingTokenDetail,
} from "components/screens/SwapScreen/hooks";
import { useSwapTokenLookup } from "components/screens/SwapScreen/hooks/useSwapTokenLookup";
import { useSwapTransaction } from "components/screens/SwapScreen/hooks/useSwapTransaction";
import { SwapProcessingScreen } from "components/screens/SwapScreen/screens";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent, SwapPickerEntrypoint } from "config/analyticsConfig";
import {
  BASE_RESERVE,
  DEFAULT_DECIMALS,
  isNativeAssetId,
  TransactionContext,
} from "config/constants";
import { logger } from "config/logger";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { FormattedSearchTokenRecord } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useDebugStore } from "ducks/debug";
import { descriptorAsPathBalance, useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { calculateSpendableAmount } from "helpers/balances";
import { formatFiatAmount } from "helpers/formatAmount";
import { waitForKeyboardDismiss } from "helpers/keyboard";
import useAppTranslation from "hooks/useAppTranslation";
import { type HeldBalanceItem, useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useInitialRecommendedFee } from "hooks/useInitialRecommendedFee";
import { useNetworkFees } from "hooks/useNetworkFees";
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
  RefreshControl,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { analytics } from "services/analytics";
import { SecurityContext, SecurityLevel } from "services/blockaid/constants";

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
  // Review-side security sheet — its Proceed Anyway submits a tx. The
  // trending-detail security sheet is owned by useTrendingTokenDetail and
  // kept structurally separate so the two can't share a proceed handler.
  const transactionSecurityWarningBottomSheetModalRef =
    useRef<BottomSheetModal>(null);
  const amountInputRef = useRef<TextInput>(null);
  const { showToast } = useToast();

  // Bridges the gap between `setupSwapTransaction` resolving (isBuilding
  // flips back to false) and the review sheet's mount animation finishing
  // — without this latch the CTA briefly snaps out of its loading state
  // while the sheet is still sliding up.
  const [isOpeningReviewSheet, setIsOpeningReviewSheet] = useState(false);

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

  const { sourceBalance, destinationBalance, bestNonXlmClassicBalance } =
    useSwapBalances({
      balanceItems,
      sourceTokenId,
      destinationTokenDescriptor,
    });

  const spendableAmount = useMemo(() => {
    if (!sourceBalance || !account) return null;

    const baseSpendable = calculateSpendableAmount({
      balance: sourceBalance,
      subentryCount: account.subentryCount || 0,
      transactionFee: swapFee,
    });

    // Swapping XLM → a new token locks BASE_RESERVE (0.5 XLM) for the new
    // trustline, so that XLM isn't actually spendable. Reserve it up-front
    // (so the percentage buttons + insufficient-balance check exclude it).
    // Only when there's at least 0.5 XLM spendable to begin with — below
    // that, leave the value untouched and let the XlmReserveBottomSheet
    // pre-flight surface the shortfall as usual.
    const swappingXlmToNewToken =
      isNativeAssetId(sourceBalance.id) && !!destinationTokenDescriptor?.isNew;
    if (swappingXlmToNewToken && baseSpendable.gte(BASE_RESERVE)) {
      return baseSpendable.minus(BASE_RESERVE);
    }

    return baseSpendable;
  }, [sourceBalance, account, swapFee, destinationTokenDescriptor?.isNew]);

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
    updateFiatDisplay,
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

  const { amountError, setActiveError } = useSwapAmountError({
    sourceBalance,
    sourceAmount,
    balanceItems,
    swapFee,
    subentryCount: account?.subentryCount,
    transactionHash,
    spendableAmount,
    sourceTokenSymbol,
    pathError,
    pathResult,
    destinationTokenDescriptor,
  });

  // For held destinations, useSwapPathFinding / useSwapTransaction
  // receive the matching held PricedBalance. For non-held destinations
  // the balance list doesn't include the token; we feed them a shim of
  // the descriptor (`descriptorAsPathBalance`) that exposes the same
  // fields findSwapPath / buildSwapTransaction read (token.code/issuer/
  // type + id + tokenCode + tokenType). The shim returns PricedBalance
  // structurally — no `any` cast needed.
  const destinationForPath: HeldBalanceItem | undefined = useMemo(() => {
    if (destinationBalance) return destinationBalance;
    if (destinationTokenDescriptor) {
      return descriptorAsPathBalance(destinationTokenDescriptor);
    }
    return undefined;
  }, [destinationBalance, destinationTokenDescriptor]);

  useSwapPathFinding({
    sourceBalance,
    destinationTokenForPath: destinationForPath,
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
    destinationTokenInput: destinationForPath,
    pathResult,

    account,
    network,
    navigation,
  });

  // Held-inclusive trending tokens list. Hidden when stellar.expert
  // is down. On testnet the list is unsorted (testnet volume7d is
  // always 0) but the verified-list intersection still applies, so we
  // surface the same picker affordance as on mainnet — Blockaid's
  // existing "Unable to scan" path covers the missing scan data.
  const {
    trendingTokens,
    stellarExpertDown,
    isTrendingLoading,
    refreshTrending,
  } = useSwapTokenLookup({
    network,
    balanceItems,
  });

  const showTrending = !stellarExpertDown && trendingTokens.length > 0;

  // Show the trending section header + spinner placeholder when the fetch is
  // in flight and we don't have data yet (SE not down).
  const showTrendingSpinner =
    !stellarExpertDown && isTrendingLoading && trendingTokens.length === 0;

  // Non-held destinations need their price explicitly fetched — the
  // trending list only covers the stellar.expert top 50. Without this
  // the receive-card fiat is stuck on "--" for any non-trending token
  // the user picks, until they add a trustline.
  const extraPriceIds = useMemo(() => {
    const ids: string[] = [];
    if (destinationTokenDescriptor?.id) {
      ids.push(destinationTokenDescriptor.id);
    }
    return ids;
  }, [destinationTokenDescriptor?.id]);

  const { prices, refreshPrices } = useSwapTokenPrices({
    enabled: showTrending,
    tokens: trendingTokens,
    extraTokenIds: extraPriceIds,
  });

  // Pull-to-refresh state for the Trending list. On failure, surface a
  // toast so the user knows the cached list they're seeing is stale; on
  // success, the SWR refresh swaps the data in silently.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handlePullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Refresh the trending list AND force-refresh prices for the tokens
      // currently shown. fetchPricesForTokenIds dedupes already-loaded ids,
      // so without forceRefresh the price + 24h% chips would stay frozen.
      await Promise.all([refreshTrending(), refreshPrices()]);
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
  }, [refreshTrending, refreshPrices, showToast, t]);

  // Trending-token detail sheet + its dedicated security sheet — see hook.
  const {
    trendingListRef,
    trendingDetailSheetRef,
    trendingSecurityWarningBottomSheetModalRef,
    selectedTrendingRecord,
    trendingSecurityRecord,
    openTrendingDetail,
    clearSelectedTrendingRecord,
    clearTrendingSecurityRecord,
    confirmTrendingSelection,
    presentTrendingSecurityWarning,
    handleCancelTrendingSecurityWarning,
    handleConfirmTrendingAnyway,
    trendingSecurityLevel,
    isTrendingUnableToScan,
    trendingSecurityWarnings,
  } = useTrendingTokenDetail({
    balanceItems,
    sourceTokenId,
    setSourceToken,
    setDestinationToken,
  });

  const { ctaState, ctaLabel, isCtaDisabled } = useSwapCtaState({
    sourceBalance,
    destinationTokenDescriptor,
    sourceAmount,
    spendableAmount,
    isLoadingPath,
    isBuilding: isBuilding || isOpeningReviewSheet,
    pathResult,
    pathError,
    amountError,
  });

  useEffect(() => {
    if (swapFromTokenId && swapFromTokenSymbol) {
      // setSourceToken resets the amount on a token change (see the swap
      // store). On mount the store source is "" (unmount runs resetSwap),
      // so this always resets to a clean zero start.
      setSourceToken(swapFromTokenId, swapFromTokenSymbol);
      setDestinationToken(null); // cleared on source-token change
    }
  }, [
    swapFromTokenId,
    swapFromTokenSymbol,
    setSourceToken,
    setDestinationToken,
  ]);

  // The network fee auto-refreshes every 30s and is paid in XLM, so a fee
  // bump would shrink an XLM source's spendable and flash "Insufficient
  // balance" under an amount the user already committed to (e.g. Max) —
  // even over the reserve/review sheet. Freeze the fee once an amount is
  // entered by withholding new recommended values (useInitialRecommendedFee
  // only saves a truthy fee), so spendable stays put. It resumes updating
  // when the amount is cleared / the screen resets.
  const hasEnteredSourceAmount = new BigNumber(sourceAmount || "0").gt(0);
  useInitialRecommendedFee(
    hasEnteredSourceAmount ? "" : recommendedFee,
    TransactionContext.Swap,
  );

  const {
    transactionSettingsBottomSheetModalRef,
    openSettings,
    confirmSettings,
    cancelSettings,
  } = useSwapTransactionSettings();

  const {
    openDestinationPicker,
    openDestinationFromDropdown,
    openSourcePicker,
  } = useSwapNavigation({ navigation });

  const handlePercentagePress = useCallback(
    (percentage: number) => {
      if (!spendableAmount) return;

      const targetAmount =
        percentage === 100
          ? spendableAmount
          : spendableAmount.multipliedBy(percentage / 100);

      if (percentage === 100) {
        analytics.track(AnalyticsEvent.SEND_PAYMENT_SET_MAX);
      }

      // In fiat-input mode the primary display IS the fiat field, so we
      // have to update fiatAmountDisplay alongside the token amount —
      // mirrors the Send flow's handler. Round-trip through the token
      // price so the displayed fiat never implies more tokens than
      // `spendableAmount`.
      if (showFiatAmount && sourceBalance?.currentPrice) {
        const tokenPrice = sourceBalance.currentPrice;
        if (!tokenPrice.isZero()) {
          let fiatAmount = targetAmount.multipliedBy(tokenPrice);
          let fiatString = fiatAmount.toFixed(2);

          let convertedBack = new BigNumber(fiatString).dividedBy(tokenPrice);
          if (convertedBack.isGreaterThan(spendableAmount)) {
            // 2-decimal rounding can tip the fiat string back over
            // spendable; shave a cent and recompute.
            fiatAmount = fiatAmount.minus(0.01);
            fiatString = fiatAmount.toFixed(2);
            convertedBack = new BigNumber(fiatString).dividedBy(tokenPrice);
          }

          const finalToken = BigNumber.minimum(convertedBack, spendableAmount);
          const finalFiat = finalToken.multipliedBy(tokenPrice).toFixed(2);

          updateFiatDisplay(finalFiat);
          setTokenAmount(finalToken.toFixed(DEFAULT_DECIMALS));
          return;
        }
      }

      setTokenAmount(targetAmount.toFixed(DEFAULT_DECIMALS));
    },
    [
      spendableAmount,
      showFiatAmount,
      sourceBalance,
      setTokenAmount,
      updateFiatDisplay,
    ],
  );

  // XlmReserveBottomSheet's "Swap for 0.5 XLM" affordance — see hook.
  const {
    xlmReserveBottomSheetRef,
    canOfferSwapToXlm,
    handleSwapForXlmFromSheet,
  } = useSwapForXlmReserve({
    sourceBalance,
    bestNonXlmClassicBalance,
    network,
    subentryCount: account?.subentryCount ?? 0,
    swapFee,
    setSourceToken,
    setDestinationToken,
    setTokenAmount,
    // Scroll the trending list to the top so the updated Sell/Receive
    // cards are visible after the sheet dismisses (mirrors the
    // trending-detail selection flow).
    onAfterSwap: () =>
      trendingListRef.current?.scrollToOffset({ offset: 0, animated: false }),
  });

  // Swap source ↔ destination via the chevron-down button between the
  // cards. Always enabled: the held source token can always be moved down
  // to the receive slot. The receive-side token only moves UP to the sell
  // slot when it's held; otherwise the sell side resets to "Select".
  const { handleSwapDirection } = useSwapDirectionToggle({
    sourceBalance,
    destinationBalance,
    destinationTokenDescriptor,
    setSourceToken,
    setDestinationToken,
    setTokenAmount,
  });

  const destinationFiat = useMemo(
    () =>
      computeDestinationFiat({
        destinationAmount,
        destinationBalance,
        destinationTokenDescriptor,
        prices,
      }),
    [destinationAmount, destinationBalance, destinationTokenDescriptor, prices],
  );

  // Held balance carries currentPrice when /token-prices has it;
  // non-held destinations rely on the prices map keyed on
  // "<code>:<issuer>" (or NATIVE_TOKEN_CODE for XLM). Used to keep the
  // receive-card fiat at "$0.00" instead of "--" while the user hasn't
  // typed an amount yet — "--" should be reserved for tokens we
  // genuinely don't have a price for.
  const hasDestinationPrice = useMemo(() => {
    if (
      destinationBalance?.currentPrice &&
      !destinationBalance.currentPrice.isZero()
    ) {
      return true;
    }
    if (destinationTokenDescriptor) {
      const tokenId = destinationTokenDescriptor.issuer
        ? `${destinationTokenDescriptor.tokenCode}:${destinationTokenDescriptor.issuer}`
        : destinationTokenDescriptor.tokenCode;
      return !!prices[tokenId]?.currentPrice;
    }
    return false;
  }, [destinationBalance, destinationTokenDescriptor, prices]);

  const prepareSwapTransaction = useCallback(
    async (shouldOpenReview = false) => {
      // Latch the CTA's loading state for the entire prepare + present
      // span so the spinner stays continuous through the sheet's mount
      // animation. Cleared by the sheet's onChange below (index >= 0)
      // or in the catch path.
      if (shouldOpenReview) setIsOpeningReviewSheet(true);
      try {
        await setupSwapTransaction();

        if (shouldOpenReview) {
          swapReviewBottomSheetModalRef.current?.present();
        }
      } catch (error) {
        if (shouldOpenReview) setIsOpeningReviewSheet(false);
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
          toastId: SWAP_TOAST_IDS.FAILED_TO_SETUP_TRANSACTION,
          duration: 0,
        });
      }
    },
    [setupSwapTransaction, t, setActiveError],
  );

  const handleConfirmSwap = useCallback(() => {
    swapReviewBottomSheetModalRef.current?.dismiss();

    // Execute swap without setTimeout - errors are handled in the hook itself
    // so they persist even if this component unmounts
    executeSwap();
  }, [executeSwap]);

  const handleSettingsChange = useCallback(() => {
    // Settings have changed, rebuild the swap transaction with new values
    prepareSwapTransaction(false);
  }, [prepareSwapTransaction]);

  const {
    transactionSecurityAssessment,
    sourceSecurityAssessment,
    destinationSecurityAssessment,
    isUnableToScan,
    isMalicious,
    isSuspicious,
    swapSecuritySeverity,
    securityWarnings,
  } = useSwapSecurityAssessments({
    transactionScanResult,
    overriddenBlockaidResponse,
    sourceBalance,
    destinationBalance,
    destinationTokenDescriptor,
    scanResults,
    sourceTokenId,
  });

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
        openSourcePicker(SwapPickerEntrypoint.CTA);
      } else {
        openDestinationPicker(SwapPickerEntrypoint.CTA);
      }
      return;
    }

    if (ctaState.kind === "insufficient" || ctaState.kind === "loading") {
      // disabled / no-op
      return;
    }

    // Pre-flight XLM reserve check: surface the XlmReserveBottomSheet
    // instead of Review when adding the trustline would leave the account
    // below the XLM base reserve.
    if (
      shouldShowXlmReservePreflight({
        balanceItems,
        subentryCount: account?.subentryCount ?? 0,
        swapFee,
        sourceTokenId,
        destinationIsNew: !!destinationTokenDescriptor?.isNew,
      })
    ) {
      analytics.track(AnalyticsEvent.SWAP_XLM_RESERVE_INSUFFICIENT_SHOWN);
      xlmReserveBottomSheetRef.current?.present();
      return;
    }

    if (isUnableToScan) {
      await prepareSwapTransaction(false);
      transactionSecurityWarningBottomSheetModalRef.current?.present();
    } else {
      await prepareSwapTransaction(true);
    }
  }, [
    ctaState,
    prepareSwapTransaction,
    openDestinationPicker,
    openSourcePicker,
    isUnableToScan,
    destinationTokenDescriptor,
    balanceItems,
    swapFee,
    account,
    sourceTokenId,
    xlmReserveBottomSheetRef,
  ]);

  // Reset everything on unmount
  useEffect(
    () => () => {
      resetSwap();
      resetTransaction();
      resetToDefaults();
      setActiveError(null);
    },
    [resetSwap, resetTransaction, resetToDefaults, setActiveError],
  );

  const handleCancelSecurityWarning = () => {
    transactionSecurityWarningBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmAnyway = () => {
    transactionSecurityWarningBottomSheetModalRef.current?.dismiss();

    if (isUnableToScan) {
      swapReviewBottomSheetModalRef.current?.present();
    } else {
      handleConfirmSwap();
    }
  };

  const { renderFooterComponent } = useSwapFooter({
    swapReviewBottomSheetModalRef,
    onConfirm: handleConfirmSwap,
    isBuilding,
    isMalicious,
    isSuspicious,
    transactionXDR,
    onSettingsPress: openSettings,
  });

  // Memoized so the FlatList doesn't re-render every trending row on each
  // amount keystroke — renderItem stays referentially stable unless the
  // prices map or network changes (data changes are handled by FlatList).
  const renderTrendingItem = useCallback(
    // eslint-disable-next-line react/no-unused-prop-types
    ({ item, index }: { item: FormattedSearchTokenRecord; index: number }) => (
      <TrendingListItem
        item={item}
        prices={prices}
        network={network}
        onPress={() => openTrendingDetail(item, index)}
      />
    ),
    [prices, network, openTrendingDetail],
  );

  if (isProcessing) {
    return (
      <SwapProcessingScreen
        onClose={handleProcessingScreenClose}
        sourceAmount={sourceAmount}
        sourceToken={sourceToken}
        destinationAmount={destinationAmount || "0"}
        destinationToken={destinationToken}
        destinationIconUrl={destinationTokenDescriptor?.iconUrl}
      />
    );
  }

  const sellSmallText = buildSellSecondaryText({
    showFiatAmount,
    tokenAmount,
    sourceTokenSymbol,
    fiatAmountDisplay,
  });
  const destinationTokenLabel = destinationTokenDescriptor?.tokenCode ?? "";
  const destinationPickerToken = buildDestinationPickerToken({
    destinationBalance,
    destinationTokenDescriptor,
  });
  const { receiveBigText, receiveSmallText } = buildReceiveTexts({
    showFiatAmount,
    destinationAmount,
    destinationFiat,
    hasDestinationPrice,
    destinationTokenLabel,
  });
  const sourceBalanceRight = buildSourceBalanceRight({
    sourceBalance,
    sourceTokenSymbol,
    spendableAmount,
    availableLabel: t("common.available"),
  });
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
        pickerSecurityLevel={sourceSecurityAssessment.level}
        onPickerPress={() => openSourcePicker(SwapPickerEntrypoint.DROPDOWN)}
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
        // The descriptor carries the search-record's tomlInfo.image so the
        // Receive chip can render the same logo the picker row already
        // showed — without this the chip falls back to a 2-letter avatar
        // for non-held destinations until the trustline is added and the
        // balances pipeline hydrates useTokenIconsStore.
        pickerIconUrl={destinationTokenDescriptor?.iconUrl}
        onPickerPress={openDestinationFromDropdown}
        pickerTestID={
          destinationTokenDescriptor
            ? "swap-receive-pill"
            : "swap-receive-choose-pill"
        }
        primaryAmount={destinationTokenDescriptor ? receiveBigText : "0"}
        secondaryAmount={
          destinationTokenDescriptor ? receiveSmallText : formatFiatAmount("0")
        }
        placeholderActive={!destinationTokenDescriptor}
      />

      <View className="items-center mt-[24px]">
        <PercentageButtons onPress={handlePercentagePress} />
      </View>

      {(showTrending || showTrendingSpinner) && (
        <View className="mt-[24px] mb-[24px]">
          <Text md medium secondary>
            {t("swapScreen.popularTokensSection")}
          </Text>
        </View>
      )}
    </View>
  );

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
          ref={trendingListRef}
          testID="swap-amount-trending-list"
          data={showTrending ? trendingTokens : []}
          keyExtractor={recordTokenId}
          showsVerticalScrollIndicator={false}
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
        {/* 16px spacer above the CTA */}
        <View className="h-4" />
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

      <BottomSheet
        modalRef={swapReviewBottomSheetModalRef}
        handleCloseModal={() => {
          swapReviewBottomSheetModalRef.current?.dismiss();
          setActiveError(null);
        }}
        scrollable
        bottomSheetModalProps={{
          // Clear the "opening" latch on the sheet's first state change
          // (visible OR dismissed) so the CTA's spinner stops the moment
          // the sheet is on screen, and can never get stuck if the user
          // somehow dismisses before it reaches its snap point.
          onChange: () => setIsOpeningReviewSheet(false),
        }}
        analyticsEvent={AnalyticsEvent.VIEW_SWAP_CONFIRM}
        customContent={
          <SwapReviewBottomSheet
            transactionSecurityAssessment={transactionSecurityAssessment}
            sourceSecurityAssessment={sourceSecurityAssessment}
            destinationSecurityAssessment={destinationSecurityAssessment}
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
            severity={swapSecuritySeverity}
            proceedAnywayText={
              isUnableToScan
                ? t("common.continue")
                : t("transactionAmountScreen.confirmAnyway")
            }
          />
        }
      />
      <BottomSheet
        modalRef={trendingSecurityWarningBottomSheetModalRef}
        handleCloseModal={handleCancelTrendingSecurityWarning}
        bottomSheetModalProps={{
          onChange: (index: number) => {
            if (index === -1) clearTrendingSecurityRecord();
          },
        }}
        customContent={
          <SecurityDetailBottomSheet
            // TOKEN context → "This token does not appear safe…" copy
            // (vs the default transaction-level wording).
            securityContext={SecurityContext.TOKEN}
            warnings={trendingSecurityWarnings}
            onCancel={handleCancelTrendingSecurityWarning}
            onProceedAnyway={handleConfirmTrendingAnyway}
            onClose={handleCancelTrendingSecurityWarning}
            // The severity prop excludes SAFE; the banner that opens this
            // sheet is itself gated on a non-SAFE level, so coalesce here.
            severity={
              trendingSecurityLevel === SecurityLevel.SAFE
                ? undefined
                : trendingSecurityLevel
            }
            // "Continue" for unable-to-scan (matches the review side);
            // "Swap to {code} anyway" for the stronger malicious/suspicious.
            proceedAnywayText={
              isTrendingUnableToScan
                ? t("common.continue")
                : t("swapScreen.trendingDetail.swapToAnyway", {
                    tokenCode: trendingSecurityRecord?.tokenCode ?? "",
                  })
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
            onCancel={cancelSettings}
            onConfirm={confirmSettings}
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
            clearSelectedTrendingRecord();
          }}
          // Clear the selected record on every dismiss path — swipe-down,
          // backdrop tap, X tap, programmatic dismiss. onChange(index=-1)
          // fires consistently for all of them. This guarantees the next
          // tap on the SAME row goes null → record → effect → present()
          // rather than being a no-op state update.
          bottomSheetModalProps={{
            onChange: (index: number) => {
              if (index === -1) clearSelectedTrendingRecord();
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
              onSwapTo={confirmTrendingSelection}
              onCancel={() => trendingDetailSheetRef.current?.dismiss()}
              onSecurityWarningPress={presentTrendingSecurityWarning}
            />
          }
        />
      )}
    </BaseLayout>
  );
};

export default SwapAmountScreen;
