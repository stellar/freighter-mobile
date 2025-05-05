import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { RootStackParamList } from "config/routes";
import { THEME } from "config/theme";
import i18n from "i18n";
import { RootNavigator } from "navigators/RootNavigator";
import { AuthCheckProvider } from "providers/AuthCheckProvider";
import { NetworkProvider } from "providers/NetworkProvider";
import { ToastProvider } from "providers/ToastProvider";
import { WalletKitProvider } from "providers/WalletKitProvider";
import React, { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { Appearance, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Create a navigation ref that can be used outside of the Navigation Provider
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const App = (): React.JSX.Element => {
  useEffect(() => {
    Appearance.setColorScheme("dark");
  }, []);

  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <ToastProvider>
          <BottomSheetModalProvider>
            <I18nextProvider i18n={i18n}>
              <NavigationContainer ref={navigationRef}>
                <AuthCheckProvider>
                  <NetworkProvider>
                    <StatusBar
                      backgroundColor={THEME.colors.background.default}
                      barStyle="light-content"
                    />
                    <WalletKitProvider>
                      <RootNavigator />
                    </WalletKitProvider>
                  </NetworkProvider>
                </AuthCheckProvider>
              </NavigationContainer>
            </I18nextProvider>
          </BottomSheetModalProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};
