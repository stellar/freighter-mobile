/* eslint-disable no-nested-ternary */
/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoadingScreen } from "components/screens/LoadingScreen";
import { LockScreen } from "components/screens/LockScreen";
import {
  ManageAssetsStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
  SettingsStackParamList,
} from "config/routes";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { AuthNavigator } from "navigators/AuthNavigator";
import { ManageAssetsStackNavigator } from "navigators/ManageAssetsNavigator";
import { SettingsStackNavigator } from "navigators/SettingsNavigator";
import { TabNavigator } from "navigators/TabNavigator";
import React, { useEffect, useMemo, useState } from "react";
import RNBootSplash from "react-native-bootsplash";

const RootStack = createNativeStackNavigator<
  RootStackParamList & ManageAssetsStackParamList & SettingsStackParamList
>();

export const RootNavigator = () => {
  const { authStatus, getAuthStatus } = useAuthenticationStore();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      // Check auth status when app starts
      await getAuthStatus();
      setInitializing(false);
      RNBootSplash.hide({ fade: true });
    };

    initializeApp();
  }, [getAuthStatus]);

  // Make the stack re-render when auth status changes
  const initialRouteName = useMemo(() => {
    if (authStatus === AUTH_STATUS.AUTHENTICATED) {
      return ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK;
    }

    if (authStatus === AUTH_STATUS.HASH_KEY_EXPIRED) {
      return ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN;
    }

    return ROOT_NAVIGATOR_ROUTES.AUTH_STACK;
  }, [authStatus]);

  if (initializing) {
    return <LoadingScreen />;
  }

  return (
    <RootStack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
      }}
    >
      {authStatus === AUTH_STATUS.AUTHENTICATED ? (
        <RootStack.Group>
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK}
            component={TabNavigator}
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.MANAGE_ASSETS_STACK}
            component={ManageAssetsStackNavigator}
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.SETTINGS_STACK}
            component={SettingsStackNavigator}
          />
        </RootStack.Group>
      ) : authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ? (
        <RootStack.Screen
          name={ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN}
          component={LockScreen}
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
