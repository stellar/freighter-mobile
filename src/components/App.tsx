import { NavigationContainer } from "@react-navigation/native";
import { OfflineDetection } from "components/OfflineDetection";
import { THEME } from "config/theme";
import i18n from "i18n";
import { RootNavigator } from "navigators/RootNavigator";
import React from "react";
import { I18nextProvider } from "react-i18next";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const App = (): React.JSX.Element => (
  <SafeAreaProvider>
    <I18nextProvider i18n={i18n}>
      <NavigationContainer>
        <OfflineDetection>
          <StatusBar
            backgroundColor={THEME.colors.background.default}
            barStyle="light-content"
          />
          <RootNavigator />
        </OfflineDetection>
      </NavigationContainer>
    </I18nextProvider>
  </SafeAreaProvider>
);
