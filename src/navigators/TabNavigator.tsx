import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DiscoveryScreen } from "components/screens/DiscoveryScreen";
import { HistoryScreen } from "components/screens/HistoryScreen";
import { HomeScreen } from "components/screens/HomeScreen";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { px } from "helpers/dimensions";
import React from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

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
