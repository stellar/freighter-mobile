import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import { EarnIntroBottomSheet } from "components/screens/EarnScreen/components/EarnIntroBottomSheet";
import { EarnTokenRow } from "components/screens/EarnScreen/components/EarnTokenRow";
import { NotEnoughTokenBottomSheet } from "components/screens/EarnScreen/components/NotEnoughTokenBottomSheet";
import { PoolDetailsBottomSheet } from "components/screens/EarnScreen/components/PoolDetailsBottomSheet";
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
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { mapNetworkToNetworkDetails } from "config/constants";
import {
  ADD_FUNDS_ROUTES,
  EARN_ROUTES,
  EarnStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useEarnStore } from "ducks/earn";
import { usePreferencesStore } from "ducks/preferences";
import { getTokenIdentifier } from "helpers/balances";
import useAppTranslation from "hooks/useAppTranslation";
import { useRightHeaderButton } from "hooks/useRightHeader";
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
  const { isLoading, error, held, supported, pool, refetch } = useEarnTokens();
  const selectAsset = useEarnStore((state) => state.selectAsset);
  const { network } = useAuthenticationStore();
  const { pricedBalances } = useBalancesStore();
  const hasSeenEarnIntro = usePreferencesStore(
    (state) => state.hasSeenEarnIntro,
  );
  const setHasSeenEarnIntro = usePreferencesStore(
    (state) => state.setHasSeenEarnIntro,
  );
  const poolDetailsBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const notEnoughBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const earnIntroBottomSheetModalRef = useRef<BottomSheetModal>(null);
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

  const handleReceivePress = useCallback(() => {
    notEnoughBottomSheetModalRef.current?.dismiss();
    rootNavigation.navigate(ROOT_NAVIGATOR_ROUTES.SCAN_RECEIVE_SCREEN, {
      initialTab: "receive",
    });
  }, [rootNavigation]);

  /**
   * Opens the pool details sheet. Guarded on `pool` because the header
   * button is wired up unconditionally (even while useEarnTokens is still
   * loading or has errored) — there is nothing to present until the pool
   * has resolved.
   */
  const handlePoolInfoPress = useCallback(() => {
    if (!pool) return;
    poolDetailsBottomSheetModalRef.current?.present();
  }, [pool]);

  useRightHeaderButton({
    onPress: handlePoolInfoPress,
    icon: Icon.InfoCircle,
  });

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
        <SectionList<EarnTokenOption, EarnTokenSection>
          sections={sections}
          keyExtractor={(item) => item.assetId}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View className="mt-4 mb-6">
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
          ListFooterComponent={
            <View className="mt-2 mb-6">
              <Text xs secondary textAlign="center">
                {t("earnTokenPicker.apyDisclaimer")}
              </Text>
            </View>
          }
        />
      </BaseLayout>
      <BottomSheet
        modalRef={earnIntroBottomSheetModalRef}
        handleCloseModal={handleDismissEarnIntro}
        analyticsEvent={AnalyticsEvent.VIEW_EARN_INTRO}
        bottomSheetModalProps={{ onDismiss: handleDismissEarnIntro }}
        customContent={
          <EarnIntroBottomSheet
            bottomSheetModalRef={earnIntroBottomSheetModalRef}
            onDismiss={handleDismissEarnIntro}
          />
        }
      />
      <BottomSheet
        modalRef={poolDetailsBottomSheetModalRef}
        handleCloseModal={() =>
          poolDetailsBottomSheetModalRef.current?.dismiss()
        }
        customContent={
          <PoolDetailsBottomSheet
            pool={pool}
            bottomSheetModalRef={poolDetailsBottomSheetModalRef}
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
            onBuy={handleBuyPress}
            onReceive={handleReceivePress}
            onClose={handleCloseNotEnoughSheet}
          />
        }
      />
    </>
  );
};

export default EarnTokenPickerScreen;
