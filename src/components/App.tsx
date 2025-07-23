import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { RootStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { useNavigationAnalytics } from "hooks/useNavigationAnalytics";
import i18n from "i18n";
import { RootNavigator } from "navigators/RootNavigator";
import { AuthCheckProvider } from "providers/AuthCheckProvider";
import { NetworkProvider } from "providers/NetworkProvider";
import { ToastProvider } from "providers/ToastProvider";
import { WalletKitProvider } from "providers/WalletKitProvider";
import React, { useEffect, useRef } from "react";
import { I18nextProvider } from "react-i18next";
import { Appearance, AppState, StatusBar, AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { analytics } from "services/analytics";
import { initAnalytics } from "services/analytics/core";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const App = (): React.JSX.Element => {
  const { onStateChange } = useNavigationAnalytics();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isFirstLaunchRef = useRef(true);

  useEffect(() => {
    Appearance.setColorScheme("dark");
    initAnalytics();

    // Track fresh app launch (cold boot)
    // when the app is launched the first time the previous state is always "none"
    analytics.trackAppOpened({
      previousState: "none",
    });
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;

      if (nextAppState === "active" && !isFirstLaunchRef.current) {
        // Track app foregrounded from background
        analytics.trackAppOpened({
          previousState,
        });
      }

      appStateRef.current = nextAppState;
      isFirstLaunchRef.current = false;
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => subscription?.remove();
  }, []);

  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <ToastProvider>
          <BottomSheetModalProvider>
            <I18nextProvider i18n={i18n}>
              <NavigationContainer
                ref={navigationRef}
                onStateChange={onStateChange}
              >
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
