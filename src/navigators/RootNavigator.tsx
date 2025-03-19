/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { AuthNavigator } from "navigators/AuthNavigator";
import { TabNavigator } from "navigators/TabNavigator";
import React, { useEffect, useState } from "react";
import RNBootSplash from "react-native-bootsplash";

const RootStack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const getIsAuthenticated = useAuthenticationStore(
    (state) => state.getIsAuthenticated,
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const validateAuth = async () => {
      const isAuthenticatedResponse = await getIsAuthenticated();
      setIsAuthenticated(isAuthenticatedResponse);
    };

    validateAuth();
    // We can bypass the eslint rule here because we need to hide the splash screen
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    RNBootSplash.hide({ fade: true });
  }, [getIsAuthenticated]);

  return (
    <RootStack.Navigator
      initialRouteName={
        isAuthenticated
          ? ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK
          : ROOT_NAVIGATOR_ROUTES.AUTH_STACK
      }
      screenOptions={{
        headerShown: false,
      }}
    >
      {isAuthenticated ? (
        <RootStack.Screen
          name={ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK}
          component={TabNavigator}
          options={{
            headerShown: false,
          }}
        />
      ) : (
        <RootStack.Screen
          name={ROOT_NAVIGATOR_ROUTES.AUTH_STACK}
          component={AuthNavigator}
        />
      )}
    </RootStack.Navigator>
  );
};
