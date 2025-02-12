import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import styled from 'styled-components/native';
import {ROUTES, TabStackParamList} from '../config/routes';

const Tab = createBottomTabNavigator<TabStackParamList>();

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const TabIcon = styled.View<{focused: boolean}>`
  width: 10px;
  height: 10px;
  border-radius: 5px;
  background-color: ${({ focused }) => (focused ? '#2196F3' : 'gray')};
`;

const ScreenText = styled.Text`
  font-size: 16px;
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
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: 'gray',
      })}>
      <Tab.Screen name={ROUTES.TAB_HOME} component={HomeScreen} />
      <Tab.Screen name={ROUTES.TAB_WALLET} component={WalletScreen} />
      <Tab.Screen name={ROUTES.TAB_SEND} component={SendScreen} />
      <Tab.Screen name={ROUTES.TAB_RECEIVE} component={ReceiveScreen} />
      <Tab.Screen name={ROUTES.TAB_SETTINGS} component={SettingsScreen} />
    </Tab.Navigator>
  );
}; 