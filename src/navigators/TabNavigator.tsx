import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DiscoveryScreen } from "components/screens/DiscoveryScreen";
import { HistoryScreen } from "components/screens/HistoryScreen";
import { HomeScreen } from "components/screens/HomeScreen";
import { TESTNET_NETWORK_DETAILS } from "config/constants";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useFetchAssetIcons } from "hooks/useFetchAssetIcons";
import { useFetchPricedBalances } from "hooks/useFetchPricedBalances";
import React from "react";
import styled from "styled-components/native";

const MainTab = createBottomTabNavigator<MainTabStackParamList>();

const TabIcon = styled.View<{ focused: boolean }>`
  width: ${px(10)};
  height: ${px(10)};
  border-radius: ${px(5)};
  background-color: ${({ focused }: { focused: boolean }) =>
    focused ? THEME.colors.tab.active : THEME.colors.tab.inactive};
`;

// Move the tab icon component outside of the render to follow React best practices
const renderTabIcon = ({ focused }: { focused: boolean }) => (
  <TabIcon focused={focused} />
);

export const TEST_PUBLIC_KEY =
  "GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG";
export const TEST_NETWORK_DETAILS = TESTNET_NETWORK_DETAILS;
// export const TEST_PUBLIC_KEY = "GD7EMKA34FGOC32GMK53JRVRYU2A6F5SBXDSE3XIGUAO7ZE4IP3FIQRC";
// export const TEST_NETWORK_DETAILS = PUBLIC_NETWORK_DETAILS;

export const TabNavigator = () => {
  const { t } = useAppTranslation();

  const publicKey = TEST_PUBLIC_KEY;
  const networkDetails = TEST_NETWORK_DETAILS;

  // Fetch balances when component mounts or when publicKey/network changes
  useFetchPricedBalances({ publicKey, network: networkDetails.network });

  // Fetch icons whenever balances are updated
  useFetchAssetIcons(networkDetails.networkUrl);

  return (
    <MainTab.Navigator
      screenOptions={() => ({
        tabBarIcon: renderTabIcon,
        tabBarActiveTintColor: THEME.colors.tab.active,
        tabBarInactiveTintColor: THEME.colors.tab.inactive,
        headerShown: false,
      })}
    >
      <MainTab.Screen
        name={MAIN_TAB_ROUTES.TAB_HISTORY}
        component={HistoryScreen}
        options={{
          headerTitle: t("history.title"),
          tabBarLabel: t("history.title"),
        }}
      />
      <MainTab.Screen
        name={MAIN_TAB_ROUTES.TAB_HOME}
        component={HomeScreen}
        options={{
          headerTitle: t("home.title"),
          tabBarLabel: t("home.title"),
        }}
      />
      <MainTab.Screen
        name={MAIN_TAB_ROUTES.TAB_DISCOVERY}
        component={DiscoveryScreen}
        options={{
          headerTitle: t("discovery.title"),
          tabBarLabel: t("discovery.title"),
        }}
      />
    </MainTab.Navigator>
  );
};
