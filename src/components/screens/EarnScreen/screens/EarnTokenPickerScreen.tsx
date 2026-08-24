import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import blendIcon from "assets/logos/blend-icon.png";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import { EarnGlow } from "components/screens/EarnScreen/components/EarnGlow";
import { EarnScreenHeader } from "components/screens/EarnScreen/components/EarnScreenHeader";
import { EarnTokenRow } from "components/screens/EarnScreen/components/EarnTokenRow";
import { NotEnoughTokenBottomSheet } from "components/screens/EarnScreen/components/NotEnoughTokenBottomSheet";
import { ReceiveFundsBottomSheet } from "components/screens/EarnScreen/components/ReceiveFundsBottomSheet";
import {
  NotEnoughVariant,
  getNotEnoughVariant,
  hasSwappableBalance,
  isOnrampableAsset,
} from "components/screens/EarnScreen/helpers";
import {
  EarnTokenOption,
  useEarnTokens,
} from "components/screens/EarnScreen/hooks/useEarnTokens";
// Imported by module path rather than through `screens/index.ts`: this file is
// itself re-exported from that barrel, so going through it would close an
// import cycle.
import { EarnIntroScreen } from "components/screens/EarnScreen/screens/EarnIntroScreen";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import {
  NATIVE_TOKEN_CODE,
  mapNetworkToNetworkDetails,
} from "config/constants";
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
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
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
  const [notEnoughOption, setNotEnoughOption] =
    useState<EarnTokenOption | null>(null);

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

  // The swap-within-earn branch (prefilling a swap into the deposit asset)
  // doesn't exist yet on this branch -- the design owner has decided to
  // build it, so the button is wired to a named handler now rather than
  // routed to `SWAP_STACK` (that would jump the user out of Earn, the exact
  // drift this pass is correcting elsewhere) or omitted. Landing a named,
  // inert handler ahead of the real implementation mirrors this feature's
  // own established pattern (`handleUnheldTokenPress`, `openReviewSheet`
  // were both landed this way and filled in later).
  const handleSwapForToken = useCallback(() => {
    // Intentionally empty -- the swap-within-earn branch fills this in.
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

  // The loading and error branches carry the same bare-X header as the list
  // below: the stack header is off for this route (see `EarnNavigator`), so
  // without it these states would have no way out of the flow.
  if (isLoading) {
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
  if (error) {
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
