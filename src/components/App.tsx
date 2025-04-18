import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { AuthCheckProvider } from "components/AuthCheckProvider";
import { OfflineDetection } from "components/OfflineDetection";
import { logger } from "config/logger";
import { RootStackParamList } from "config/routes";
import { THEME } from "config/theme";
import useInitializeWalletKit from "hooks/useInitializeWalletKit";
import useWalletKitEventsManager from "hooks/useWalletKitEventsManager";
import i18n from "i18n";
import { RootNavigator } from "navigators/RootNavigator";
import { ToastProvider } from "providers/ToastProvider";
import React, { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { Appearance, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Create a navigation ref that can be used outside of the Navigation Provider
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const App = (): React.JSX.Element => {
  // Step 1 - Initialize wallets and wallet connect client
  const initialized = useInitializeWalletKit();

  // Step 2 - Once initialized, set up wallet connect event manager
  useWalletKitEventsManager(initialized);
  
  useEffect(() => {
    Appearance.setColorScheme("dark");
  }, []);

  useEffect(() => {
    if (initialized) {
      logger.debug("WalletKit", "initialized");
    }
  }, [initialized]);

  return (
    <GestureHandlerRootView>
      <BottomSheetModalProvider>
        <SafeAreaProvider>
          <I18nextProvider i18n={i18n}>
            <NavigationContainer ref={navigationRef}>
              <AuthCheckProvider>
                <OfflineDetection>
                  <StatusBar
                    backgroundColor={THEME.colors.background.default}
                    barStyle="light-content"
                  />
                  <ToastProvider>
                    <RootNavigator />
                  </ToastProvider>
                </OfflineDetection>
              </AuthCheckProvider>
            </NavigationContainer>
          </I18nextProvider>
        </SafeAreaProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
};
