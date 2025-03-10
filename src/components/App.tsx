import { NavigationContainer } from "@react-navigation/native";
import { OfflineDetection } from "components/OfflineDetection";
import i18n from "i18n";
import { RootNavigator } from "navigators/RootNavigator";
import React from "react";
import { I18nextProvider } from "react-i18next";

export const App = (): React.JSX.Element => (
  <I18nextProvider i18n={i18n}>
    <NavigationContainer>
      <OfflineDetection>
        <RootNavigator />
      </OfflineDetection>
    </NavigationContainer>
  </I18nextProvider>
);
