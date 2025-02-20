import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import styled from "styled-components/native";

import { HistoryScreen } from "../components/screens/HistoryScreen";
import { HomeScreen } from "../components/screens/HomeScreen";
import { SettingsScreen } from "../components/screens/SettingsScreen";
import { SwapScreen } from "../components/screens/SwapScreen";
import { ROUTES, TabStackParamList } from "../config/routes";
import { THEME } from "../config/sds/theme";
import { px } from "../helpers/dimensions";

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

export const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={() => ({
      tabBarIcon: renderTabIcon,
      tabBarActiveTintColor: THEME.colors.tab.active,
      tabBarInactiveTintColor: THEME.colors.tab.inactive,
    })}
  >
    <Tab.Screen name={ROUTES.TAB_HOME} component={HomeScreen} />
    <Tab.Screen name={ROUTES.TAB_SWAP} component={SwapScreen} />
    <Tab.Screen name={ROUTES.TAB_HISTORY} component={HistoryScreen} />
    <Tab.Screen name={ROUTES.TAB_SETTINGS} component={SettingsScreen} />
  </Tab.Navigator>
);
