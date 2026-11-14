import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import { NavigationHeaderBar } from "components/layout/CustomNavigationHeader";
import { HeaderFade } from "components/layout/HeaderFade";
import { EthenaLaunchHero } from "components/screens/EthenaLaunchScreen/EthenaLaunchHero";
import { EthenaTokenSection } from "components/screens/EthenaLaunchScreen/EthenaTokenSection";
import {
  ETHENA_DOCS_URL,
  ETHENA_LAUNCH_COLORS,
  ETHENA_LAUNCH_TOKENS,
  EthenaLaunchToken,
} from "components/screens/EthenaLaunchScreen/ethenaLaunchConfig";
import { getScrollCueTargetY } from "components/screens/EthenaLaunchScreen/scrollCue";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  MAIN_TAB_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { pxValue } from "helpers/dimensions";
import { markEthenaLaunchPromoSeen } from "helpers/ethenaLaunchPromo";
import useAppTranslation from "hooks/useAppTranslation";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { analytics } from "services/analytics";
import { DISCOVER_ANALYTICS_SOURCE } from "services/analytics/discover";

type EthenaLaunchScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.ETHENA_LAUNCH_SCREEN
>;

// Swap, Receive and Learn more each leave the screen or cover it, so a second
// tap in quick succession would open a second tab, screen or browser.
const ACTION_GUARD_MS = 1000;
const LEARN_MORE_ICON_SIZE = 18;

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: ETHENA_LAUNCH_COLORS.page,
  },
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  learnMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: pxValue(8),
    marginTop: pxValue(8),
  },
});

/**
 * Full-screen "Meet Ethena on Stellar" launch promo, the same in both themes.
 * Opens on its own once for wallets that predate the launch, and from the
 * Home banner. Swap opens Sushi in a Discover tab, Receive shows the
 * account's QR code, and Learn more opens Ethena's docs.
 */
export const EthenaLaunchScreen: React.FC<EthenaLaunchScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { open: openInAppBrowser } = useInAppBrowser();
  const discoverEnabled = useRemoteConfigStore(
    (state) => state.discover_enabled,
  );
  const addTab = useBrowserTabsStore((state) => state.addTab);
  const setShowTabOverview = useBrowserTabsStore(
    (state) => state.setShowTabOverview,
  );
  const lastActionAt = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const cueY = useRef(0);
  const barBottom = useRef(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const { source } = route.params;

  useEffect(() => {
    markEthenaLaunchPromoSeen();
    analytics.track(AnalyticsEvent.ETHENA_LAUNCH_PROMO_VIEWED, { source });
  }, [source]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIsScrolled(event.nativeEvent.contentOffset.y > 0);
    },
    [],
  );

  const handleCuePress = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: getScrollCueTargetY(cueY.current, barBottom.current),
      animated: true,
    });
  }, []);

  const runOnce = useCallback((action: () => void) => {
    const now = Date.now();
    if (now - lastActionAt.current < ACTION_GUARD_MS) {
      return;
    }
    lastActionAt.current = now;
    action();
  }, []);

  const handleSwap = useCallback(
    (token: EthenaLaunchToken) =>
      runOnce(() => {
        analytics.track(AnalyticsEvent.ETHENA_LAUNCH_SWAP_TAPPED, {
          token: token.code,
        });
        addTab(token.swapUrl);
        analytics.trackDiscoverTabCreated(
          useBrowserTabsStore.getState().tabs.length,
          DISCOVER_ANALYTICS_SOURCE.ETHENA_LAUNCH_PROMO,
        );
        setShowTabOverview(false);
        navigation.popTo(ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK, {
          screen: MAIN_TAB_ROUTES.TAB_DISCOVERY,
        });
      }),
    [runOnce, addTab, setShowTabOverview, navigation],
  );

  const handleReceive = useCallback(
    (token: EthenaLaunchToken) =>
      runOnce(() => {
        analytics.track(AnalyticsEvent.ETHENA_LAUNCH_RECEIVE_TAPPED, {
          token: token.code,
        });
        navigation.navigate(ROOT_NAVIGATOR_ROUTES.SCAN_RECEIVE_SCREEN, {
          initialTab: "receive",
        });
      }),
    [runOnce, navigation],
  );

  const handleLearnMore = useCallback(
    () =>
      runOnce(() => {
        analytics.track(AnalyticsEvent.ETHENA_LAUNCH_LEARN_MORE_TAPPED);
        openInAppBrowser(ETHENA_DOCS_URL);
      }),
    [runOnce, openInAppBrowser],
  );

  const tokenCopy: Record<
    EthenaLaunchToken["id"],
    { name: string; description: string }
  > = {
    usde: {
      name: t("ethenaLaunchScreen.usdeName"),
      description: t("ethenaLaunchScreen.usdeDescription"),
    },
    susde: {
      name: t("ethenaLaunchScreen.susdeName"),
      description: t("ethenaLaunchScreen.susdeDescription"),
    },
  };

  return (
    <View testID="ethena-launch-screen" style={styles.page}>
      {/* The page is black in both themes. Only while it's on top, so a
          screen pushed over it (Receive) gets the theme's status bar back. */}
      {isFocused && <StatusBar barStyle="light-content" />}

      <ScrollView
        ref={scrollRef}
        testID="ethena-launch-scroll"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <EthenaLaunchHero
          onCuePress={handleCuePress}
          onCueLayout={(y) => {
            cueY.current = y;
          }}
        />

        <View style={{ paddingBottom: pxValue(32) + insets.bottom }}>
          {ETHENA_LAUNCH_TOKENS.map((token) => (
            <EthenaTokenSection
              key={token.id}
              token={token}
              name={tokenCopy[token.id].name}
              description={tokenCopy[token.id].description}
              canSwap={discoverEnabled}
              onSwap={handleSwap}
              onReceive={handleReceive}
            />
          ))}

          <TouchableOpacity
            testID="ethena-launch-learn-more"
            style={styles.learnMore}
            onPress={handleLearnMore}
            accessibilityRole="link"
          >
            <Text md medium color={ETHENA_LAUNCH_COLORS.textSecondary}>
              {t("ethenaLaunchScreen.learnMore")}
            </Text>
            <Icon.ArrowUpRight
              size={pxValue(LEARN_MORE_ICON_SIZE)}
              color={ETHENA_LAUNCH_COLORS.icon}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View
        testID="ethena-launch-bar"
        style={styles.bar}
        onLayout={(event: LayoutChangeEvent) => {
          barBottom.current = event.nativeEvent.layout.height;
        }}
      >
        {/* Home's header fade, once content scrolls up under the bar. */}
        {isScrolled && <HeaderFade colorScheme="dark" />}
        <NavigationHeaderBar
          isTransparent
          right={
            <CustomHeaderButton
              position="right"
              variant="close"
              iconColor={ETHENA_LAUNCH_COLORS.textPrimary}
              onPress={() => navigation.goBack()}
              testID="ethena-launch-close"
            />
          }
        />
      </View>
    </View>
  );
};
