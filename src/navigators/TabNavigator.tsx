import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import styled from 'styled-components/native';
import {ROUTES, TabStackParamList} from '../config/routes';
import {THEME} from '../config/sds/theme';
import {px} from '../helpers/dimensions';
import {HomeScreen} from '../components/screens/HomeScreen';
import {SwapScreen} from '../components/screens/SwapScreen';
import {HistoryScreen} from '../components/screens/HistoryScreen';
import {SettingsScreen} from '../components/screens/SettingsScreen';

const Tab = createBottomTabNavigator<TabStackParamList>();

const TabIcon = styled.View<{focused: boolean}>`
  width: ${px(10)};
  height: ${px(10)};
  border-radius: ${px(5)};
  background-color: ${({focused}) =>
    focused ? THEME.colors.tab.active : THEME.colors.tab.inactive};
`;

export const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused}) => <TabIcon focused={focused} />,
        tabBarActiveTintColor: THEME.colors.tab.active,
        tabBarInactiveTintColor: THEME.colors.tab.inactive,
      })}>
      <Tab.Screen name={ROUTES.TAB_HOME} component={HomeScreen} />
      <Tab.Screen name={ROUTES.TAB_SWAP} component={SwapScreen} />
      <Tab.Screen name={ROUTES.TAB_HISTORY} component={HistoryScreen} />
      <Tab.Screen name={ROUTES.TAB_SETTINGS} component={SettingsScreen} />
    </Tab.Navigator>
  );
}; 