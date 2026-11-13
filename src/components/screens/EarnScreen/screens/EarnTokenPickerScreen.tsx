import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import blendIcon from "assets/logos/blend-icon.png";
import BigNumber from "bignumber.js";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import TransactionSettingsBottomSheet from "components/TransactionSettingsBottomSheet";
import { SecurityDetailBottomSheet } from "components/blockaid";
import { BaseLayout } from "components/layout/BaseLayout";
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
  NotEnoughVariant,
  getNotEnoughVariant,
  hasSwappableBalance,
  isOnrampableAsset,
} from "components/screens/EarnScreen/helpers";
import { useEarnSwap } from "components/screens/EarnScreen/hooks/useEarnSwap";
import {
  EarnTokenOption,
  useEarnTokens,
} from "components/screens/EarnScreen/hooks/useEarnTokens";
// Imported by module path rather than through `screens/index.ts`: this file is
// itself re-exported from that barrel, so going through it would close an
// import cycle.
import { EarnIntroScreen } from "components/screens/EarnScreen/screens/EarnIntroScreen";
import SwapReviewBottomSheet from "components/screens/SwapScreen/components/SwapReviewBottomSheet";
import { SWAP_TOAST_IDS } from "components/screens/SwapScreen/hooks/useSwapAmountError";
import { useSwapFooter } from "components/screens/SwapScreen/hooks/useSwapFooter";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { BLEND_LENDING_DOCS_URL } from "config/blend";
import {
  DEFAULT_PADDING,
  MIN_TRANSACTION_FEE,
  NATIVE_TOKEN_CODE,
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
import { Balance, Token } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useDebugStore } from "ducks/debug";
import { useEarnStore } from "ducks/earn";
import { usePreferencesStore } from "ducks/preferences";
import { useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { getTokenIdentifier } from "helpers/balances";
import { pxValue } from "helpers/dimensions";
import {
  formatBalanceAmount,
  formatFiatAmount,
  formatFiatInputDisplay,
  formatTokenForDisplay,
} from "helpers/formatAmount";
import { waitForKeyboardDismiss } from "helpers/keyboard";
import useAppTranslation from "hooks/useAppTranslation";
import { HeldBalanceItem } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import { useNetworkFees } from "hooks/useNetworkFees";
import { useToast } from "providers/ToastProvider";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Image,
  Keyboard,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SecurityLevel } from "services/blockaid/constants";
import { assessTransactionSecurity } from "services/blockaid/helper";

type EarnTokenPickerScreenProps = NativeStackScreenProps<
  EarnStackParamList,
  typeof EARN_ROUTES.EARN_TOKEN_PICKER_SCREEN
>;

export const EarnTokenPickerScreen: React.FC<EarnTokenPickerScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const { themeColors } = useColors();
  const { isLoading, error, held, supported, pool, refetch } = useEarnTokens();
  const insets = useSafeAreaInsets();
  const { open: openInAppBrowser } = useInAppBrowser();
  const { overriddenBlockaidResponse } = useDebugStore();
  const { recommendedFee } = useNetworkFees();
  const { account } = useGetActiveAccount();
  const selectAsset = useEarnStore((state) => state.selectAsset);
  const { network } = useAuthenticationStore();
  const { pricedBalances } = useBalancesStore();
  const hasSeenEarnIntro = usePreferencesStore(
    (state) => state.hasSeenEarnIntro,
  );
  const setHasSeenEarnIntro = usePreferencesStore(
    (state) => state.setHasSeenEarnIntro,
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

  // How the swap ended, recorded by the processing sheet just before it
  // closes, so the picker can announce the new balance.
  const swapOutcomeRef = useRef<EarnSwapOutcome | null>(null);

  // A completed swap leaves the user holding the reserve they came for, so
  // close the whole swap branch and drop them back on the picker -- refetching
  // so the row they wanted moves into "In your wallet" -- with a toast naming
  // what they got. Swap's own default (reset onto the History tab) would
  // strand them outside Earn entirely.
  const handleSwapProcessingClose = useCallback(() => {
    swapProcessingBottomSheetModalRef.current?.dismiss();
    swapReviewBottomSheetModalRef.current?.dismiss();
    swapBottomSheetModalRef.current?.dismiss();

    const outcome = swapOutcomeRef.current;
    swapOutcomeRef.current = null;
    if (outcome?.succeeded && swapOption) {
      showToast({
        variant: "success",
        title: t("earnSwap.swappedToast", {
          sourceCode: useSwapStore.getState().sourceTokenSymbol,
          destination: formatTokenForDisplay(
            outcome.destinationAmount,
            swapOption.code,
          ),
        }),
        toastId: "earn-swap-complete",
      });
    }

    setSwapOption(null);
    setNotEnoughOption(null);
    refetch();
  }, [refetch, showToast, swapOption, t]);

  const earnSwap = useEarnSwap({
    option: swapOption,
    onProcessingClose: handleSwapProcessingClose,
  });

  // "1,691.69 XLM available" on the sell card. Null hides the line, matching
  // `AmountCard`'s own contract.
  const earnSwapAvailableText = useMemo(() => {
    if (!earnSwap.sourceBalance || !earnSwap.spendableAmount) {
      return null;
    }
    return `${formatBalanceAmount(
      earnSwap.sourceBalance,
      earnSwap.sourceBalance.tokenCode ?? "",
      earnSwap.spendableAmount,
    )} ${t("common.available")}`;
  }, [earnSwap.sourceBalance, earnSwap.spendableAmount, t]);

  // The sell card's second line: the amount's other unit, as on the deposit
  // screen.
  const earnSwapSourceSecondaryText = earnSwap.converter.showFiatAmount
    ? formatTokenForDisplay(
        earnSwap.converter.tokenAmount || "0",
        earnSwap.sourceTokenSymbol,
      )
    : formatFiatInputDisplay(earnSwap.converter.fiatAmountDisplay || "0");

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
    // Over a dismissed keyboard: the swap sheet's keypad would otherwise
    // stay up over the list.
    Keyboard.dismiss();
    waitForKeyboardDismiss().then(() => {
      swapFromBottomSheetModalRef.current?.present();
    });
  }, []);

  const handleSwapSourceSelected = useCallback(
    (balance: HeldBalanceItem) => {
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
  const handleSwapReview = useCallback(async () => {
    try {
      const setup = await earnSwap.setupSwapTransaction();
      Keyboard.dismiss();
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
      showToast({
        variant: "error",
        title:
          setupError instanceof Error
            ? setupError.message
            : t("swapScreen.errors.failedToSetupTransaction"),
        toastId: SWAP_TOAST_IDS.FAILED_TO_SETUP_TRANSACTION,
        duration: 0,
      });
    }
  }, [earnSwap, overriddenBlockaidResponse, showToast, t]);

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

  /**
   * Zero-balance rows aren't deposit-ready — tapping one opens the "not
   * enough" sheet instead of navigating to the (unusable) amount screen.
   */
  const handleUnheldTokenPress = useCallback((option: EarnTokenOption) => {
    setNotEnoughOption(option);
    notEnoughBottomSheetModalRef.current?.present();
  }, []);

  const notEnoughVariant = useMemo(() => {
    if (!notEnoughOption) {
      return NotEnoughVariant.TRANSFER_ONLY;
    }

    const isOnrampable = isOnrampableAsset(
      notEnoughOption.code,
      networkDetails,
    );
    // No trustline for this asset means it can't appear as a key in
    // `pricedBalances` at all, so any identifier that isn't a real
    // "XLM"/"CODE:ISSUER" key is a safe placeholder — the reserve's own
    // contract address works and never collides.
    const targetIdentifier = notEnoughOption.balance
      ? getTokenIdentifier(notEnoughOption.balance)
      : notEnoughOption.assetId;
    // Swapping into a reserve the account has no trustline for opens one
    // first, in the same transaction: a second operation for the fee, and
    // another base reserve of XLM.
    const requiresTrustline =
      !notEnoughOption.isNative && !notEnoughOption.balance;
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
  }, [
    notEnoughOption,
    networkDetails,
    pricedBalances,
    account?.subentryCount,
    recommendedFee,
  ]);

  // The sheet's header renders the deposit asset's real icon, not a generic
  // glyph -- same
  // fallback as `EarnTokenRow`'s: prefer the held balance's real token
  // shape, otherwise reconstruct a minimal one from catalog data (native XLM
  // decided by `isNative`, never by code -- see that row's own comment for
  // why). `undefined` while no option is selected, matching `tokenCode`'s
  // own `?? ""` fallback below.
  const notEnoughToken: Token | Balance | undefined = notEnoughOption
    ? (notEnoughOption.balance ??
      (notEnoughOption.isNative
        ? { type: "native" as const, code: NATIVE_TOKEN_CODE as "XLM" }
        : {
            code: notEnoughOption.code,
            issuer: { key: notEnoughOption.assetId },
          }))
    : undefined;

  // The option is released once the sheet has closed, not as it starts
  // closing: clearing it first would empty the sheet while it slides away.
  const handleCloseNotEnoughSheet = useCallback(() => {
    notEnoughBottomSheetModalRef.current?.dismiss();
  }, []);

  const handleBuyPress = useCallback(() => {
    notEnoughBottomSheetModalRef.current?.dismiss();
    rootNavigation.navigate(ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK, {
      screen: ADD_FUNDS_ROUTES.ADD_FUNDS_SCREEN,
      params: { isUnfunded: false },
    });
  }, [rootNavigation]);

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
    swapSecurityWarningBottomSheetModalRef.current?.dismiss();
    swapReviewBottomSheetModalRef.current?.dismiss();
    swapFromBottomSheetModalRef.current?.dismiss();
    swapBottomSheetModalRef.current?.dismiss();
    earnSwap.executeSwap();
    swapProcessingBottomSheetModalRef.current?.present();
  }, [earnSwap]);

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
    swapSecurityWarningBottomSheetModalRef.current?.dismiss();
    if (earnSwap.isUnableToScan) {
      swapReviewBottomSheetModalRef.current?.present();
    } else {
      handleConfirmSwap();
    }
  }, [earnSwap.isUnableToScan, handleConfirmSwap]);

  const swapSecuritySeverity = useMemo(() => {
    if (earnSwap.isMalicious) {
      return SecurityLevel.MALICIOUS;
    }
    if (earnSwap.isSuspicious) {
      return SecurityLevel.SUSPICIOUS;
    }
    if (earnSwap.isUnableToScan) {
      return SecurityLevel.UNABLE_TO_SCAN;
    }
    return undefined;
  }, [earnSwap.isMalicious, earnSwap.isSuspicious, earnSwap.isUnableToScan]);

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

  // Leaves the swap branch entirely, releasing its captured reserve.
  const handleCloseSwap = useCallback(() => {
    swapFromBottomSheetModalRef.current?.dismiss();
    swapReviewBottomSheetModalRef.current?.dismiss();
    swapBottomSheetModalRef.current?.dismiss();
    setSwapOption(null);
  }, []);

  // An in-flow "Receive funds" QR sheet, presented ON TOP of the "not enough"
  // sheet rather than replacing it, the same pattern the review sheet's
  // security-detail sheet uses. The user never leaves Earn.
  const handleReceivePress = useCallback(() => {
    receiveFundsBottomSheetModalRef.current?.present();
  }, []);

  // Back returns to the "not enough" sheet underneath; X closes both.
  const handleReceiveBack = useCallback(() => {
    receiveFundsBottomSheetModalRef.current?.dismiss();
  }, []);

  const handleReceiveClose = useCallback(() => {
    receiveFundsBottomSheetModalRef.current?.dismiss();
    handleCloseNotEnoughSheet();
  }, [handleCloseNotEnoughSheet]);

  // There used to be a header-right info button here that opened
  // `PoolDetailsBottomSheet`, but that button was never in the design and
  // the design owner confirmed pool info isn't accessed from this screen.
  // `PoolDetailsBottomSheet` now has its real trigger on the amount screen's
  // `PoolCard` chevron instead (mirroring the extension's
  // `EarnAmount/PoolCard.tsx`'s `onOpenDetails`) — see `EarnAmountScreen`.

  const handlePoolChipPress = useCallback(() => {
    openInAppBrowser(BLEND_LENDING_DOCS_URL).catch((err) =>
      logger.error("EarnTokenPickerScreen", "Failed to open Blend docs", err),
    );
  }, [openInAppBrowser]);

  const handleHeldTokenPress = useCallback(
    (option: EarnTokenOption) => {
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
    ? `${t("earnTokenPicker.protocolName")} · ${pool.name}`
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
              {/* The pool chip opens Blend's lending docs. */}
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
                  <Image
                    source={blendIcon}
                    className="size-[16px] rounded-[4px]"
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
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
        analyticsEvent={AnalyticsEvent.VIEW_EARN_SWAP}
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
              onClose={handleCloseSwap}
              onReview={earnSwap.isCtaDisabled ? null : handleSwapReview}
              ctaLabel={earnSwap.ctaLabel}
              isReviewLoading={earnSwap.isLoadingPath}
            />
          ) : null
        }
      />
      <BottomSheet
        modalRef={swapReviewBottomSheetModalRef}
        scrollable
        analyticsEvent={AnalyticsEvent.VIEW_EARN_SWAP_REVIEW}
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
            severity={swapSecuritySeverity}
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
        enablePanDownToClose={false}
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
        enableDynamicSizing={false}
        snapPoints={["90%"]}
        customContent={
          <EarnSwapFromBottomSheet
            balances={earnSwap.swappableBalances}
            network={network}
            onSelect={handleSwapSourceSelected}
            onBack={() => swapFromBottomSheetModalRef.current?.dismiss()}
            onClose={handleCloseSwap}
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
