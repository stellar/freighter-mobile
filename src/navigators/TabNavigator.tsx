import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DiscoveryScreen } from "components/screens/DiscoveryScreen/DiscoveryScreen";
import { HistoryScreen } from "components/screens/HistoryScreen";
import HomeScreen from "components/screens/HomeScreen";
import { LoadingScreen } from "components/screens/LoadingScreen";
import Icon from "components/sds/Icon";
import { mapNetworkToNetworkDetails } from "config/constants";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { useProtocolsStore } from "ducks/protocols";
import { px, pxValue } from "helpers/dimensions";
import { useFetchCollectibles } from "hooks/useFetchCollectibles";
import { useFetchPricedBalances } from "hooks/useFetchPricedBalances";
import { useFetchTokenIcons } from "hooks/useFetchTokenIcons";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { usePricedBalancesPolling } from "hooks/usePricedBalancesPolling";
import React, { useEffect, useMemo } from "react";
import styled from "styled-components/native";

const MainTab = createBottomTabNavigator<MainTabStackParamList>();

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
  const { network: activeNetwork } = useAuthenticationStore();
  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(activeNetwork),
    [activeNetwork],
  );
  const { fetchProtocols } = useProtocolsStore();

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

  // Fetch discover protocols on mount
  useEffect(() => {
    fetchProtocols();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!publicKey) {
    return <LoadingScreen />;
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
      <MainTab.Screen
        name={MAIN_TAB_ROUTES.TAB_DISCOVERY}
        component={DiscoveryScreen}
      />
    </MainTab.Navigator>
  );
};
