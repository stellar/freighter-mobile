import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { AuthErrorToastListener } from "components/AuthErrorToastListener";
import { LockScreenOverlay } from "components/LockScreenOverlay";
import { initializeSentryLogger } from "config/logger";
import { RootStackParamList } from "config/routes";
import { initializeSentry } from "config/sentryConfig";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { useAnalyticsStore } from "ducks/analytics";
import { useAuthenticationStore } from "ducks/auth";
import { useNavigationAnalytics } from "hooks/useNavigationAnalytics";
import useNavigationTheme from "hooks/useNavigationTheme";
import { useSentryContext } from "hooks/useSentryContext";
import useTheme from "hooks/useTheme";
import i18n from "i18n";
import { RootNavigator } from "navigators/RootNavigator";
import { AuthCheckProvider } from "providers/AuthCheckProvider";
import { NetworkProvider } from "providers/NetworkProvider";
import { ToastProvider } from "providers/ToastProvider";
import { WalletKitProvider } from "providers/WalletKitProvider";
import React, { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { StatusBar, View, useColorScheme } from "react-native";
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
  const navigationTheme = useNavigationTheme();
  const theme = useTheme();
  const colorScheme = useColorScheme() ?? DEFAULT_COLOR_SCHEME;

  useSentryContext();

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

    // Defer until the persisted data-sharing preference has hydrated from
    // AsyncStorage. Zustand's pre-hydration default is `true` (Android), so
    // running initSentry() before hydration could initialize Sentry for a
    // returning opted-out user in the brief window before the stored `false`
    // restores — breaking the cold-start opt-out. Mirrors the analytics
    // module's onFinishHydration handling in services/analytics/core.ts.
    if (useAnalyticsStore.persist.hasHydrated()) {
      initSentry();
      return undefined;
    }
    return useAnalyticsStore.persist.onFinishHydration(() => {
      initSentry();
    });
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
        style={{ flex: 1, backgroundColor: theme.colors.base.primary }}
      >
        <SafeAreaProvider>
          <ToastProvider>
            <BottomSheetModalProvider>
              <I18nextProvider i18n={i18n}>
                <AuthErrorToastListener />
                <NavigationContainer
                  ref={navigationRef}
                  theme={navigationTheme}
                  onStateChange={onStateChange}
                >
                  <AuthCheckProvider>
                    <NetworkProvider>
                      <StatusBar
                        // Android only:
                        // Declares that the page draws under the bar. Without
                        // it, React Native's first sync of this element runs
                        // statusBarShow(), whose setDecorFitsSystemWindows(true)
                        // undoes keyboard-controller's edge-to-edge: AppCompat
                        // insets the content by the bar height and the window
                        // paints the strip in the color it had at creation --
                        // which a theme switch never repaints, because uiMode
                        // is a handled configChange and the Activity survives.
                        // Translucent makes RN zero the top inset itself, so
                        // the re-fit is a no-op and the page paints the strip.
                        translucent
                        backgroundColor={theme.colors.base.primary}
                        // Light content is white text, which is invisible on a
                        // light status bar, so it has to follow the scheme.
                        barStyle={
                          colorScheme === "dark"
                            ? "light-content"
                            : "dark-content"
                        }
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
