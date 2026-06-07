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
  useSwapNavigation,
  useSwapPathFinding,
  useSwapSecurityAssessments,
  useSwapTransactionSettings,
  useSwapTokenPrices,
} from "components/screens/SwapScreen/hooks";
import { useSwapTokenLookup } from "components/screens/SwapScreen/hooks/useSwapTokenLookup";
import { useSwapTransaction } from "components/screens/SwapScreen/hooks/useSwapTransaction";
import { SwapProcessingScreen } from "components/screens/SwapScreen/screens";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent, SwapPickerEntrypoint } from "config/analyticsConfig";
import {
  DEFAULT_DECIMALS,
  isNativeAssetId,
  mapNetworkToNetworkDetails,
  NATIVE_TOKEN_CODE,
  NETWORKS,
  TransactionContext,
} from "config/constants";
import { logger } from "config/logger";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import {
  FormattedSearchTokenRecord,
  TokenTypeWithCustomToken,
} from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useDebugStore } from "ducks/debug";
import { descriptorAsPathBalance, useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { calculateSpendableAmount } from "helpers/balances";
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
  const xlmReserveBottomSheetRef = useRef<BottomSheetModal>(null);
  const amountInputRef = useRef<TextInput>(null);
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

  const { sourceBalance, destinationBalance, bestNonXlmClassicBalance } =
    useSwapBalances({
      balanceItems,
      sourceTokenId,
      destinationTokenDescriptor,
    });

  const spendableAmount = useMemo(() => {
    if (!sourceBalance || !account) return null;

    return calculateSpendableAmount({
      balance: sourceBalance,
      subentryCount: account.subentryCount || 0,
      transactionFee: swapFee,
    });
  }, [sourceBalance, account, swapFee]);

  // Gate for the XlmReserveBottomSheet's "Swap for 0.5 XLM" affordance.
  // Two modes are supported:
  //   1. Current source is a non-XLM classic token → reuse it as the
  //      sell side, only flip the receive side to XLM. The pre-filled
  //      amount survives because the source token didn't change.
  //   2. Current source is XLM (or unset) → fall back to the user's
  //      best non-XLM classic balance for the sell side. The amount
  //      resets per the converter rule, which is an acceptable trade-off
  //      since the user wouldn't have a meaningful pre-filled amount
  //      tied to that fallback token anyway.
  // The CTA is hidden when neither mode applies (e.g. user holds only XLM
  // with XLM as source) — they're left with the wallet-address copy.
  const isCurrentSourceNonXlmClassic =
    !!sourceBalance &&
    !isNativeAssetId(sourceBalance.id) &&
    (sourceBalance.tokenType === TokenTypeWithCustomToken.CREDIT_ALPHANUM4 ||
      sourceBalance.tokenType === TokenTypeWithCustomToken.CREDIT_ALPHANUM12);
  const canOfferSwapToXlm =
    isCurrentSourceNonXlmClassic || !!bestNonXlmClassicBalance;

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

  // Held-inclusive trending tokens list. Hidden off PUBLIC (stellar.expert
  // only indexes mainnet) or when stellar.expert is down.
  const {
    trendingTokens,
    stellarExpertDown,
    isTrendingLoading,
    refreshTrending,
  } = useSwapTokenLookup({
    network,
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

  const { prices } = useSwapTokenPrices({
    enabled: showTrending,
    tokens: trendingTokens,
  });

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

  const { ctaState, ctaLabel, isCtaDisabled } = useSwapCtaState({
    sourceBalance,
    destinationTokenDescriptor,
    sourceAmount,
    spendableAmount,
    isLoadingPath,
    isBuilding,
    pathResult,
    pathError,
    amountError,
  });

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

  // Tapped from inside XlmReserveBottomSheet. Picks the sell token,
  // sets XLM as the Receive token, and asks Horizon's strictReceivePaths
  // how much of the sell token it would take to receive at least 0.5 XLM.
  //
  // Sell-token resolution:
  //   - If the current source is a non-XLM classic token, reuse it. The
  //     amount survives the call because the source token didn't change
  //     (the converter's reset-on-selected-token-change rule is keyed on
  //     the token code, see useTokenFiatConverter:101).
  //   - Otherwise (source is XLM or unset) fall back to the user's best
  //     non-XLM classic balance. The pre-filled amount will be wiped by
  //     the converter's reset on the next render — acceptable here since
  //     any prior amount was denominated in the now-replaced source.
  const handleSwapForXlmFromSheet = useCallback(async () => {
    const sellBalance = isCurrentSourceNonXlmClassic
      ? sourceBalance
      : bestNonXlmClassicBalance;
    if (!sellBalance) return;
    const sellTokenCode = sellBalance.tokenCode;
    const sellIssuer =
      "token" in sellBalance &&
      sellBalance.token &&
      "issuer" in sellBalance.token
        ? sellBalance.token.issuer?.key
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

    // Only swap the source token when we're falling back — otherwise the
    // converter would reset the amount we're about to set.
    if (!isCurrentSourceNonXlmClassic) {
      setSourceToken(sellBalance.id, sellTokenCode);
    }
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
    isCurrentSourceNonXlmClassic,
    sourceBalance,
    bestNonXlmClassicBalance,
    network,
    setSourceToken,
    setDestinationToken,
    setTokenAmount,
  ]);

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
        sourceAmount,
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
    tokenAmountDisplay,
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
  }) => (
    <TrendingListItem
      item={item}
      prices={prices}
      network={network}
      onPress={() => {
        analytics.track(AnalyticsEvent.SWAP_TRENDING_TOKEN_TAPPED, {
          tokenCode: item.tokenCode,
          tokenIssuer: item.issuer ?? "",
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
            severity={swapSecuritySeverity ?? SecurityLevel.MALICIOUS}
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
