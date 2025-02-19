import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { LoginScreen } from '../components/screens/LoginScreen';
import { ROUTES, RootStackParamList } from '../config/routes';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => (
  <Stack.Navigator
    initialRouteName={ROUTES.LOGIN}
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right', // Default animation for forward navigation
    }}
  >
    <Stack.Screen
      name={ROUTES.LOGIN}
      component={LoginScreen}
      options={{
        animation: 'slide_from_left', // Custom animation when returning to login
      }}
    />
    <Stack.Screen name={ROUTES.MAIN_TABS} component={TabNavigator} />
  </Stack.Navigator>
);
