import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { initializeSentryLogger } from "config/logger";
import { RootStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { useNavigationAnalytics } from "hooks/useNavigationAnalytics";
import i18n from "i18n";
import { RootNavigator } from "navigators/RootNavigator";
import { AuthCheckProvider } from "providers/AuthCheckProvider";
import { NetworkProvider } from "providers/NetworkProvider";
import { ToastProvider } from "providers/ToastProvider";
import { WalletKitProvider } from "providers/WalletKitProvider";
import React, { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { Appearance, StatusBar } from "react-native";
import Config from "react-native-config";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { getUserId } from "services/analytics/user";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const App = (): React.JSX.Element => {
  const { onStateChange } = useNavigationAnalytics();

  useEffect(() => {
    Appearance.setColorScheme("dark");
  }, []);

  // initialize sentry here but we enhance the configuration
  // in RootNavigator once the user is authenticated
  useEffect(() => {
    const initializeSentry = async () => {
      Sentry.init({
        dsn: Config.SENTRY_DSN,
        sendDefaultPii: false,
        spotlight: __DEV__,
      });

      const userId = await getUserId();

      Sentry.setUser({ id: userId });

      initializeSentryLogger();
    };

    initializeSentry();
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

export default Sentry.wrap(App);
