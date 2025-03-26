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

export const TabNavigator = () => {
  const { t } = useAppTranslation();

  // TODO: Get this from wallet context
  // const publicKey = "GD7HIY2E4EASBGTJ7R4XEL3RDPKMNGE7V6GMEQSWFXRHMYZOGSVRB7OO";
  // const networkDetails = PUBLIC_NETWORK_DETAILS;
  const publicKey = "GAG5Q24OEIY6CMPNDCYZQAKP2I3SS4SGR2RT3WXK4YQSPY46DPTCHOGM";
  const networkDetails = TESTNET_NETWORK_DETAILS;

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
