import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { AuthErrorToastListener } from "components/AuthErrorToastListener";
import { LockScreenOverlay } from "components/LockScreenOverlay";
import { initializeSentryLogger } from "config/logger";
import { NAVIGATION_THEME } from "config/navigationTheme";
import { RootStackParamList } from "config/routes";
import { initializeSentry } from "config/sentryConfig";
import { THEME } from "config/theme";
import { useAnalyticsStore } from "ducks/analytics";
import { useAuthenticationStore } from "ducks/auth";
import { useNavigationAnalytics } from "hooks/useNavigationAnalytics";
import { useSentryContext } from "hooks/useSentryContext";
import i18n from "i18n";
import { RootNavigator } from "navigators/RootNavigator";
import { AuthCheckProvider } from "providers/AuthCheckProvider";
import { NetworkProvider } from "providers/NetworkProvider";
import { ToastProvider } from "providers/ToastProvider";
import { WalletKitProvider } from "providers/WalletKitProvider";
import React, { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { Appearance, StatusBar, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { getUserId } from "services/analytics/user";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Hides the still-mounted app tree from screen readers while the soft-lock
 * overlay is up, so VoiceOver / TalkBack can't traverse the wallet underneath.
 * `accessibilityElementsHidden` covers iOS (complementing the overlay's
 * `accessibilityViewIsModal`); `importantForAccessibility` covers Android,
 * which has no modal-accessibility equivalent. Isolated as its own subscriber
 * so only this wrapper re-renders on lock/unlock, not the whole provider tree.
 */
const SoftLockAccessibilityShield: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const isSoftLocked = useAuthenticationStore((state) => state.isSoftLocked);
  return (
    <View
      style={{ flex: 1 }}
      accessibilityElementsHidden={isSoftLocked}
      importantForAccessibility={isSoftLocked ? "no-hide-descendants" : "auto"}
    >
      {children}
    </View>
  );
};

export const App = (): React.JSX.Element => {
  const { onStateChange } = useNavigationAnalytics();

  useSentryContext();

  useEffect(() => {
    Appearance.setColorScheme("dark");
  }, []);

  // initialize sentry here but we enhance the configuration
  // in RootNavigator once the user is authenticated
  useEffect(() => {
    const initSentry = async () => {
      initializeSentry();

      // Switch the logger to its Sentry-aware adapter before any
      // subsequent async work. Otherwise warn / error calls fired
      // during getUserId / setUser run on the default consoleAdapter
      // and produce no breadcrumb or captured event in production.
      initializeSentryLogger();

      const userId = await getUserId();

      // Consent-gate the Sentry user identity: the resolved id is the
      // seed-derived auth pubkey (== backend JWT `sub`), a stable
      // cross-service identifier that must not be attached to crash
      // telemetry when the user has opted out of data sharing.
      // updateSentryContext (via useSentryContext) owns clearing it on a
      // later toggle-off; this guard covers the cold-start identification.
      if (useAnalyticsStore.getState().isEnabled) {
        Sentry.setUser({ id: userId });
      }
    };

    initSentry();
  }, []);

  return (
    /*
      The translucent flags tell keyboard-controller the app already runs
      edge-to-edge (Android 15+ enforces it), so its native layer must NOT
      inset the content view by the system-bar sizes. Without them it margins
      the content and consumes the window insets, making useSafeAreaInsets()
      report 0 for every edge on Android.
    */
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
      {/* Paints the area behind transparent system bars under Android 15+
          enforced edge-to-edge so the status/nav strips match app chrome. */}
      <GestureHandlerRootView
        style={{ flex: 1, backgroundColor: THEME.colors.background.default }}
      >
        <SafeAreaProvider>
          <ToastProvider>
            <BottomSheetModalProvider>
              <I18nextProvider i18n={i18n}>
                <AuthErrorToastListener />
                <NavigationContainer
                  ref={navigationRef}
                  theme={NAVIGATION_THEME}
                  onStateChange={onStateChange}
                >
                  <AuthCheckProvider>
                    <NetworkProvider>
                      <StatusBar
                        backgroundColor={THEME.colors.background.default}
                        barStyle="light-content"
                      />
                      <WalletKitProvider>
                        <SoftLockAccessibilityShield>
                          <RootNavigator />
                        </SoftLockAccessibilityShield>
                      </WalletKitProvider>
                    </NetworkProvider>
                  </AuthCheckProvider>
                </NavigationContainer>
              </I18nextProvider>
            </BottomSheetModalProvider>
            {/* Soft-lock overlay: rendered after the bottom sheet provider so
                it covers open sheets, keeping the navigation tree mounted
                underneath for after the unlock. */}
            <I18nextProvider i18n={i18n}>
              <LockScreenOverlay />
            </I18nextProvider>
          </ToastProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </KeyboardProvider>
  );
};

export default Sentry.wrap(App);
