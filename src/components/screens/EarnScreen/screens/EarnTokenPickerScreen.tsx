import { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  NavigationProp,
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BigNumber from "bignumber.js";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import TransactionSettingsBottomSheet from "components/TransactionSettingsBottomSheet";
import { SecurityDetailBottomSheet } from "components/blockaid";
import { BaseLayout } from "components/layout/BaseLayout";
import { BlendPoolIcon } from "components/screens/EarnScreen/components/BlendPoolIcon";
import { EarnScreenHeader } from "components/screens/EarnScreen/components/EarnScreenHeader";
import { EarnSwapBottomSheet } from "components/screens/EarnScreen/components/EarnSwapBottomSheet";
import { EarnSwapFromBottomSheet } from "components/screens/EarnScreen/components/EarnSwapFromBottomSheet";
import {
  EarnSwapOutcome,
  EarnSwapProcessingBottomSheet,
  EarnSwapProcessingBottomSheetProps,
} from "components/screens/EarnScreen/components/EarnSwapProcessingBottomSheet";
import { EarnTokenRow } from "components/screens/EarnScreen/components/EarnTokenRow";
import { NotEnoughTokenBottomSheet } from "components/screens/EarnScreen/components/NotEnoughTokenBottomSheet";
import { ReceiveFundsBottomSheet } from "components/screens/EarnScreen/components/ReceiveFundsBottomSheet";
import {
  EARN_TOAST_IDS,
  NotEnoughVariant,
  getEarnOptionToken,
  getNotEnoughVariant,
  hasSwappableBalance,
  isOnrampableAsset,
  parseCanonicalAsset,
} from "components/screens/EarnScreen/helpers";
import { getPoolDisplayName } from "components/screens/EarnScreen/helpers/poolDisplayName";
import { useEarnBalancesRefresh } from "components/screens/EarnScreen/hooks/useEarnBalancesRefresh";
import { useEarnSwap } from "components/screens/EarnScreen/hooks/useEarnSwap";
import {
  EarnTokenOption,
  useEarnTokens,
} from "components/screens/EarnScreen/hooks/useEarnTokens";
import { useOpenBlendApp } from "components/screens/EarnScreen/hooks/useOpenBlendApp";
// Imported by module path rather than through `screens/index.ts`: this file is
// itself re-exported from that barrel, so going through it would close an
// import cycle.
import { EarnIntroScreen } from "components/screens/EarnScreen/screens/EarnIntroScreen";
import SwapReviewBottomSheet from "components/screens/SwapScreen/components/SwapReviewBottomSheet";
import {
  buildSellSecondaryText,
  buildSourceBalanceRight,
  descriptorFromBalance,
} from "components/screens/SwapScreen/helpers";
import { SWAP_TOAST_IDS } from "components/screens/SwapScreen/hooks/useSwapAmountError";
import { useSwapFooter } from "components/screens/SwapScreen/hooks/useSwapFooter";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  AnalyticsEvent,
  buildScreenViewedProps,
  SwapPickerEntrypoint,
  SwapSelectionSource,
} from "config/analyticsConfig";
import {
  DEFAULT_PADDING,
  MIN_TRANSACTION_FEE,
  TransactionContext,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { logger } from "config/logger";
import {
  ADD_FUNDS_ROUTES,
  EARN_ROUTES,
  EarnStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useDebugStore } from "ducks/debug";
import { useEarnStore } from "ducks/earn";
import { usePreferencesStore } from "ducks/preferences";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTokenIconsStore } from "ducks/tokenIcons";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { calculateSpendableAmount, getTokenIdentifier } from "helpers/balances";
import { pxValue } from "helpers/dimensions";
import { formatFiatAmount, formatTokenForDisplay } from "helpers/formatAmount";
import { waitForKeyboardDismiss } from "helpers/keyboard";
import useAppTranslation from "hooks/useAppTranslation";
import { HeldBalanceItem } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useNetworkFees } from "hooks/useNetworkFees";
import { useToast } from "providers/ToastProvider";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Keyboard, ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { analytics } from "services/analytics";
import { track } from "services/analytics/core";
import {
  trackEarnBalanceInsufficientShown,
  trackEarnFundingActionSelected,
  trackEarnTokenSelected,
} from "services/analytics/earn";
import { swapSourceProps } from "services/analytics/swapSource";
import { assessTransactionSecurity } from "services/blockaid/helper";

/**
 * The swap inside Earn reports Swap's own screens, tagged as opened from
 * Earn, as the extension's does.
 */
const EARN_SWAP_ANALYTICS_PROPS = swapSourceProps("earn");

type EarnTokenPickerScreenProps = NativeStackScreenProps<
  EarnStackParamList,
  typeof EARN_ROUTES.EARN_TOKEN_PICKER_SCREEN
>;

export const EarnTokenPickerScreen: React.FC<EarnTokenPickerScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { showToast, dismissToast } = useToast();
  const { themeColors } = useColors();
  const { isLoading, error, held, supported, pool, refetch } = useEarnTokens();
  const insets = useSafeAreaInsets();
  const { overriddenBlockaidResponse } = useDebugStore();
  const { recommendedFee } = useNetworkFees();
  const { account } = useGetActiveAccount();
  const selectAsset = useEarnStore((state) => state.selectAsset);
  const setDidSwapInFlow = useEarnStore((state) => state.setDidSwapInFlow);
  const { network } = useAuthenticationStore();
  const { pricedBalances } = useBalancesStore();
  const isOnrampEnabled = useRemoteConfigStore((state) => state.onramp_enabled);
  const hasSeenEarnIntro = usePreferencesStore(
    (state) => state.hasSeenEarnIntro,
  );
  const setHasSeenEarnIntro = usePreferencesStore(
    (state) => state.setHasSeenEarnIntro,
  );

  // The route reports no view of its own (see `analyticsConfig`): the intro
  // is drawn in the picker's place on a first visit, and the funnel's
  // earn_select_token counts the picker being seen, as the extension's does
  // after its intro. Reported each time the picker comes into focus, as the
  // route's view was.
  useFocusEffect(
    useCallback(() => {
      if (!hasSeenEarnIntro) {
        return;
      }
      track(
        AnalyticsEvent.SCREEN_VIEWED,
        buildScreenViewedProps(AnalyticsEvent.VIEW_EARN_TOKEN_PICKER),
      );
    }, [hasSeenEarnIntro]),
  );
  const notEnoughBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const receiveFundsBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const swapBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const swapFromBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [notEnoughOption, setNotEnoughOption] =
    useState<EarnTokenOption | null>(null);
  /**
   * The reserve the swap branch is working toward, held SEPARATELY from
   * `notEnoughOption`.
   *
   * They look interchangeable -- swap is always entered from the "not enough"
   * sheet, so they start equal -- but that sheet OWNS `notEnoughOption` and
   * clears it on close. Driving the swap sheet from it meant any dismissal of
   * the sheet underneath blanked the swap sheet's content and reset its whole
   * store state mid-flow, which read as "the modal closed by itself".
   */
  const [swapOption, setSwapOption] = useState<EarnTokenOption | null>(null);

  // Swap-within-Earn state. Driven by `notEnoughOption` -- the reserve whose
  // row was tapped -- so the destination is already locked by the time the
  // sheet presents. Null while no row is pending, which no-ops the hook.
  const swapReviewBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const swapProcessingBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const swapSettingsBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const swapSecurityWarningBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const refreshBalances = useEarnBalancesRefresh({
    publicKey: account?.publicKey ?? "",
    network,
  });

  // Nothing else fetches icons for the tokens the account doesn't hold, the
  // ones under "Other supported tokens", so look them up by their classic
  // code and issuer. The icon store returns a cached icon without fetching.
  const fetchIconUrl = useTokenIconsStore((state) => state.fetchIconUrl);
  useEffect(() => {
    supported.forEach((option) => {
      if (option.isNative || option.balance) {
        return;
      }
      const classic = parseCanonicalAsset(option.canonicalId);
      if (!classic) {
        return;
      }
      fetchIconUrl({
        token: { code: classic.code, issuer: { key: classic.issuer } },
        network,
      });
    });
  }, [supported, network, fetchIconUrl]);

  // How the swap ended, recorded by the processing sheet just before it
  // closes, so the picker can announce the new balance.
  const swapOutcomeRef = useRef<EarnSwapOutcome | null>(null);

  // Closes every sheet of the swap branch, bottom-up: the swap sheet first,
  // then whatever sits over it. gorhom restores the sheet under one that
  // starts closing and ignores a dismiss that arrives in between, so
  // closing top-down left the swap sheet open (X on "Swap from" behaved
  // like its back arrow). A sheet that isn't open ignores the call.
  const dismissSwapSheets = useCallback(() => {
    swapBottomSheetModalRef.current?.dismiss();
    swapReviewBottomSheetModalRef.current?.dismiss();
    swapFromBottomSheetModalRef.current?.dismiss();
    swapSecurityWarningBottomSheetModalRef.current?.dismiss();
    swapProcessingBottomSheetModalRef.current?.dismiss();
  }, []);

  // A completed swap leaves the user holding the reserve they came for, so
  // close the whole swap branch and drop them back on the picker -- refetching
  // the catalog and the balances so the row they wanted moves into "In your
  // wallet" -- with a toast naming what they got. Swap's own default (reset
  // onto the History tab) would strand them outside Earn entirely. The swap
  // store is reset after this runs (see `useEarnSwap`), so it can still read
  // the source here.
  const handleSwapProcessingClose = useCallback(() => {
    dismissSwapSheets();

    const outcome = swapOutcomeRef.current;
    swapOutcomeRef.current = null;
    // The swap itself reported `swap.completed`, tagged as opened from Earn.
    if (outcome?.succeeded && swapOption) {
      setDidSwapInFlow(true);
      showToast({
        variant: "success",
        title: t("earnSwap.swappedToast", {
          sourceCode: useSwapStore.getState().sourceTokenSymbol,
          destination: formatTokenForDisplay(
            outcome.destinationAmount,
            swapOption.code,
          ),
        }),
        toastId: EARN_TOAST_IDS.SWAP_COMPLETE,
      });
    }

    setSwapOption(null);
    setNotEnoughOption(null);
    refetch();
    refreshBalances();
  }, [
    dismissSwapSheets,
    refetch,
    refreshBalances,
    showToast,
    swapOption,
    t,
    setDidSwapInFlow,
  ]);

  // An expired quote is the one failure a retry fixes, so instead of ending
  // on the processing sheet's "failed", go back to the swap sheet. Its
  // source and amount are kept, and the quote is refetched for them, as
  // main Swap does when it returns to its amount screen.
  const handleSwapQuoteExpired = useCallback(() => {
    swapProcessingBottomSheetModalRef.current?.dismiss();
    swapBottomSheetModalRef.current?.present();
  }, []);

  const earnSwap = useEarnSwap({
    option: swapOption,
    onProcessingClose: handleSwapProcessingClose,
    onQuoteExpired: handleSwapQuoteExpired,
  });

  // "1,691.69 XLM available" on the sell card. Null hides the line, matching
  // `AmountCard`'s own contract.
  const earnSwapAvailableText = useMemo(
    () =>
      earnSwap.spendableAmount
        ? buildSourceBalanceRight({
            sourceBalance: earnSwap.sourceBalance,
            sourceTokenSymbol: earnSwap.sourceTokenSymbol,
            spendableAmount: earnSwap.spendableAmount,
            availableLabel: t("common.available"),
          }) || null
        : null,
    [
      earnSwap.sourceBalance,
      earnSwap.sourceTokenSymbol,
      earnSwap.spendableAmount,
      t,
    ],
  );

  // The sell card's second line: the amount's other unit, as on the deposit
  // screen.
  const earnSwapSourceSecondaryText = buildSellSecondaryText({
    showFiatAmount: earnSwap.converter.showFiatAmount,
    tokenAmount: earnSwap.converter.tokenAmount,
    sourceTokenSymbol: earnSwap.sourceTokenSymbol,
    fiatAmountDisplay: earnSwap.converter.fiatAmountDisplay,
  });

  // The receive card's fiat line, priced by the pool catalog: the account
  // doesn't hold the destination yet, so there is no balance price for it.
  const earnSwapDestinationFiatText = useMemo(() => {
    const price = pool?.reserves.find(
      (reserve) => reserve.assetId === swapOption?.assetId,
    )?.priceUsd;
    const amount = earnSwap.pathResult?.destinationAmount;
    if (price === null || price === undefined || !amount) {
      return undefined;
    }
    return formatFiatAmount(new BigNumber(amount).multipliedBy(price));
  }, [pool, swapOption, earnSwap.pathResult]);

  // "Swap from" stacks over the swap sheet rather than replacing it, so its
  // back arrow can return with the source unchanged. The swap sheet stays
  // mounted underneath.
  const handleSwapSourcePickerPress = useCallback(() => {
    // The sell chip, as on Swap's own amount screen.
    analytics.track(AnalyticsEvent.SWAP_PICKER_OPENED, {
      side: "from",
      trigger: SwapPickerEntrypoint.DROPDOWN,
      ...EARN_SWAP_ANALYTICS_PROPS,
    });
    // Over a dismissed keyboard: the swap sheet's keypad would otherwise
    // stay up over the list.
    Keyboard.dismiss();
    waitForKeyboardDismiss().then(() => {
      swapFromBottomSheetModalRef.current?.present();
    });
  }, []);

  const handleSwapSourceSelected = useCallback(
    (balance: HeldBalanceItem) => {
      // "Swap from" lists the tokens held, as Swap's picker does idle.
      analytics.track(AnalyticsEvent.SWAP_SOURCE_SELECTED, {
        asset_code: balance.tokenCode ?? "",
        asset_issuer: descriptorFromBalance(balance).issuer ?? "",
        list: SwapSelectionSource.BALANCES,
        ...EARN_SWAP_ANALYTICS_PROPS,
      });
      earnSwap.selectSource(balance);
      swapFromBottomSheetModalRef.current?.dismiss();
    },
    [earnSwap],
  );

  // Build + Blockaid-scan, then open Review -- mirroring `SwapAmountScreen`'s
  // own CTA handler.
  //
  // The review sheet is presented ONLY on success. Presenting it
  // unconditionally is what made a failed path look like "the modal closed":
  // stacking a second sheet hides the swap sheet beneath it, so a review that
  // opened with nothing to show left the user staring at an empty sheet with
  // their amount gone. On failure the swap sheet must simply stay put and the
  // reason surface as a toast, exactly as the amount screen does.
  //
  // As in main Swap, a transaction or token Blockaid couldn't scan shows the
  // security sheet first; its Continue opens Review. The gate reads the
  // fresh transaction scan, not the lagging render state.
  // True once the user confirms the swap, so its Review closing for the
  // submit isn't reported as a rejection. Reset each time Review opens.
  const hasApprovedSwapRef = useRef(false);
  // True from Confirm until the swap sheet has closed for the submit, so
  // that close keeps the swap about to be signed. Every other way out of
  // the swap sheet clears the swap.
  const isSubmittingSwapRef = useRef(false);
  // Counts the times the user left the swap, so a Review still being built
  // when they left is dropped instead of opening over the picker.
  const swapExitCountRef = useRef(0);
  // From the Review tap until Review or the security sheet opens, or the
  // build fails.
  const [isBuildingSwapReview, setIsBuildingSwapReview] = useState(false);

  // Leaving the swap's Review without confirming is reported as a rejection,
  // as main Swap reports it, whichever way the sheet closed.
  const handleSwapReviewDismiss = useCallback(() => {
    if (hasApprovedSwapRef.current) {
      return;
    }
    analytics.trackInternalSignedTransactionRejected();
  }, []);

  const handleSwapReview = useCallback(async () => {
    // Only a swap whose quote is ready is built, as on main Swap. Before the
    // quote arrives the button is live but there is nothing to build, and
    // opening the security sheet or Review then would offer to sign
    // whatever transaction was staged before.
    if (earnSwap.ctaState.kind !== "review") {
      return;
    }
    // A retry after an expired quote: its toast has served its purpose.
    dismissToast(SWAP_TOAST_IDS.QUOTE_EXPIRED);
    const exitCount = swapExitCountRef.current;
    const hasLeftSwap = () => swapExitCountRef.current !== exitCount;
    // Review shows the swap as it is when it opens, so nothing on the sheet
    // may change while the transaction is built from it.
    Keyboard.dismiss();
    setIsBuildingSwapReview(true);
    try {
      const setup = await earnSwap.setupSwapTransaction();
      if (!setup || hasLeftSwap()) {
        return;
      }
      hasApprovedSwapRef.current = false;
      const isTransactionUnableToScan = assessTransactionSecurity(
        setup?.scanResult,
        overriddenBlockaidResponse,
      ).isUnableToScan;
      if (earnSwap.isTokenUnableToScan || isTransactionUnableToScan) {
        swapSecurityWarningBottomSheetModalRef.current?.present();
      } else {
        swapReviewBottomSheetModalRef.current?.present();
      }
    } catch (setupError) {
      logger.error(
        "EarnTokenPickerScreen",
        "Failed to setup the earn swap transaction",
        setupError,
      );
      // A swap the user has left has no sheet to stay on.
      if (hasLeftSwap()) {
        return;
      }
      showToast({
        variant: "error",
        title:
          setupError instanceof Error
            ? setupError.message
            : t("swapScreen.errors.failedToSetupTransaction"),
        toastId: SWAP_TOAST_IDS.FAILED_TO_SETUP_TRANSACTION,
        duration: 0,
      });
    } finally {
      setIsBuildingSwapReview(false);
    }
  }, [earnSwap, overriddenBlockaidResponse, showToast, dismissToast, t]);

  // Swap settings (fee, slippage, timeout), from the gear on the swap sheet
  // and on Review. Like main Swap, an untouched fee is first scaled to the
  // swap's operation count: a destination without a trustline adds one.
  const swapOperationCount = earnSwap.destination?.requiresTrustline ? 2 : 1;
  const handleSwapSettingsPress = useCallback(() => {
    const { swapFee, feeManuallyChanged, saveSwapFee } =
      useSwapSettingsStore.getState();
    if (!feeManuallyChanged && recommendedFee) {
      const scaledTotal = new BigNumber(recommendedFee).times(
        swapOperationCount,
      );
      if (!scaledTotal.eq(swapFee)) {
        saveSwapFee(scaledTotal.toString());
      }
    }
    Keyboard.dismiss();
    waitForKeyboardDismiss().then(() => {
      swapSettingsBottomSheetModalRef.current?.present();
    });
  }, [recommendedFee, swapOperationCount]);

  const handleCloseSwapSettings = useCallback(() => {
    swapSettingsBottomSheetModalRef.current?.dismiss();
  }, []);

  // A transaction already built for Review is rebuilt with the new settings,
  // so Confirm signs what Review shows.
  const handleSwapSettingsChange = useCallback(() => {
    if (!earnSwap.transactionXDR) {
      return;
    }
    earnSwap.setupSwapTransaction().catch((settingsError) => {
      logger.error(
        "EarnTokenPickerScreen",
        "Failed to rebuild the earn swap after a settings change",
        settingsError,
      );
    });
  }, [earnSwap]);

  // Cross-stack navigation (Buy / Receive live outside EarnStack) needs the
  // root-level param list — the screen's own `navigation` prop is typed to
  // EarnStackParamList only.
  const rootNavigation = useNavigation<NavigationProp<RootStackParamList>>();

  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );

  // Which buttons the "not enough" sheet offers for a token.
  const getNotEnoughVariantFor = useCallback(
    (option: EarnTokenOption) => {
      const isOnrampable = isOnrampableAsset(
        option.code,
        networkDetails,
        isOnrampEnabled,
      );
      // No trustline for this asset means it can't appear as a key in
      // `pricedBalances` at all, so any identifier that isn't a real
      // "XLM"/"CODE:ISSUER" key is a safe placeholder — the reserve's own
      // contract address works and never collides.
      const targetIdentifier = option.balance
        ? getTokenIdentifier(option.balance)
        : option.assetId;
      // Swapping into a reserve the account has no trustline for opens one
      // first, in the same transaction: a second operation for the fee, and
      // another base reserve of XLM.
      const requiresTrustline = !option.isNative && !option.balance;
      const isSwappable = hasSwappableBalance({
        balances: pricedBalances,
        targetIdentifier,
        subentryCount: account?.subentryCount ?? 0,
        transactionFee: new BigNumber(recommendedFee || MIN_TRANSACTION_FEE)
          .times(requiresTrustline ? 2 : 1)
          .toFixed(),
        requiresTrustline,
      });

      return getNotEnoughVariant({ isOnrampable, isSwappable });
    },
    [
      networkDetails,
      isOnrampEnabled,
      pricedBalances,
      account?.subentryCount,
      recommendedFee,
    ],
  );

  const notEnoughVariant = useMemo(
    () =>
      notEnoughOption
        ? getNotEnoughVariantFor(notEnoughOption)
        : NotEnoughVariant.TRANSFER_ONLY,
    [notEnoughOption, getNotEnoughVariantFor],
  );

  /**
   * Zero-balance rows aren't deposit-ready — tapping one opens the "not
   * enough" sheet instead of navigating to the (unusable) amount screen.
   */
  const handleUnheldTokenPress = useCallback(
    (option: EarnTokenOption) => {
      trackEarnBalanceInsufficientShown({
        assetCode: option.code,
        variant: getNotEnoughVariantFor(option),
      });
      setNotEnoughOption(option);
      notEnoughBottomSheetModalRef.current?.present();
    },
    [getNotEnoughVariantFor],
  );

  // The sheet's header shows the token's icon, built as `EarnTokenRow`
  // builds it. `undefined` while no option is selected, matching
  // `tokenCode`'s own `?? ""` fallback below.
  const notEnoughToken = notEnoughOption
    ? getEarnOptionToken(notEnoughOption)
    : undefined;

  // The option is released once the sheet has closed, not as it starts
  // closing: clearing it first would empty the sheet while it slides away.
  const handleCloseNotEnoughSheet = useCallback(() => {
    notEnoughBottomSheetModalRef.current?.dismiss();
  }, []);

  const handleBuyPress = useCallback(() => {
    if (notEnoughOption) {
      trackEarnFundingActionSelected({
        assetCode: notEnoughOption.code,
        action: "buy",
      });
    }
    notEnoughBottomSheetModalRef.current?.dismiss();
    // Coinbase opens on the token the user was trying to deposit.
    rootNavigation.navigate(ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK, {
      screen: ADD_FUNDS_ROUTES.ADD_FUNDS_SCREEN,
      params: { isUnfunded: false, token: notEnoughOption?.code },
    });
  }, [rootNavigation, notEnoughOption]);

  // Swap-within-Earn: opens a sheet stacked OVER the
  // still-visible picker, with the destination locked to the reserve the
  // user just failed to deposit. Deliberately NOT a jump to `SWAP_STACK`,
  // which would eject them from Earn and leave them to find their way back
  // to the reserve they wanted.
  //
  // The "not enough" sheet underneath is dismissed first: the two would
  // otherwise stack three deep with the picker, and returning to it after a
  // completed swap would be wrong -- the balance it is complaining about no
  // longer applies.
  const handleSwapForToken = useCallback(() => {
    if (notEnoughOption) {
      trackEarnFundingActionSelected({
        assetCode: notEnoughOption.code,
        action: "swap",
      });
    }
    // Capture before dismissing: the sheet below clears `notEnoughOption` as
    // it closes, so the swap branch needs its own copy to survive that.
    setSwapOption(notEnoughOption);
    notEnoughBottomSheetModalRef.current?.dismiss();
    swapBottomSheetModalRef.current?.present();
  }, [notEnoughOption]);

  // Confirm: tear down EVERY swap sheet, then submit.
  //
  // Dismissing only the review was not enough. `executeSwap` flips
  // `isProcessing`, which early-returns the processing screen and unmounts
  // the whole sheet tree -- but unmounting a `BottomSheetModal` that is still
  // PRESENTED leaves gorhom rendering it over the screen beneath. The swap
  // sheet stayed on top of the processing screen, so a submit that actually
  // succeeded looked like being dumped back on the configuration sheet.
  //
  // `swapOption` is deliberately NOT cleared here: the submit reads the
  // destination from the swap store, and the processing screen still needs
  // the source/destination tokens to render. `handleSwapProcessingClose`
  // releases it once the user is done.
  //
  // Errors are handled inside `useSwapTransaction` so they survive this
  // component unmounting -- the same reason `SwapAmountScreen` calls
  // `executeSwap` bare rather than awaiting it.
  const handleConfirmSwap = useCallback(() => {
    hasApprovedSwapRef.current = true;
    isSubmittingSwapRef.current = true;
    dismissSwapSheets();
    earnSwap.executeSwap();
    swapProcessingBottomSheetModalRef.current?.present();
  }, [dismissSwapSheets, earnSwap]);

  // The processing sheet's content, captured when the swap starts and kept
  // until the sheet has closed: the swap state resets the moment the user
  // leaves, and rendering from it directly would empty the sheet while it
  // slides away.
  const [swapProcessingSnapshot, setSwapProcessingSnapshot] = useState<Omit<
    EarnSwapProcessingBottomSheetProps,
    "onClose"
  > | null>(null);
  useEffect(() => {
    if (
      earnSwap.isProcessing &&
      earnSwap.sourceToken &&
      earnSwap.destinationToken
    ) {
      setSwapProcessingSnapshot({
        sourceAmount: earnSwap.sourceAmount,
        sourceToken: earnSwap.sourceToken,
        destinationAmount: earnSwap.destinationAmount || "0",
        destinationToken: earnSwap.destinationToken,
      });
    }
  }, [
    earnSwap.isProcessing,
    earnSwap.sourceAmount,
    earnSwap.sourceToken,
    earnSwap.destinationAmount,
    earnSwap.destinationToken,
  ]);

  // X, Close and Done on the processing sheet. Close while the swap is still
  // in flight leaves it running; useSwapTransaction keeps handling its result.
  const handleSwapProcessingSheetClose = useCallback(
    (outcome: EarnSwapOutcome) => {
      swapOutcomeRef.current = outcome;
      earnSwap.handleProcessingScreenClose();
    },
    [earnSwap],
  );

  const handleCancelSwapSecurityWarning = useCallback(() => {
    swapSecurityWarningBottomSheetModalRef.current?.dismiss();
  }, []);

  // Continue on unable-to-scan opens Review, where Confirm still signs; on a
  // Malicious or Suspicious verdict it confirms, as Review's own "Confirm
  // anyway" does. The same as main Swap.
  const handleSwapProceedAnyway = useCallback(() => {
    if (earnSwap.isUnableToScan) {
      swapSecurityWarningBottomSheetModalRef.current?.dismiss();
      swapReviewBottomSheetModalRef.current?.present();
      return;
    }
    // Confirm closes every swap sheet bottom-up, this one last. Closing it
    // first would bring Review back, and gorhom ignores Review's own dismiss
    // while that happens, leaving Review under the processing sheet.
    handleConfirmSwap();
  }, [earnSwap.isUnableToScan, handleConfirmSwap]);

  // The review sheet's footer (settings / Cancel / Confirm) is NOT part of
  // `SwapReviewBottomSheet` -- it is a separate component the sheet takes as
  // `scrollViewFooterComponent`, which also requires `scrollable`. Omitting
  // both is what left the review with no way to submit.
  const { renderFooterComponent: renderSwapReviewFooter } = useSwapFooter({
    swapReviewBottomSheetModalRef,
    onConfirm: handleConfirmSwap,
    isBuilding: earnSwap.isBuilding,
    isMalicious: earnSwap.isMalicious,
    isSuspicious: earnSwap.isSuspicious,
    transactionXDR: earnSwap.transactionXDR,
    onSettingsPress: handleSwapSettingsPress,
  });

  // Leaves the swap branch entirely, releasing its captured reserve and
  // clearing the swap, so the next one starts clean. Runs once the swap
  // sheet has closed, whether by X, a tap outside or a swipe down, except
  // when Confirm closed it to submit. The sheets stacked over it only hide
  // it, so opening them doesn't count as a close.
  const handleSwapSheetDismiss = useCallback(() => {
    if (isSubmittingSwapRef.current) {
      isSubmittingSwapRef.current = false;
      return;
    }
    swapExitCountRef.current += 1;
    setSwapOption(null);
    earnSwap.reset();
    // These toasts stay up until dismissed; they go with the swap they
    // were about.
    dismissToast(SWAP_TOAST_IDS.FAILED_TO_SETUP_TRANSACTION);
    dismissToast(SWAP_TOAST_IDS.QUOTE_EXPIRED);
  }, [earnSwap, dismissToast]);

  useEffect(
    () => () => {
      dismissToast(SWAP_TOAST_IDS.FAILED_TO_SETUP_TRANSACTION);
      dismissToast(SWAP_TOAST_IDS.QUOTE_EXPIRED);
      // Leaving Earn, by Android's back for one, leaves the swap too.
      swapExitCountRef.current += 1;
    },
    [dismissToast],
  );

  // An in-flow "Receive funds" QR sheet, presented ON TOP of the "not enough"
  // sheet rather than replacing it, the same pattern the review sheet's
  // security-detail sheet uses. The user never leaves Earn.
  const handleReceivePress = useCallback(() => {
    if (notEnoughOption) {
      trackEarnFundingActionSelected({
        assetCode: notEnoughOption.code,
        action: "transfer",
      });
    }
    receiveFundsBottomSheetModalRef.current?.present();
  }, [notEnoughOption]);

  // Back returns to the "not enough" sheet underneath; X closes both, back
  // to the picker. The sheet underneath goes first: gorhom restores it as
  // soon as the top sheet starts closing and ignores a dismiss that arrives
  // in between, so closing Receive first left "not enough" open, as if X
  // were the back arrow.
  const handleReceiveBack = useCallback(() => {
    receiveFundsBottomSheetModalRef.current?.dismiss();
  }, []);

  const handleReceiveClose = useCallback(() => {
    handleCloseNotEnoughSheet();
    receiveFundsBottomSheetModalRef.current?.dismiss();
  }, [handleCloseNotEnoughSheet]);

  // There used to be a header-right info button here that opened
  // `PoolDetailsBottomSheet`, but that button was never in the design and
  // the design owner confirmed pool info isn't accessed from this screen.
  // `PoolDetailsBottomSheet` now has its real trigger on the amount screen's
  // `PoolCard` chevron instead (mirroring the extension's
  // `EarnAmount/PoolCard.tsx`'s `onOpenDetails`) — see `EarnAmountScreen`.

  const handlePoolChipPress = useOpenBlendApp();

  // XLM's total includes the minimum balance the account can't spend, so
  // its row shows what the deposit screen will offer: the same calculation
  // as that screen's "available".
  const { transactionFee } = useTransactionSettingsStore();
  const getHeldAmount = useCallback(
    (option: EarnTokenOption) =>
      option.isNative && option.balance
        ? calculateSpendableAmount({
            balance: option.balance,
            subentryCount: account?.subentryCount ?? 0,
            transactionFee,
          }).toFixed()
        : undefined,
    [account?.subentryCount, transactionFee],
  );

  const handleHeldTokenPress = useCallback(
    (option: EarnTokenOption) => {
      trackEarnTokenSelected({
        assetCode: option.code,
        poolId: option.poolId,
        apy: option.apy,
      });
      selectAsset({
        assetId: option.assetId,
        apy: option.apy,
        code: option.code,
        decimals: option.decimals,
      });
      navigation.navigate(EARN_ROUTES.EARN_AMOUNT_SCREEN, {
        assetId: option.assetId,
        tokenCode: option.code,
      });
    },
    [selectAsset, navigation],
  );

  // Continue: mark the intro seen and fall through to the picker rendered
  // below. `setHasSeenEarnIntro` writes synchronously, so the very next
  // render drops the intro -- no navigation involved, since the intro is a
  // full-screen early return from this same screen rather than its own route.
  const handleContinueEarnIntro = useCallback(() => {
    setHasSeenEarnIntro(true);
  }, [setHasSeenEarnIntro]);

  // The intro's X leaves Earn entirely, matching what this screen's own
  // header X does (`getScreenBottomNavigateOptions` -> `CustomHeaderButton`
  // -> `navigation.goBack()`, which pops the whole stack from its initial
  // route). It still marks the intro seen: a user who dismissed the pitch
  // should not be shown it again on this install.
  const handleCloseEarnIntro = useCallback(() => {
    setHasSeenEarnIntro(true);
    navigation.goBack();
  }, [setHasSeenEarnIntro, navigation]);

  // First-run interstitial, once per install (see
  // `usePreferencesStore.hasSeenEarnIntro`). Rendered INLINE as a full-screen
  // early return rather than as a route: `EARN_ROUTES` has no intro entry,
  // and a declared-but-unregistered route throws at runtime. Same pattern as
  // `EarnAmountScreen`'s inline `EarnProcessingScreen`.
  //
  // Deliberately gated ahead of the `isLoading`/`error` branches below so it
  // shows immediately on entry, with the token fetch resolving behind it --
  // the pitch does not depend on the token list, and gating it on the fetch
  // would flash a spinner before the first thing a new user ever sees.
  if (!hasSeenEarnIntro) {
    return (
      <EarnIntroScreen
        onContinue={handleContinueEarnIntro}
        onClose={handleCloseEarnIntro}
      />
    );
  }

  // Both full-screen states are gated on having NOTHING to show, not merely
  // on the flag: they early-return past the whole sheet tree below, so
  // firing one during a refresh unmounts every open bottom sheet -- which is
  // what made the swap sheet close by itself mid-configuration. A refresh
  // that already has rows keeps rendering them.
  const hasEarnRows = held.length > 0 || supported.length > 0;

  // The loading and error branches carry the same bare-X header as the list
  // below: the stack header is off for this route (see `EarnNavigator`), so
  // without it these states would have no way out of the flow.
  if (isLoading && !hasEarnRows) {
    return (
      <BaseLayout
        useSafeArea
        insets={{ top: false, bottom: true, left: false, right: false }}
      >
        <EarnScreenHeader onClose={() => navigation.goBack()} />
        <View className="flex-1 items-center justify-center">
          <Spinner testID="earn-token-picker-spinner" />
        </View>
      </BaseLayout>
    );
  }

  // Blend's routes are not deployed to staging or production yet — this is
  // the flow's most-exercised path in the real app today. It must read as a
  // failure to load, never as "no tokens available" (which would be
  // actively misleading about why the list is empty).
  if (error && !hasEarnRows) {
    return (
      <BaseLayout
        useSafeArea
        insets={{ top: false, bottom: true, left: false, right: false }}
      >
        <EarnScreenHeader onClose={() => navigation.goBack()} />
        <View
          className="flex-1 items-center justify-center gap-[24px]"
          style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
        >
          <View className="items-center gap-[8px]">
            <Text md medium primary textAlign="center">
              {t("earnTokenPicker.error.title")}
            </Text>
            <Text sm secondary textAlign="center">
              {t("earnTokenPicker.error.body")}
            </Text>
          </View>
          <Button
            secondary
            xl
            onPress={refetch}
            testID="earn-token-picker-retry"
          >
            {t("earnTokenPicker.error.retry")}
          </Button>
        </View>
      </BaseLayout>
    );
  }

  const heldSection = held.length > 0;
  const poolLabel = pool?.name
    ? `${t("earnTokenPicker.protocolName")} · ${getPoolDisplayName(pool.name, t)}`
    : t("earnTokenPicker.protocolName");

  return (
    <>
      <BaseLayout
        useSafeArea
        insets={{ top: false, bottom: false, left: false, right: false }}
      >
        <EarnScreenHeader onClose={() => navigation.goBack()} />

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="gap-[24px]"
          contentContainerStyle={{
            paddingHorizontal: pxValue(DEFAULT_PADDING),
            paddingBottom: insets.bottom + pxValue(DEFAULT_PADDING),
          }}
        >
          <View className="gap-[4px]">
            <Text xl medium primary>
              {t("earnTokenPicker.heading")}
            </Text>
            <Text sm regular secondary>
              {t("earnTokenPicker.subheading")}
            </Text>
          </View>

          <View className="gap-[24px]">
            <View className="gap-[8px]">
              <Text sm medium secondary>
                {t("earnTokenPicker.depositInto")}
              </Text>
              {/* The pool chip opens Blend's app. */}
              <TouchableOpacity
                onPress={handlePoolChipPress}
                activeOpacity={0.7}
                accessibilityRole="link"
                accessibilityLabel={poolLabel}
                className="h-[32px] flex-row items-center gap-[8px] self-start rounded-[8px] px-[10px] py-[4px]"
                style={{ backgroundColor: themeColors.gray[3] }}
                testID="earn-token-picker-pool-chip"
              >
                <View className="flex-row items-center gap-[4px]">
                  <BlendPoolIcon className="size-[16px] rounded-[4px]" />
                  <Text md medium primary>
                    {poolLabel}
                  </Text>
                </View>
                <Icon.LinkExternal01
                  size={14}
                  color={themeColors.foreground.primary}
                />
              </TouchableOpacity>
            </View>

            {heldSection ? (
              <View className="gap-[12px]">
                <Text md medium primary>
                  {t("earnTokenPicker.inYourWallet")}
                </Text>
                <View className="gap-[12px]">
                  {held.map((option) => (
                    <EarnTokenRow
                      key={option.assetId}
                      option={option}
                      amount={getHeldAmount(option)}
                      testID={`earn-token-option-${option.code}`}
                      onPress={() => handleHeldTokenPress(option)}
                    />
                  ))}
                </View>
              </View>
            ) : (
              // Holding none of the reserves: prose explaining why the
              // wallet section is absent.
              <View className="gap-[4px]" testID="earn-token-picker-empty-held">
                <Text md medium primary>
                  {t("earnTokenPicker.noSupportedAssets.title")}
                </Text>
                <Text sm regular secondary>
                  {t("earnTokenPicker.noSupportedAssets.body")}
                </Text>
              </View>
            )}

            {supported.length > 0 && (
              <View className="gap-[12px]">
                <Text md medium primary>
                  {t("earnTokenPicker.otherSupportedAssets")}
                </Text>
                <View className="gap-[12px]">
                  {supported.map((option) => (
                    <EarnTokenRow
                      key={option.assetId}
                      option={option}
                      testID={`earn-token-option-${option.code}`}
                      onPress={() => handleUnheldTokenPress(option)}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* The footnote to the APY pills' asterisk. */}
          <Text sm regular secondary testID="earn-token-picker-apy-disclaimer">
            {t("earnTokenPicker.apyDisclaimer")}
          </Text>
        </ScrollView>
      </BaseLayout>
      <BottomSheet
        modalRef={notEnoughBottomSheetModalRef}
        bottomSheetModalProps={{ onDismiss: () => setNotEnoughOption(null) }}
        customContent={
          <NotEnoughTokenBottomSheet
            variant={notEnoughVariant}
            tokenCode={notEnoughOption?.code ?? ""}
            token={notEnoughToken}
            onBuy={handleBuyPress}
            onSwap={handleSwapForToken}
            onReceive={handleReceivePress}
            onClose={handleCloseNotEnoughSheet}
          />
        }
      />
      <BottomSheet
        modalRef={swapBottomSheetModalRef}
        analyticsEvent={AnalyticsEvent.VIEW_SWAP_AMOUNT}
        analyticsProps={EARN_SWAP_ANALYTICS_PROPS}
        bottomSheetModalProps={{ onDismiss: handleSwapSheetDismiss }}
        customContent={
          swapOption && earnSwap.destination ? (
            <EarnSwapBottomSheet
              sourceBalance={earnSwap.sourceBalance}
              sourceLabel={earnSwap.sourceTokenSymbol}
              availableBalanceText={earnSwapAvailableText}
              onSourcePickerPress={handleSwapSourcePickerPress}
              converter={earnSwap.converter}
              hasUsdPrice={
                !!earnSwap.sourceBalance?.currentPrice &&
                !earnSwap.sourceBalance.currentPrice.isZero()
              }
              destinationToken={{
                code: swapOption.code,
                issuer: { key: earnSwap.destination.issuer ?? "" },
              }}
              destinationLabel={swapOption.code}
              destinationAmount={earnSwap.pathResult?.destinationAmount ?? "0"}
              sourceSecondaryText={earnSwapSourceSecondaryText}
              destinationSecondaryText={earnSwapDestinationFiatText}
              onPercentagePress={earnSwap.handlePercentagePress}
              onSettingsPress={handleSwapSettingsPress}
              onClose={dismissSwapSheets}
              onReview={earnSwap.isCtaDisabled ? null : handleSwapReview}
              ctaLabel={earnSwap.ctaLabel}
              // As on main Swap: also while the quote is catching up with
              // the amount, when Review does nothing yet.
              isReviewLoading={
                earnSwap.ctaState.kind === "loading" || isBuildingSwapReview
              }
              isBuildingReview={isBuildingSwapReview}
            />
          ) : null
        }
      />
      <BottomSheet
        modalRef={swapReviewBottomSheetModalRef}
        scrollable
        analyticsEvent={AnalyticsEvent.VIEW_SWAP_CONFIRM}
        analyticsProps={EARN_SWAP_ANALYTICS_PROPS}
        bottomSheetModalProps={{ onDismiss: handleSwapReviewDismiss }}
        scrollViewFooterComponent={renderSwapReviewFooter}
        customContent={
          <SwapReviewBottomSheet
            onSecurityWarningPress={() =>
              swapSecurityWarningBottomSheetModalRef.current?.present()
            }
            transactionSecurityAssessment={
              earnSwap.transactionSecurityAssessment
            }
            sourceSecurityAssessment={earnSwap.sourceSecurityAssessment}
            destinationSecurityAssessment={
              earnSwap.destinationSecurityAssessment
            }
          />
        }
      />
      <BottomSheet
        modalRef={swapSecurityWarningBottomSheetModalRef}
        customContent={
          <SecurityDetailBottomSheet
            warnings={earnSwap.securityWarnings}
            onCancel={handleCancelSwapSecurityWarning}
            onProceedAnyway={handleSwapProceedAnyway}
            onClose={handleCancelSwapSecurityWarning}
            severity={earnSwap.swapSecuritySeverity}
            proceedAnywayText={
              earnSwap.isUnableToScan
                ? t("common.continue")
                : t("transactionAmountScreen.confirmAnyway")
            }
          />
        }
      />
      <BottomSheet
        modalRef={swapSettingsBottomSheetModalRef}
        customContent={
          <TransactionSettingsBottomSheet
            context={TransactionContext.Swap}
            onCancel={handleCloseSwapSettings}
            onConfirm={handleCloseSwapSettings}
            onSettingsChange={handleSwapSettingsChange}
            operationCount={swapOperationCount}
          />
        }
      />
      <BottomSheet
        modalRef={swapProcessingBottomSheetModalRef}
        // Only X, Close and Done close it: they run the close handler that
        // ends the swap, which a swipe or a tap outside would skip.
        enablePanDownToClose={false}
        shouldCloseOnPressBackdrop={false}
        bottomSheetModalProps={{
          onDismiss: () => setSwapProcessingSnapshot(null),
        }}
        customContent={
          swapProcessingSnapshot ? (
            <EarnSwapProcessingBottomSheet
              {...swapProcessingSnapshot}
              onClose={handleSwapProcessingSheetClose}
            />
          ) : null
        }
      />
      <BottomSheet
        modalRef={swapFromBottomSheetModalRef}
        analyticsEvent={AnalyticsEvent.VIEW_SWAP_FROM_ASSET}
        analyticsProps={EARN_SWAP_ANALYTICS_PROPS}
        enableDynamicSizing={false}
        snapPoints={["90%"]}
        customContent={
          <EarnSwapFromBottomSheet
            balances={earnSwap.swappableBalances}
            network={network}
            onSelect={handleSwapSourceSelected}
            onBack={() => swapFromBottomSheetModalRef.current?.dismiss()}
            onClose={dismissSwapSheets}
          />
        }
      />
      <BottomSheet
        modalRef={receiveFundsBottomSheetModalRef}
        customContent={
          <ReceiveFundsBottomSheet
            onBack={handleReceiveBack}
            onClose={handleReceiveClose}
          />
        }
      />
    </>
  );
};

export default EarnTokenPickerScreen;
