/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/CustomNavigationHeader";
import { ChoosePasswordScreen } from "components/screens/ChoosePasswordScreen";
import { ConfirmPasswordScreen } from "components/screens/ConfirmPasswordScreen";
import { ImportWalletScreen } from "components/screens/ImportWalletScreen";
import { RecoveryPhraseAlertScreen } from "components/screens/RecoveryPhraseAlertScreen";
import { RecoveryPhraseScreen } from "components/screens/RecoveryPhraseScreen";
import { WelcomeScreen } from "components/screens/WelcomeScreen";
import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import React, { useEffect } from "react";
import { dataStorage } from "services/storage/storageFactory";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator = () => {
  useEffect(() => {
    const checkForExistingAccount = async () => {
      try {
        const activeAccountId = await dataStorage.getItem(
          STORAGE_KEYS.ACTIVE_ACCOUNT_ID,
        );

        if (activeAccountId) {
          // TODO: Add login screen logic
        }
      } catch (error) {
        logger.error("Error checking for existing account", error);
      }
    };

    checkForExistingAccount();
  }, []);

  return (
    <AuthStack.Navigator
      initialRouteName={AUTH_STACK_ROUTES.WELCOME_SCREEN}
      screenOptions={{
        header: (props) => <CustomNavigationHeader {...props} />,
      }}
    >
      <AuthStack.Screen
        name={AUTH_STACK_ROUTES.WELCOME_SCREEN}
        component={WelcomeScreen}
        options={{
          headerShown: false,
        }}
      />
      <AuthStack.Screen
        name={AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN}
        component={ChoosePasswordScreen}
      />
      <AuthStack.Screen
        name={AUTH_STACK_ROUTES.CONFIRM_PASSWORD_SCREEN}
        component={ConfirmPasswordScreen}
      />
      <AuthStack.Screen
        name={AUTH_STACK_ROUTES.RECOVERY_PHRASE_ALERT_SCREEN}
        component={RecoveryPhraseAlertScreen}
      />
      <AuthStack.Screen
        name={AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN}
        component={RecoveryPhraseScreen}
      />
      <AuthStack.Screen
        name={AUTH_STACK_ROUTES.IMPORT_WALLET_SCREEN}
        component={ImportWalletScreen}
      />
    </AuthStack.Navigator>
  );
};
