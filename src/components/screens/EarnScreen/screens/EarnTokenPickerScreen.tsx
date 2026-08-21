import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import { EarnIntroBottomSheet } from "components/screens/EarnScreen/components/EarnIntroBottomSheet";
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
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SectionList, View } from "react-native";

type EarnTokenPickerScreenProps = NativeStackScreenProps<
  EarnStackParamList,
  typeof EARN_ROUTES.EARN_TOKEN_PICKER_SCREEN
>;

interface EarnTokenSection {
  kind: "held" | "supported";
  title: string;
  data: EarnTokenOption[];
}

export const EarnTokenPickerScreen: React.FC<EarnTokenPickerScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
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
  const earnIntroBottomSheetModalRef = useRef<BottomSheetModal>(null);
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

  const handleDismissEarnIntro = useCallback(() => {
    setHasSeenEarnIntro(true);
  }, [setHasSeenEarnIntro]);

  // Presents the first-run Earn intro sheet exactly once per mount, gated on
  // the persisted flag (see `usePreferencesStore.hasSeenEarnIntro`) rather
  // than a route: Task 13 removed the dead `EARN_ROUTES` intro entry because
  // a declared-but-unregistered route throws at runtime, so this is a sheet
  // over the token picker instead of a step in the stack.
  //
  // `hasPresentedEarnIntroRef` (rather than depending on `isLoading` alone)
  // guards against re-presenting after the sheet is dismissed: dismissing
  // sets `hasSeenEarnIntro` true, which would otherwise be a legitimate
  // dependency change that re-runs this effect on every subsequent
  // isLoading/error toggle (e.g. a later retry) with a stale `false` still
  // in a race. The ref makes "present at most once per mount" explicit
  // regardless of how those other dependencies settle.
  const hasPresentedEarnIntroRef = useRef(false);
  useEffect(() => {
    if (
      !isLoading &&
      !error &&
      !hasSeenEarnIntro &&
      !hasPresentedEarnIntroRef.current
    ) {
      hasPresentedEarnIntroRef.current = true;
      earnIntroBottomSheetModalRef.current?.present();
    }
  }, [isLoading, error, hasSeenEarnIntro]);

  if (isLoading) {
    return (
      <BaseLayout>
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
  if (error) {
    return (
      <BaseLayout>
        <View className="flex-1 items-center justify-center px-6">
          <Text md medium primary textAlign="center">
            {t("earnTokenPicker.error.title")}
          </Text>
          <View className="h-2" />
          <Text sm secondary textAlign="center">
            {t("earnTokenPicker.error.body")}
          </Text>
          <View className="h-6" />
          <Button secondary onPress={refetch} testID="earn-token-picker-retry">
            {t("earnTokenPicker.error.retry")}
          </Button>
        </View>
      </BaseLayout>
    );
  }

  const sections: EarnTokenSection[] = [
    {
      kind: "held" as const,
      title: t("earnTokenPicker.inYourAccount"),
      data: held,
    },
    {
      kind: "supported" as const,
      title: t("earnTokenPicker.supportedTokens"),
      data: supported,
    },
  ].filter((section) => section.data.length > 0);

  return (
    <>
      <BaseLayout insets={{ top: false, bottom: false }}>
        {/* Figma node 8828:19263: the disclaimer sits at the bottom of the
            screen (y=522 of a 600 canvas), well below where the list itself
            ends (y=356) -- not immediately after the last row. Wrapping the
            list in its own `flex-1` and keeping the disclaimer as a sibling
            (rather than a `ListFooterComponent`, which would scroll with the
            list and sit flush under the last row) pins it to the bottom of
            the screen on any device while the list scrolls above it. */}
        <View className="flex-1">
          <SectionList<EarnTokenOption, EarnTokenSection>
            sections={sections}
            keyExtractor={(item) => item.assetId}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <View className="mb-3">
                <Text md medium secondary>
                  {section.title}
                </Text>
              </View>
            )}
            renderItem={({ item, section }) => (
              <EarnTokenRow
                option={item}
                testID={`earn-token-option-${item.code}`}
                onPress={() =>
                  section.kind === "held"
                    ? handleHeldTokenPress(item)
                    : handleUnheldTokenPress(item)
                }
              />
            )}
          />
        </View>
        <View className="pb-6">
          <Text xs secondary textAlign="center">
            {t("earnTokenPicker.apyDisclaimer")}
          </Text>
        </View>
      </BaseLayout>
      <BottomSheet
        modalRef={earnIntroBottomSheetModalRef}
        handleCloseModal={handleDismissEarnIntro}
        analyticsEvent={AnalyticsEvent.VIEW_EARN_INTRO}
        bottomSheetModalProps={{ onDismiss: handleDismissEarnIntro }}
        // Content-sized (the default), matching every other sheet in this
        // feature. Figma node 9457:46768's 484-of-600 (~81%) is an artifact
        // of the mock's own canvas height, not a design rule -- a real
        // device's screen height doesn't share that ratio to the content's
        // actual (~498px) stack, so a percentage snap point would leave the
        // sheet oversized with dead space below the CTA. Letting it hug its
        // content reproduces the design's proportions on any device instead
        // of pinning to one canvas's ratio.
        customContent={
          <EarnIntroBottomSheet
            bottomSheetModalRef={earnIntroBottomSheetModalRef}
            onDismiss={handleDismissEarnIntro}
          />
        }
      />
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
