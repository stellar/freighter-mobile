import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HistoryScreen } from "components/screens/HistoryScreen";
import { HomeScreen } from "components/screens/HomeScreen";
import { SettingsScreen } from "components/screens/SettingsScreen";
import { SwapScreen } from "components/screens/SwapScreen";
import { ROUTES, TabStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { px } from "helpers/dimensions";
import React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components/native";

const Tab = createBottomTabNavigator<TabStackParamList>();

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
    <Tab.Navigator
      screenOptions={() => ({
        tabBarIcon: renderTabIcon,
        tabBarActiveTintColor: THEME.colors.tab.active,
        tabBarInactiveTintColor: THEME.colors.tab.inactive,
      })}
    >
      <Tab.Screen
        name={ROUTES.TAB_HOME}
        component={HomeScreen}
        options={{
          headerTitle: t("home.title"),
          tabBarLabel: t("home.title"),
        }}
      />
      <Tab.Screen
        name={ROUTES.TAB_SWAP}
        component={SwapScreen}
        options={{
          headerTitle: t("swap.title"),
          tabBarLabel: t("swap.title"),
        }}
      />
      <Tab.Screen
        name={ROUTES.TAB_HISTORY}
        component={HistoryScreen}
        options={{
          headerTitle: t("history.title"),
          tabBarLabel: t("history.title"),
        }}
      />
      <Tab.Screen
        name={ROUTES.TAB_SETTINGS}
        component={SettingsScreen}
        options={{
          headerTitle: t("settings.title"),
          tabBarLabel: t("settings.title"),
        }}
      />
    </Tab.Navigator>
  );
};
