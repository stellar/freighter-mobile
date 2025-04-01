import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { AuthCheckProvider } from "components/AuthCheckProvider";
import { OfflineDetection } from "components/OfflineDetection";
import { RootStackParamList } from "config/routes";
import { THEME } from "config/theme";
import i18n from "i18n";
import { RootNavigator } from "navigators/RootNavigator";
import React from "react";
import { I18nextProvider } from "react-i18next";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Create a navigation ref that can be used outside of the Navigation Provider
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const App = (): React.JSX.Element => (
  <SafeAreaProvider>
    <I18nextProvider i18n={i18n}>
      <NavigationContainer ref={navigationRef}>
        <AuthCheckProvider>
          <OfflineDetection>
            <StatusBar
              backgroundColor={THEME.colors.background.default}
              barStyle="light-content"
            />
            <RootNavigator />
          </OfflineDetection>
        </AuthCheckProvider>
      </NavigationContainer>
    </I18nextProvider>
  </SafeAreaProvider>
);
