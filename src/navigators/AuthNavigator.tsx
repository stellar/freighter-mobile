/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import { BiometricsOnboardingScreen } from "components/screens/BiometricsEnableScreen";
import { ChoosePasswordScreen } from "components/screens/ChoosePasswordScreen";
import { ImportWalletScreen } from "components/screens/ImportWalletScreen";
import { RecoveryPhraseScreen } from "components/screens/RecoveryPhraseScreen";
import { WelcomeScreen } from "components/screens/WelcomeScreen";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { getSetPasswordScreenOptions } from "helpers/navigationOptions";
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
      options={getSetPasswordScreenOptions}
    />
    <AuthStack.Screen
      name={AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN}
      component={RecoveryPhraseScreen}
    />
    <AuthStack.Screen
      name={AUTH_STACK_ROUTES.IMPORT_WALLET_SCREEN}
      component={ImportWalletScreen}
    />
    <AuthStack.Screen
      name={AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN}
      component={BiometricsOnboardingScreen}
    />
  </AuthStack.Navigator>
);
