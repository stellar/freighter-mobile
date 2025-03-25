/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { STORAGE_KEYS } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { isHashKeyValid } from "hooks/useGetActiveAccount";
import { AuthNavigator } from "navigators/AuthNavigator";
import { TabNavigator } from "navigators/TabNavigator";
import React, { useEffect, useState } from "react";
import RNBootSplash from "react-native-bootsplash";
import { dataStorage } from "services/storage/storageFactory";

const RootStack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const { getIsAuthenticated, isAuthenticated } = useAuthenticationStore();
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const validateAuth = async () => {
      try {
        // First check if hash key is valid - this might authenticate the user
        const hashKeyValid = await isHashKeyValid();
        if (!hashKeyValid) {
          setInitializing(false);
          return;
        }

        // Then get auth status
        getIsAuthenticated();

        // Check if we have a stored account
        const activeAccountId = await dataStorage.getItem(
          STORAGE_KEYS.ACTIVE_ACCOUNT_ID,
        );
        setHasAccount(!!activeAccountId);

        // Hide the splash screen after initialization
        await RNBootSplash.hide({ fade: true });
        setInitializing(false);
      } catch (error) {
        setInitializing(false);
      }
    };

    validateAuth();
  }, [getIsAuthenticated]);

  // Show nothing while initializing
  if (initializing) {
    return null;
  }

  // Determine initial route
  const getInitialRouteName = () => {
    if (isAuthenticated) {
      return ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK;
    }

    // If we have an account but not authenticated, show login screen
    if (hasAccount) {
      return ROOT_NAVIGATOR_ROUTES.AUTH_STACK;
    }

    // Otherwise show the auth stack (welcome, signup, etc.)
    return ROOT_NAVIGATOR_ROUTES.AUTH_STACK;
  };

  return (
    <RootStack.Navigator
      initialRouteName={getInitialRouteName()}
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
