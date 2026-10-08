/* eslint-disable no-nested-ternary */
/* eslint-disable react/no-unstable-nested-components */
import { useNavigation } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import { SplashOverlay } from "components/SplashAnimation/SplashOverlay";
import AddCollectibleScreen from "components/screens/AddCollectibleScreen";
import { BiometricsOnboardingScreen } from "components/screens/BiometricsEnableScreen/BiometricsEnableScreen";
import CollectibleDetailsScreen from "components/screens/CollectibleDetailsScreen";
import { ForceUpdateScreen } from "components/screens/ForceUpdateScreen/ForceUpdateScreen";
import HiddenCollectiblesScreen from "components/screens/HiddenCollectiblesScreen";
import { LockScreen } from "components/screens/LockScreen";
import { MaintenanceScreen } from "components/screens/MaintenanceScreen/MaintenanceScreen";
import { RebrandAnnouncementScreen } from "components/screens/RebrandAnnouncementScreen";
import ScanQRCodeScreen from "components/screens/ScanQRCodeScreen";
import ScanReceiveScreen from "components/screens/ScanReceiveScreen";
import { SecurityBlockScreen } from "components/screens/SecurityBlockScreen";
import TokenDetailsScreen from "components/screens/TokenDetailsScreen";
import {
  ManageWalletsStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
  SettingsStackParamList,
  SendPaymentStackParamList,
  AddFundsStackParamList,
  ManageTokensStackParamList,
  AUTH_STACK_ROUTES,
  AuthStackParamList,
} from "config/routes";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { isDeviceJailbroken } from "helpers/deviceSecurity";
import {
  getStackBottomNavigateOptions,
  getScreenOptionsNoHeader,
  getScreenBottomNavigateOptions,
  withTransitionOverride,
} from "helpers/navigationOptions";
import { triggerFaceIdOnboarding } from "helpers/postOnboardingBiometrics";
import {
  markRebrandAnnouncementEligibility,
  shouldShowRebrandAnnouncement,
} from "helpers/rebrandAnnouncement";
import { useAnalyticsPermissions } from "hooks/useAnalyticsPermissions";
import useAppTranslation from "hooks/useAppTranslation";
import { useAppUpdate } from "hooks/useAppUpdate";
import { useBiometrics } from "hooks/useBiometrics";
import { useMaintenanceMode } from "hooks/useMaintenanceMode";
import {
  AuthNavigator,
  AddFundsStackNavigator,
  ManageTokensStackNavigator,
  ManageWalletsStackNavigator,
  SendPaymentStackNavigator,
  SettingsStackNavigator,
  SwapStackNavigator,
} from "navigators";
import { TabNavigator } from "navigators/TabNavigator";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import RNBootSplash from "react-native-bootsplash";
import { isInitialized as isAnalyticsInitialized } from "services/analytics/core";

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  flex: { flex: 1 },
});

const RootStack = createNativeStackNavigator<
  RootStackParamList &
    ManageTokensStackParamList &
    SettingsStackParamList &
    ManageWalletsStackParamList &
    SendPaymentStackParamList &
    AuthStackParamList &
    AddFundsStackParamList
>();

export const RootNavigator = () => {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList & AuthStackParamList>
    >();
  const { authStatus, isSoftLocked, getAuthStatus, initializeNetwork } =
    useAuthenticationStore();
  const remoteConfigInitialized = useRemoteConfigStore(
    (state) => state.isInitialized,
  );
  const [initializing, setInitializing] = useState(true);
  const [isAuthStatusReady, setIsAuthStatusReady] = useState(false);
  const [showForceUpdate, setShowForceUpdate] = useState(false);
  const [isRebrandAnnouncementPending, setIsRebrandAnnouncementPending] =
    useState(false);
  const [isJailbroken, setIsJailbroken] = useState(false);
  const { t } = useAppTranslation();
  const { checkBiometrics, isBiometricsEnabled } = useBiometrics();
  const { showFullScreenUpdateNotice, dismissFullScreenNotice } =
    useAppUpdate();
  const { showMaintenanceScreen } = useMaintenanceMode();
  // Use analytics/permissions hook only after splash is hidden
  useAnalyticsPermissions({
    previousState: initializing ? undefined : "none",
  });

  // Drop the native splash as soon as JS can draw, with no fade: the animated
  // splash in SplashOverlay takes over the screen from here, and a cross-fade
  // would only delay it.
  useEffect(() => {
    RNBootSplash.hide({ fade: false });
  }, []);

  // Run once on mount: check jailbreak, fetch auth status from storage, trigger
  // face-id onboarding if needed. We intentionally omit deps so this only fires
  // once — subsequent auth status changes are handled by the RootStack's
  // conditional screen rendering.
  useEffect(() => {
    const initializeApp = async (): Promise<void> => {
      const deviceCompromised = isDeviceJailbroken();
      setIsJailbroken(deviceCompromised);

      if (deviceCompromised) {
        setIsAuthStatusReady(true);
        return;
      }

      // Load persisted network preference before any auth or data fetching
      // so components always read the correct network from the start.
      await initializeNetwork();

      // Hydrate the auto-lock timer from its secure-storage source of truth
      // (it's intentionally not kept in the unencrypted preferences store).
      await usePreferencesStore.getState().hydrateAutoLockTimer();

      // Settle the one-time rebrand announcement before any wallet can be created,
      // and read the answer now so the overlay can render without a flash.
      await markRebrandAnnouncementEligibility();
      const isWelcomePending = await shouldShowRebrandAnnouncement();

      // Fetch the real auth status from storage and overwrite the initial
      // NOT_AUTHENTICATED default before any navigation decision is made.
      const freshAuthStatus = await getAuthStatus();
      setIsRebrandAnnouncementPending(isWelcomePending);
      setIsAuthStatusReady(true);

      triggerFaceIdOnboarding(
        navigation,
        freshAuthStatus,
        checkBiometrics,
        isBiometricsEnabled ?? false,
      );
    };

    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run only once on mount

  // Wait for ALL initialization states to complete before showing any UI.
  // This prevents a flash of the wrong screen while auth status is loading.
  useEffect(() => {
    if (
      isAnalyticsInitialized() &&
      remoteConfigInitialized &&
      isAuthStatusReady
    ) {
      setInitializing(false);
    }
  }, [remoteConfigInitialized, isAuthStatusReady]);

  // Show force update screen when needed
  useEffect(() => {
    if (showFullScreenUpdateNotice) {
      setShowForceUpdate(true);
    }
  }, [showFullScreenUpdateNotice]);

  // A wallet wipe settles the flag in storage; drop the in-memory answer too.
  useEffect(() => {
    if (authStatus === AUTH_STATUS.NOT_AUTHENTICATED) {
      setIsRebrandAnnouncementPending(false);
    }
  }, [authStatus]);

  // Soft lock keeps the authenticated tree mounted (covered by the lock
  // overlay) so navigation history and in-progress inputs survive the lock.
  const showAuthenticatedStack =
    authStatus === AUTH_STATUS.AUTHENTICATED || isSoftLocked;

  // Overlay the rebrand announcement on the first authenticated entry. Derived,
  // not effect-driven, so it mounts in the same commit as the stack beneath it.
  // Tracks showAuthenticatedStack so a soft lock covers it rather than
  // unmounting it.
  const showRebrandAnnouncement =
    isRebrandAnnouncementPending && showAuthenticatedStack;

  // Once shown it is seen (storage says so too): if a hard lock unmounts it,
  // don't bring it back after the next unlock.
  const hasShownRebrandAnnouncement = useRef(false);
  const dismissRebrandAnnouncement = useCallback(
    () => setIsRebrandAnnouncementPending(false),
    [],
  );
  useEffect(() => {
    if (showRebrandAnnouncement) {
      hasShownRebrandAnnouncement.current = true;
    } else if (hasShownRebrandAnnouncement.current) {
      setIsRebrandAnnouncementPending(false);
    }
  }, [showRebrandAnnouncement]);

  // Make the stack re-render when auth status changes
  const initialRouteName = useMemo(() => {
    if (showAuthenticatedStack) {
      return ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK;
    }

    if (
      authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ||
      authStatus === AUTH_STATUS.LOCKED
    ) {
      return ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN;
    }

    return ROOT_NAVIGATOR_ROUTES.AUTH_STACK;
  }, [authStatus, showAuthenticatedStack]);

  if (isJailbroken) {
    return <SecurityBlockScreen />;
  }

  // The splash overlays the app tree instead of standing in for it, so the
  // screen beneath mounts as soon as initialisation settles and the fade-out
  // uncovers something already drawn. Returning the splash early instead would
  // leave nothing mounted underneath for it to fade into.
  const renderContent = () => {
    // Nothing to sit under the splash yet; it covers the whole screen anyway.
    if (initializing) {
      return null;
    }

    // Force update shown first — dismissible, after which the maintenance screen may appear
    if (showForceUpdate) {
      return (
        <ForceUpdateScreen
          onDismiss={() => {
            dismissFullScreenNotice();
            setShowForceUpdate(false);
          }}
        />
      );
    }

    // Maintenance screen shown when services are degraded (lower priority than force update)
    if (showMaintenanceScreen) {
      return <MaintenanceScreen />;
    }

    return (
      // While soft-locked, hide the mounted tree from screen readers
      // (Android: no-hide-descendants; iOS: accessibilityElementsHidden) so the
      // overlay — a sibling rendered in App.tsx — isn't bypassed by TalkBack /
      // VoiceOver. The overlay also sets accessibilityViewIsModal (iOS).
      <View
        style={styles.flex}
        importantForAccessibility={
          isSoftLocked ? "no-hide-descendants" : "auto"
        }
        accessibilityElementsHidden={isSoftLocked}
      >
        {/* Same treatment while the rebrand announcement covers the tree. */}
        <View
          style={styles.flex}
          importantForAccessibility={
            showRebrandAnnouncement ? "no-hide-descendants" : "auto"
          }
          accessibilityElementsHidden={showRebrandAnnouncement}
        >
          <RootStack.Navigator
            initialRouteName={initialRouteName}
            screenOptions={{
              headerShown: false,
            }}
          >
            {showAuthenticatedStack ? (
              <RootStack.Group>
                <RootStack.Screen
                  name={ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK}
                  component={TabNavigator}
                />
                <RootStack.Screen
                  name={ROOT_NAVIGATOR_ROUTES.MANAGE_TOKENS_STACK}
                  component={ManageTokensStackNavigator}
                  options={getStackBottomNavigateOptions()}
                />
                <RootStack.Screen
                  name={ROOT_NAVIGATOR_ROUTES.MANAGE_WALLETS_STACK}
                  component={ManageWalletsStackNavigator}
                  options={getStackBottomNavigateOptions()}
                />
                <RootStack.Screen
                  name={ROOT_NAVIGATOR_ROUTES.SETTINGS_STACK}
                  component={SettingsStackNavigator}
                  options={getStackBottomNavigateOptions()}
                />
                <RootStack.Screen
                  name={ROOT_NAVIGATOR_ROUTES.SEND_PAYMENT_STACK}
                  component={SendPaymentStackNavigator}
                  options={getStackBottomNavigateOptions()}
                />
                <RootStack.Screen
                  name={ROOT_NAVIGATOR_ROUTES.SWAP_STACK}
                  component={SwapStackNavigator}
                  options={getStackBottomNavigateOptions()}
                />
                <RootStack.Screen
                  name={ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN}
                  component={ScanQRCodeScreen}
                  options={({ route }) =>
                    withTransitionOverride(getScreenOptionsNoHeader(), route)
                  }
                />
                <RootStack.Screen
                  name={ROOT_NAVIGATOR_ROUTES.SCAN_RECEIVE_SCREEN}
                  component={ScanReceiveScreen}
                  options={getScreenOptionsNoHeader()}
                />
                <RootStack.Screen
                  name={ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK}
                  component={AddFundsStackNavigator}
                  options={getStackBottomNavigateOptions()}
                />
                <RootStack.Screen
                  name={ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN}
                  component={TokenDetailsScreen}
                  options={getScreenBottomNavigateOptions("")}
                />
                <RootStack.Screen
                  name={ROOT_NAVIGATOR_ROUTES.COLLECTIBLE_DETAILS_SCREEN}
                  component={CollectibleDetailsScreen}
                  options={getScreenBottomNavigateOptions("")}
                />
                <RootStack.Screen
                  name={ROOT_NAVIGATOR_ROUTES.ADD_COLLECTIBLE_SCREEN}
                  component={AddCollectibleScreen}
                  options={getScreenBottomNavigateOptions(
                    t("addCollectibleScreen.title"),
                  )}
                />
                <RootStack.Screen
                  name={ROOT_NAVIGATOR_ROUTES.HIDDEN_COLLECTIBLES_SCREEN}
                  component={HiddenCollectiblesScreen}
                  options={getScreenBottomNavigateOptions(
                    t("hiddenCollectiblesScreen.title"),
                  )}
                />
                <RootStack.Screen
                  name={AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN}
                  component={BiometricsOnboardingScreen}
                  options={getScreenBottomNavigateOptions("")}
                />
              </RootStack.Group>
            ) : authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ||
              authStatus === AUTH_STATUS.LOCKED ? (
              <RootStack.Screen
                name={ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN}
                component={LockScreen}
              />
            ) : (
              <RootStack.Screen
                name={ROOT_NAVIGATOR_ROUTES.AUTH_STACK}
                component={AuthNavigator}
              />
            )}
          </RootStack.Navigator>
        </View>
        {showRebrandAnnouncement && (
          <View style={styles.overlay} accessibilityViewIsModal>
            <RebrandAnnouncementScreen onDismiss={dismissRebrandAnnouncement} />
          </View>
        )}
      </View>
    );
  };

  return <SplashOverlay ready={!initializing}>{renderContent()}</SplashOverlay>;
};
