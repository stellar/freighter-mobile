import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import blendIcon from "assets/logos/blend-icon.png";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import { EarnGlow } from "components/screens/EarnScreen/components/EarnGlow";
import { EarnScreenHeader } from "components/screens/EarnScreen/components/EarnScreenHeader";
import { EarnSwapBottomSheet } from "components/screens/EarnScreen/components/EarnSwapBottomSheet";
import { EarnSwapFromBottomSheet } from "components/screens/EarnScreen/components/EarnSwapFromBottomSheet";
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
import { SwapProcessingScreen } from "components/screens/SwapScreen/screens";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  NATIVE_TOKEN_CODE,
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
import { useEarnStore } from "ducks/earn";
import { usePreferencesStore } from "ducks/preferences";
import { getTokenIdentifier } from "helpers/balances";
import { formatBalanceAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import { HeldBalanceItem } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import { useToast } from "providers/ToastProvider";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Image, ScrollView, View } from "react-native";

type EarnTokenPickerScreenProps = NativeStackScreenProps<
  EarnStackParamList,
  typeof EARN_ROUTES.EARN_TOKEN_PICKER_SCREEN
>;

/**
 * Figma `13701:332629` places content at y=118 and the X's box at y=70..94,
 * i.e. 24 below the icon. The glow's circle is centered at (201, 725) with a
 * 0.7 fill opacity, unlike the intro's full-opacity one.
 */
const CONTENT_TOP_OFFSET = 24;
const GLOW_CENTER_Y = 725;
const GLOW_OPACITY = 0.7;

export const EarnTokenPickerScreen: React.FC<EarnTokenPickerScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const { themeColors } = useColors();
  const { isLoading, error, held, supported, refetch } = useEarnTokens();
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

  // A completed swap leaves the user holding the reserve they came for, so
  // close the whole swap branch and drop them back on the picker -- refetching
  // so the row they wanted moves from "Supported tokens" into "In your
  // account". Swap's own default (reset onto the History tab) would strand
  // them outside Earn entirely.
  const handleSwapProcessingClose = useCallback(() => {
    swapReviewBottomSheetModalRef.current?.dismiss();
    swapBottomSheetModalRef.current?.dismiss();
    setSwapOption(null);
    setNotEnoughOption(null);
    refetch();
  }, [refetch]);

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

  // "Swap from" (design `13723:343723`) stacks over the swap sheet rather
  // than replacing it, so its back arrow can return with the source
  // unchanged. The swap sheet stays mounted underneath.
  const handleSwapSourcePickerPress = useCallback(() => {
    swapFromBottomSheetModalRef.current?.present();
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
  const handleSwapReview = useCallback(async () => {
    try {
      await earnSwap.setupSwapTransaction();
      swapReviewBottomSheetModalRef.current?.present();
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
  }, [earnSwap, showToast, t]);

  // Swap's own settings sheet is reached from `SwapAmountScreen`'s header and
  // is route-scoped to `SWAP_STACK`; wiring it from here needs that sheet
  // lifted out of the stack first. The control is in the design, so it is
  // rendered and named rather than dropped -- see the branch's follow-ups.
  const handleSwapSettingsPress = useCallback(() => {}, []);

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
    const isSwappable = hasSwappableBalance(pricedBalances, targetIdentifier);

    return getNotEnoughVariant({ isOnrampable, isSwappable });
  }, [notEnoughOption, networkDetails, pricedBalances]);

  // The sheet's header renders the deposit asset's real icon (design nodes
  // `9457:46399`/`9457:46345`/`9457:46530`), not a generic glyph -- same
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

  const handleCloseNotEnoughSheet = useCallback(() => {
    notEnoughBottomSheetModalRef.current?.dismiss();
    setNotEnoughOption(null);
  }, []);

  const handleBuyPress = useCallback(() => {
    notEnoughBottomSheetModalRef.current?.dismiss();
    rootNavigation.navigate(ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK, {
      screen: ADD_FUNDS_ROUTES.ADD_FUNDS_SCREEN,
      params: { isUnfunded: false },
    });
  }, [rootNavigation]);

  // Swap-within-Earn (design `13722:341980`): opens a sheet stacked OVER the
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
    swapReviewBottomSheetModalRef.current?.dismiss();
    swapFromBottomSheetModalRef.current?.dismiss();
    swapBottomSheetModalRef.current?.dismiss();
    earnSwap.executeSwap();
  }, [earnSwap]);

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

  // Design node `9457:46184`: an in-flow "Receive funds" QR sheet, presented
  // ON TOP of the "not enough" sheet rather than replacing it -- the mock
  // itself composites this sheet directly over the one that opened it, and
  // this mirrors the review sheet's own security-detail sheet
  // (`EarnAmountScreen`'s `onSecurityWarningPress`), the established pattern
  // in this feature for stacking a sheet without dismissing the one beneath.
  // Dismissing this sheet leaves the "not enough" sheet exactly as it was --
  // the user never leaves Earn. Previously this navigated cross-stack to
  // `ROOT_NAVIGATOR_ROUTES.SCAN_RECEIVE_SCREEN`, ejecting the user from the
  // flow entirely.
  const handleReceivePress = useCallback(() => {
    receiveFundsBottomSheetModalRef.current?.present();
  }, []);

  // There used to be a header-right info button here that opened
  // `PoolDetailsBottomSheet`, but that button was never in the design and
  // the design owner confirmed pool info isn't accessed from this screen.
  // `PoolDetailsBottomSheet` now has its real trigger on the amount screen's
  // `PoolCard` chevron instead (mirroring the extension's
  // `EarnAmount/PoolCard.tsx`'s `onOpenDetails`) — see `EarnAmountScreen`.

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

  // The swap's submit lifecycle. `executeSwap` flips this the moment Confirm
  // is pressed; without rendering it the user saw the review dismiss and the
  // swap sheet reappear with no feedback at all -- which reads as "Confirm
  // did nothing", even though the transaction was in flight. Regular Swap
  // early-returns the same screen from `SwapAmountScreen`.
  //
  // Sits above the sheet tree deliberately: the processing screen owns the
  // whole surface, so the sheets underneath should be gone by then.
  if (earnSwap.isProcessing) {
    return (
      <SwapProcessingScreen
        onClose={earnSwap.handleProcessingScreenClose}
        sourceAmount={earnSwap.sourceAmount}
        sourceToken={earnSwap.sourceToken}
        destinationAmount={earnSwap.destinationAmount || "0"}
        destinationToken={earnSwap.destinationToken}
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
        insets={{ top: true, bottom: true, left: false, right: false }}
      >
        <View className="flex-1 px-6">
          <EarnScreenHeader onClose={() => navigation.goBack()} />
          <View className="flex-1 items-center justify-center">
            <Spinner testID="earn-token-picker-spinner" />
          </View>
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
        insets={{ top: true, bottom: true, left: false, right: false }}
      >
        <View className="flex-1 px-6">
          <EarnScreenHeader onClose={() => navigation.goBack()} />
          <View className="flex-1 items-center justify-center">
            <Text md medium primary textAlign="center">
              {t("earnTokenPicker.error.title")}
            </Text>
            <View className="h-2" />
            <Text sm secondary textAlign="center">
              {t("earnTokenPicker.error.body")}
            </Text>
            <View className="h-6" />
            <Button
              secondary
              onPress={refetch}
              testID="earn-token-picker-retry"
            >
              {t("earnTokenPicker.error.retry")}
            </Button>
          </View>
        </View>
      </BaseLayout>
    );
  }

  // Figma `13701:332629` groups the list as: an "in your account" area
  // (replaced by an empty-state block when the user holds none of the
  // reserves), then "Supported tokens". The mock only draws the empty
  // variant, so the held variant keeps this screen's existing section header
  // and rows, restyled to the new spec.
  const heldSection = held.length > 0;

  return (
    <>
      <BaseLayout
        useSafeArea
        backgroundColor={themeColors.background.primary}
        insets={{ top: true, bottom: true, left: false, right: false }}
      >
        {/* Design node `13701:332635`: same blurred circle as the intro but at
            70% fill opacity, centered low on the screen behind the disclaimer
            rather than behind a logo. */}
        <EarnGlow centerY={GLOW_CENTER_Y} opacity={GLOW_OPACITY} />

        <View className="flex-1 px-6">
          <EarnScreenHeader onClose={() => navigation.goBack()} />

          <View className="flex-1" style={{ marginTop: CONTENT_TOP_OFFSET }}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerClassName="gap-10 pb-6"
            >
              {/* Title block: the Blend badge, then heading + subheading.
                  These moved OUT of the navigation header in this redesign --
                  the header is now a bare X (see `EarnScreenHeader`). */}
              <View className="gap-2">
                <View
                  className="h-8 flex-row items-center justify-center self-start gap-1 rounded-lg px-2.5 py-1"
                  style={{ backgroundColor: themeColors.background.tertiary }}
                >
                  {/* A different Blend mark from the intro's outlined jar --
                      a filled glyph on a transparent ground -- so it ships as
                      its own asset rather than reusing `blend-logo.svg`. */}
                  <Image
                    source={blendIcon}
                    className="size-5 rounded"
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                  <Text md medium primary>
                    {t("earnTokenPicker.protocolName")}
                  </Text>
                </View>

                <View className="gap-1">
                  {/* Text/LG/500 (18/26) -- SDS `Text lg` is 18/26 exactly. */}
                  <Text lg medium primary>
                    {t("earnTokenPicker.heading")}
                  </Text>
                  <Text sm regular secondary>
                    {t("earnTokenPicker.subheading")}
                  </Text>
                </View>
              </View>

              <View className="gap-6">
                {heldSection ? (
                  <View className="gap-3">
                    <Text md medium primary>
                      {t("earnTokenPicker.inYourAccount")}
                    </Text>
                    <View className="gap-3">
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
                  // Design nodes `13701:332739`/`332774`: where the held
                  // section would be, prose explaining why it is absent.
                  <View className="gap-1" testID="earn-token-picker-empty-held">
                    <Text md medium primary>
                      {t("earnTokenPicker.noSupportedAssets.title")}
                    </Text>
                    <Text sm regular secondary>
                      {t("earnTokenPicker.noSupportedAssets.body")}
                    </Text>
                  </View>
                )}

                {supported.length > 0 && (
                  <View className="gap-3">
                    <Text md medium primary>
                      {t("earnTokenPicker.supportedTokens")}
                    </Text>
                    <View className="gap-3">
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
          </View>

          {/* Node `13701:332636`: the disclaimer is pinned near the bottom of
              the screen, well below where the list ends -- not flush under the
              last row. Keeping it a sibling of the scroll area (rather than
              inside it) holds it there on any device while the list scrolls. */}
          <View className="pb-6">
            <Text sm regular secondary textAlign="center">
              {t("earnTokenPicker.apyDisclaimer")}
            </Text>
          </View>
        </View>
      </BaseLayout>
      <BottomSheet
        modalRef={notEnoughBottomSheetModalRef}
        handleCloseModal={handleCloseNotEnoughSheet}
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
        handleCloseModal={() => swapBottomSheetModalRef.current?.dismiss()}
        enableDynamicSizing={false}
        snapPoints={["90%"]}
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
        handleCloseModal={() =>
          swapReviewBottomSheetModalRef.current?.dismiss()
        }
        scrollable
        analyticsEvent={AnalyticsEvent.VIEW_EARN_SWAP_REVIEW}
        scrollViewFooterComponent={renderSwapReviewFooter}
        customContent={
          <SwapReviewBottomSheet
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
        modalRef={swapFromBottomSheetModalRef}
        handleCloseModal={() => swapFromBottomSheetModalRef.current?.dismiss()}
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
        handleCloseModal={() =>
          receiveFundsBottomSheetModalRef.current?.dismiss()
        }
        customContent={
          <ReceiveFundsBottomSheet
            bottomSheetModalRef={receiveFundsBottomSheetModalRef}
          />
        }
      />
    </>
  );
};

export default EarnTokenPickerScreen;
