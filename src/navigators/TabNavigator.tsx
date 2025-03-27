import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DiscoveryScreen } from "components/screens/DiscoveryScreen";
import { HistoryScreen } from "components/screens/HistoryScreen";
import { HomeScreen } from "components/screens/HomeScreen";
import Icon from "components/sds/Icon";
import { TEST_PUBLIC_KEY, TEST_NETWORK_DETAILS } from "config/constants";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { px, pxValue } from "helpers/dimensions";
import { useFetchAssetIcons } from "hooks/useFetchAssetIcons";
import { useFetchPricedBalances } from "hooks/useFetchPricedBalances";
import React from "react";
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
  const publicKey = TEST_PUBLIC_KEY;
  const networkDetails = TEST_NETWORK_DETAILS;

  // Fetch balances when component mounts or when publicKey/network changes
  useFetchPricedBalances({ publicKey, network: networkDetails.network });

  // Fetch icons whenever balances are updated
  useFetchAssetIcons(networkDetails.networkUrl);

  return (
    <TabIconWrapper focused={focused}>
      <IconComponent size={TAB_ICON_SIZE} color={color} />
    </TabIconWrapper>
  );
};

export const TabNavigator = () => (
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
