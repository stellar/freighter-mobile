/* eslint-disable no-nested-ternary */
/* eslint-disable react/no-unstable-nested-components */
import { useNavigation } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import AccountQRCodeScreen from "components/screens/AccountQRCodeScreen";
import AddCollectibleScreen from "components/screens/AddCollectibleScreen";
import { BiometricsOnboardingScreen } from "components/screens/BiometricsEnableScreen/BiometricsEnableScreen";
import CollectibleDetailsScreen from "components/screens/CollectibleDetailsScreen";
import ConnectedAppsScreen from "components/screens/ConnectedAppsScreen";
import { ForceUpdateScreen } from "components/screens/ForceUpdateScreen/ForceUpdateScreen";
import HiddenCollectiblesScreen from "components/screens/HiddenCollectiblesScreen";
import { LoadingScreen } from "components/screens/LoadingScreen";
import { LockScreen } from "components/screens/LockScreen";
import ScanQRCodeScreen from "components/screens/ScanQRCodeScreen";
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
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { isDeviceJailbroken } from "helpers/deviceSecurity";
import {
  getStackBottomNavigateOptions,
  getScreenOptionsNoHeader,
  getScreenBottomNavigateOptions,
} from "helpers/navigationOptions";
import { triggerFaceIdOnboarding } from "helpers/postOnboardingBiometrics";
import { useAnalyticsPermissions } from "hooks/useAnalyticsPermissions";
import { useAppOpenBiometricsLogin } from "hooks/useAppOpenBiometricsLogin";
import useAppTranslation from "hooks/useAppTranslation";
import { useAppUpdate } from "hooks/useAppUpdate";
import { useBiometrics } from "hooks/useBiometrics";
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
import React, { useEffect, useMemo, useRef, useState } from "react";
import RNBootSplash from "react-native-bootsplash";
import { isInitialized as isAnalyticsInitialized } from "services/analytics/core";

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
  const { authStatus, getAuthStatus } = useAuthenticationStore();
  const remoteConfigInitialized = useRemoteConfigStore(
    (state) => state.isInitialized,
  );
  const [initializing, setInitializing] = useState(true);
  const [isAuthStatusReady, setIsAuthStatusReady] = useState(false);
  const [showForceUpdate, setShowForceUpdate] = useState(false);
  const [isJailbroken, setIsJailbroken] = useState(false);
  const { t } = useAppTranslation();
  const { checkBiometrics, isBiometricsEnabled } = useBiometrics();
  const { showFullScreenUpdateNotice, dismissFullScreenNotice } =
    useAppUpdate();
  // Use analytics/permissions hook only after splash is hidden
  useAnalyticsPermissions({
    previousState: initializing ? undefined : "none",
  });

  useAppOpenBiometricsLogin(initializing);

  // Keep biometric values in refs so the one-time initializeApp effect can read
  // the latest values without depending directly on them (which would re-run it).
  const checkBiometricsRef = useRef(checkBiometrics);
  const isBiometricsEnabledRef = useRef(isBiometricsEnabled);
  useEffect(() => {
    // This runs on every render to keep the refs up to date with the latest values.
    checkBiometricsRef.current = checkBiometrics;
    isBiometricsEnabledRef.current = isBiometricsEnabled;
  });

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
        RNBootSplash.hide({ fade: true });
        return;
      }

      // Fetch the real auth status from storage and overwrite the initial
      // NOT_AUTHENTICATED default before any navigation decision is made.
      const freshAuthStatus = await getAuthStatus();
      setIsAuthStatusReady(true);

      triggerFaceIdOnboarding(
        navigation,
        freshAuthStatus,
        checkBiometricsRef.current,
        isBiometricsEnabledRef.current ?? false,
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
      RNBootSplash.hide({ fade: true });
    }
  }, [remoteConfigInitialized, isAuthStatusReady]);

  // Show force update screen when needed
  useEffect(() => {
    if (showFullScreenUpdateNotice) {
      setShowForceUpdate(true);
    }
  }, [showFullScreenUpdateNotice]);

  // Make the stack re-render when auth status changes
  const initialRouteName = useMemo(() => {
    if (authStatus === AUTH_STATUS.AUTHENTICATED) {
      return ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK;
    }

    if (
      authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ||
      authStatus === AUTH_STATUS.LOCKED
    ) {
      return ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN;
    }

    return ROOT_NAVIGATOR_ROUTES.AUTH_STACK;
  }, [authStatus]);

  if (isJailbroken) {
    return <SecurityBlockScreen />;
  }

  if (initializing) {
    return <LoadingScreen />;
  }

  // Show force update screen if required
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

  return (
    <RootStack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
      }}
    >
      {authStatus === AUTH_STATUS.AUTHENTICATED ? (
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
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.SWAP_STACK}
            component={SwapStackNavigator}
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN}
            component={AccountQRCodeScreen}
            options={getScreenBottomNavigateOptions(
              t("accountQRCodeScreen.title"),
            )}
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN}
            component={ScanQRCodeScreen}
            options={getScreenOptionsNoHeader()}
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.CONNECTED_APPS_SCREEN}
            component={ConnectedAppsScreen}
            options={getScreenBottomNavigateOptions(t("connectedApps.title"))}
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
  );
};
