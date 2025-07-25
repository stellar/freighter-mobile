/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import { ChoosePasswordScreen } from "components/screens/ChoosePasswordScreen";
import { ConfirmPasswordScreen } from "components/screens/ConfirmPasswordScreen";
import { ImportWalletScreen } from "components/screens/ImportWalletScreen";
import { RecoveryPhraseAlertScreen } from "components/screens/RecoveryPhraseAlertScreen";
import { RecoveryPhraseScreen } from "components/screens/RecoveryPhraseScreen";
import { ValidateRecoveryPhraseScreen } from "components/screens/ValidateRecoveryPhraseScreen";
import { WelcomeScreen } from "components/screens/WelcomeScreen";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import React from "react";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator = () => (
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
      name={AUTH_STACK_ROUTES.VALIDATE_RECOVERY_PHRASE_SCREEN}
      component={ValidateRecoveryPhraseScreen}
    />
    <AuthStack.Screen
      name={AUTH_STACK_ROUTES.IMPORT_WALLET_SCREEN}
      component={ImportWalletScreen}
    />
  </AuthStack.Navigator>
);
