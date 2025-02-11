import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Text, View} from 'react-native';

const Tab = createBottomTabNavigator();

// Placeholder screens
const HomeScreen = () => (
  <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
    <Text>Home</Text>
  </View>
);

const WalletScreen = () => (
  <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
    <Text>Wallet</Text>
  </View>
);

const SendScreen = () => (
  <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
    <Text>Send</Text>
  </View>
);

const ReceiveScreen = () => (
  <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
    <Text>Receive</Text>
  </View>
);

const SettingsScreen = () => (
  <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
    <Text>Settings</Text>
  </View>
);

export const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color}) => (
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: focused ? '#2196F3' : 'gray',
            }}
          />
        ),
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: 'gray',
      })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="Send" component={SendScreen} />
      <Tab.Screen name="Receive" component={ReceiveScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}; 