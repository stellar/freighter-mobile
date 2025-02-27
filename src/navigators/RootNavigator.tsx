import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "components/screens/LoginScreen";
import { ROUTES, RootStackParamList } from "config/routes";
import { TabNavigator } from "navigators/TabNavigator";
import React, { useEffect } from "react";
import RNBootSplash from "react-native-bootsplash";

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  useEffect(() => {
    // We can bypass the eslint rule here because we need to hide the splash screen
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    RNBootSplash.hide({ fade: true });
  }, []);

  return (
    <Stack.Navigator
      initialRouteName={ROUTES.LOGIN}
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right", // Default animation for forward navigation
      }}
    >
      <Stack.Screen
        name={ROUTES.LOGIN}
        component={LoginScreen}
        options={{
          animation: "slide_from_left", // Custom animation when returning to login
        }}
      />
      <Stack.Screen name={ROUTES.MAIN_TABS} component={TabNavigator} />
    </Stack.Navigator>
  );
};
