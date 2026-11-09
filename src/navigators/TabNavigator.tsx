import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from "@react-navigation/bottom-tabs";
import { FloatingTabBar } from "components/FloatingTabBar";
import {
  isPillBlurSupported,
  renderPillBlurScreenLayout,
} from "components/FloatingTabBar/PillBlur";
import { DiscoveryScreen } from "components/screens/DiscoveryScreen/DiscoveryScreen";
import { HistoryScreen } from "components/screens/HistoryScreen";
import HomeScreen from "components/screens/HomeScreen";
import { LoadingScreen } from "components/screens/LoadingScreen";
import { mapNetworkToNetworkDetails } from "config/constants";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useProtocolsStore } from "ducks/protocols";
import { useRecentProtocolsStore } from "ducks/recentProtocols";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { androidApiLevel } from "helpers/device";
import useAppTranslation from "hooks/useAppTranslation";
import { useFetchCollectibles } from "hooks/useFetchCollectibles";
import { useFetchPricedBalances } from "hooks/useFetchPricedBalances";
import { useFetchTokenIcons } from "hooks/useFetchTokenIcons";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useHistoryPolling } from "hooks/useHistoryPolling";
import { usePricedBalancesPolling } from "hooks/usePricedBalancesPolling";
import { useSwapTokenListsPrewarm } from "hooks/useSwapTokenListsPrewarm";
import { useSyncAccountsFiatTotals } from "hooks/useSyncAccountsFiatTotals";
import { renderTabBarIcon } from "navigators/tabBarIcons";
import React, { useEffect, useMemo } from "react";
import { Platform } from "react-native";

const MainTab = createBottomTabNavigator<MainTabStackParamList>();

/**
 * The floating pill, in place of React Navigation's full-width bar. It floats
 * over the screens, so each tab screen ends its content above it (see
 * `useFloatingTabBarClearance`).
 */
const renderFloatingTabBar = (props: BottomTabBarProps) => (
  <FloatingTabBar {...props} />
);

/**
 * The main tabs: History, Home and, behind the `discover_enabled` remote
 * flag, Discover. They sit under the floating pill tab bar; on Android 12+
 * each tab screen is wrapped in the blur target the pill blurs. It also loads
 * Discover's protocols once, after the recent-protocols store rehydrates, and
 * shows a loading screen until there's an active account.
 */
export const TabNavigator = () => {
  const { account } = useGetActiveAccount();
  const publicKey = account?.publicKey;
  const { t } = useAppTranslation();
  const { network: activeNetwork } = useAuthenticationStore();
  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(activeNetwork),
    [activeNetwork],
  );
  const { fetchProtocols } = useProtocolsStore();
  const { discover_enabled: discoverEnabled } = useRemoteConfigStore();

  // Fetch balances when component mounts or when publicKey/network changes
  useFetchPricedBalances({
    publicKey: publicKey ?? "",
    network: networkDetails.network,
  });

  // Fetch collectibles when component mounts or when publicKey/network changes
  useFetchCollectibles({
    publicKey,
    network: networkDetails.network,
  });

  // Fetch icons whenever balances are updated
  useFetchTokenIcons(networkDetails.network);

  // Pre-warm Swap token-list caches (top-50 + verified + Blockaid)
  useSwapTokenListsPrewarm(networkDetails.network);

  // Start polling for balance and price updates
  usePricedBalancesPolling({
    publicKey: publicKey ?? "",
    network: networkDetails.network,
  });

  // Mirror active-account balance changes into the manage-accounts sheet's
  // per-account USD totals
  useSyncAccountsFiatTotals({
    publicKey: publicKey ?? "",
    network: networkDetails.network,
  });

  // Start polling for history updates
  useHistoryPolling({
    publicKey: publicKey ?? "",
    network: networkDetails.network,
  });

  // Hydrate the recent protocols store first, then fetch protocols and
  // prune any stale entries. Ordering matters: if fetchProtocols resolves
  // before rehydrate completes, pruneStaleProtocols would run against an
  // empty list and miss stale entries.
  useEffect(() => {
    Promise.resolve(useRecentProtocolsStore.persist.rehydrate()).then(() => {
      fetchProtocols().then(() => {
        const { protocols } = useProtocolsStore.getState();
        useRecentProtocolsStore.getState().pruneStaleProtocols(protocols);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!publicKey) {
    return <LoadingScreen />;
  }

  return (
    <MainTab.Navigator
      initialRouteName={MAIN_TAB_ROUTES.TAB_HOME}
      tabBar={renderFloatingTabBar}
      // On Android 12+ each screen sits in the blur target the pill blurs.
      screenLayout={
        isPillBlurSupported(Platform.OS, androidApiLevel)
          ? renderPillBlurScreenLayout
          : undefined
      }
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: (props) => renderTabBarIcon(route.name, props),
      })}
    >
      {/* The pill draws no text, so each tab's label is what screen readers
          announce. */}
      <MainTab.Screen
        name={MAIN_TAB_ROUTES.TAB_HISTORY}
        component={HistoryScreen}
        options={{
          tabBarButtonTestID: "tab-history",
          tabBarAccessibilityLabel: t("tabBar.history"),
        }}
      />
      <MainTab.Screen
        name={MAIN_TAB_ROUTES.TAB_HOME}
        component={HomeScreen}
        options={{
          tabBarButtonTestID: "tab-home",
          tabBarAccessibilityLabel: t("tabBar.home"),
        }}
      />
      {discoverEnabled && (
        <MainTab.Screen
          name={MAIN_TAB_ROUTES.TAB_DISCOVERY}
          component={DiscoveryScreen}
          options={{ tabBarAccessibilityLabel: t("tabBar.discover") }}
        />
      )}
    </MainTab.Navigator>
  );
};
