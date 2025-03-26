/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoadingScreen } from "components/screens/LoadingScreen";
import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
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
      } catch (error) {
        logger.error(
          "RootNavigator.validateAuth",
          "Error initializing the app",
          error,
        );
      } finally {
        await RNBootSplash.hide({ fade: true });
        setInitializing(false);
      }
    };

    validateAuth();
  }, [getIsAuthenticated]);

  // Show loading screen while initializing
  if (initializing) {
    return <LoadingScreen />;
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
