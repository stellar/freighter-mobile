import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DiscoveryScreen } from "components/screens/DiscoveryScreen/DiscoveryScreen";
import { HistoryScreen } from "components/screens/HistoryScreen";
import HomeScreen from "components/screens/HomeScreen";
import { LoadingScreen } from "components/screens/LoadingScreen";
import Icon from "components/sds/Icon";
import { mapNetworkToNetworkDetails } from "config/constants";
import { logger } from "config/logger";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useProtocolsStore } from "ducks/protocols";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { px, pxValue } from "helpers/dimensions";
import { useFetchCollectibles } from "hooks/useFetchCollectibles";
import { useFetchPricedBalances } from "hooks/useFetchPricedBalances";
import { useFetchTokenIcons } from "hooks/useFetchTokenIcons";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useHistoryPolling } from "hooks/useHistoryPolling";
import { usePricedBalancesPolling } from "hooks/usePricedBalancesPolling";
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components/native";

const MainTab = createBottomTabNavigator<MainTabStackParamList>();

// Maximum time to wait for public key to load before forcing navigation
const PUBLIC_KEY_LOADING_TIMEOUT_MS = 5000; // 5 seconds

const TAB_ICON_SIZE = 20;

interface TabIconWrapperProps {
  focused: boolean;
}

const TabIconWrapper = styled.View<TabIconWrapperProps>`
  width: ${px(80)};
  height: ${px(36)};
  margin-top: ${px(10)};
  border-radius: ${px(100)};
  justify-content: center;
  align-items: center;
  background: ${({ focused }: TabIconWrapperProps) =>
    focused
      ? THEME.colors.tab.activeBackground
      : THEME.colors.tab.inactiveBackground};
`;

const TAB_ICONS = {
  [MAIN_TAB_ROUTES.TAB_HISTORY]: Icon.ClockRewind,
  [MAIN_TAB_ROUTES.TAB_HOME]: Icon.Home02,
  [MAIN_TAB_ROUTES.TAB_DISCOVERY]: Icon.Compass03,
} as const;

interface TabIconProps {
  route: { name: keyof typeof TAB_ICONS };
  focused: boolean;
  color: string;
}

const TabIcon = ({ route, focused, color }: TabIconProps) => {
  const IconComponent = TAB_ICONS[route.name];
  return (
    <TabIconWrapper focused={focused}>
      <IconComponent size={TAB_ICON_SIZE} color={color} />
    </TabIconWrapper>
  );
};

export const TabNavigator = () => {
  const { account } = useGetActiveAccount();
  const publicKey = account?.publicKey;
  const {
    network: activeNetwork,
    authStatus,
    logout,
  } = useAuthenticationStore();
  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(activeNetwork),
    [activeNetwork],
  );
  const { fetchProtocols } = useProtocolsStore();
  const { discover_enabled: discoverEnabled } = useRemoteConfigStore();
  const [publicKeyTimedOut, setPublicKeyTimedOut] = useState(false);

  // Safety timeout: If publicKey doesn't load within 10 seconds while authenticated, force logout
  // This prevents users from getting stuck on infinite loading screen
  useEffect(() => {
    // Only apply timeout if user is authenticated
    if (authStatus !== AUTH_STATUS.AUTHENTICATED) {
      return;
    }

    if (publicKey) {
      // Public key loaded successfully, clear any timeout
      return;
    }

    const timeout = setTimeout(() => {
      if (!publicKey && authStatus === AUTH_STATUS.AUTHENTICATED) {
        logger.error(
          "TabNavigator",
          "Public key loading timeout while authenticated - forcing logout to prevent infinite loading",
          new Error("Public key loading timeout"),
          {
            account,
            activeNetwork,
            authStatus,
          },
        );
        setPublicKeyTimedOut(true);
        // Force logout to allow user to recover
        logout(false); // Don't wipe data, just expire session
      }
    }, PUBLIC_KEY_LOADING_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [publicKey, account, activeNetwork, authStatus, logout]);

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

  // Start polling for balance and price updates
  usePricedBalancesPolling({
    publicKey: publicKey ?? "",
    network: networkDetails.network,
  });

  // Start polling for history updates
  useHistoryPolling({
    publicKey: publicKey ?? "",
    network: networkDetails.network,
  });

  // Fetch discover protocols on mount
  useEffect(() => {
    fetchProtocols();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show loading only if:
  // 1. User is AUTHENTICATED (if not, logout effect will redirect them)
  // 2. PublicKey hasn't loaded yet
  // 3. Haven't timed out yet
  if (
    authStatus === AUTH_STATUS.AUTHENTICATED &&
    !publicKey &&
    !publicKeyTimedOut
  ) {
    return <LoadingScreen />;
  }

  // If we reach here without publicKey, render nothing
  // This allows RootNavigator to handle navigation based on auth status
  if (!publicKey) {
    return null;
  }

  return (
    <MainTab.Navigator
      initialRouteName={MAIN_TAB_ROUTES.TAB_HOME}
      screenOptions={({ route }) => ({
        // eslint-disable-next-line react/no-unstable-nested-components
        tabBarIcon: (props) => <TabIcon route={route} {...props} />,
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: THEME.colors.tab.active,
        tabBarInactiveTintColor: THEME.colors.tab.inactive,
        tabBarStyle: {
          backgroundColor: THEME.colors.background.default,
          borderColor: THEME.colors.border.default,
          borderTopWidth: pxValue(1),
          borderStyle: "solid",
          paddingHorizontal: pxValue(72),
        },
      })}
    >
      <MainTab.Screen
        name={MAIN_TAB_ROUTES.TAB_HISTORY}
        component={HistoryScreen}
      />
      <MainTab.Screen name={MAIN_TAB_ROUTES.TAB_HOME} component={HomeScreen} />
      {discoverEnabled && (
        <MainTab.Screen
          name={MAIN_TAB_ROUTES.TAB_DISCOVERY}
          component={DiscoveryScreen}
        />
      )}
    </MainTab.Navigator>
  );
};
