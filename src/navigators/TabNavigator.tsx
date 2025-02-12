import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import styled from 'styled-components/native';
import {ROUTES, TabStackParamList} from '../config/routes';
import {COLORS} from '../config/theme';
import {px, fs} from '../helpers/dimensions';

const Tab = createBottomTabNavigator<TabStackParamList>();

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const TabIcon = styled.View<{focused: boolean}>`
  width: ${px(10)};
  height: ${px(10)};
  border-radius: ${px(5)};
  background-color: ${({focused}) =>
    focused ? COLORS.tab.active : COLORS.tab.inactive};
`;

const ScreenText = styled.Text`
  font-size: ${fs(16)};
`;

// Placeholder screens
const HomeScreen = () => (
  <Container>
    <ScreenText>Home</ScreenText>
  </Container>
);

const WalletScreen = () => (
  <Container>
    <ScreenText>Wallet</ScreenText>
  </Container>
);

const SendScreen = () => (
  <Container>
    <ScreenText>Send</ScreenText>
  </Container>
);

const ReceiveScreen = () => (
  <Container>
    <ScreenText>Receive</ScreenText>
  </Container>
);

const SettingsScreen = () => (
  <Container>
    <ScreenText>Settings</ScreenText>
  </Container>
);

export const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused}) => <TabIcon focused={focused} />,
        tabBarActiveTintColor: COLORS.tab.active,
        tabBarInactiveTintColor: COLORS.tab.inactive,
      })}>
      <Tab.Screen name={ROUTES.TAB_HOME} component={HomeScreen} />
      <Tab.Screen name={ROUTES.TAB_WALLET} component={WalletScreen} />
      <Tab.Screen name={ROUTES.TAB_SEND} component={SendScreen} />
      <Tab.Screen name={ROUTES.TAB_RECEIVE} component={ReceiveScreen} />
      <Tab.Screen name={ROUTES.TAB_SETTINGS} component={SettingsScreen} />
    </Tab.Navigator>
  );
}; 