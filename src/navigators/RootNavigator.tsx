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
import { logger } from "config/logger";
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
import useGetActiveAccount from "hooks/useGetActiveAccount";
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
import { useToast } from "providers/ToastProvider";
import React, { useEffect, useMemo, useState } from "react";
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

// Maximum time to wait for app initialization before forcing exit from loading screen
const INITIALIZATION_TIMEOUT_MS = 30000; // 30 seconds

export const RootNavigator = () => {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList & AuthStackParamList>
    >();
  const { authStatus, getAuthStatus, setAuthStatus } = useAuthenticationStore();
  const { account } = useGetActiveAccount();
  const remoteConfigInitialized = useRemoteConfigStore(
    (state) => state.isInitialized,
  );
  const [initializing, setInitializing] = useState(true);
  const [showForceUpdate, setShowForceUpdate] = useState(false);
  const [isJailbroken, setIsJailbroken] = useState(false);
  const [initializationTimedOut, setInitializationTimedOut] = useState(false);
  const { t } = useAppTranslation();
  const { checkBiometrics, isBiometricsEnabled } = useBiometrics();
  const { showFullScreenUpdateNotice, dismissFullScreenNotice } =
    useAppUpdate();
  const { showToast } = useToast();
  // Use analytics/permissions hook only after splash is hidden
  useAnalyticsPermissions({
    previousState: initializing ? undefined : "none",
  });

  useAppOpenBiometricsLogin(initializing);

  // Safety timeout: If initialization takes longer than 10 seconds, force exit loading
  // This prevents users from getting stuck on infinite loading screen
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (initializing) {
        logger.error(
          "RootNavigator",
          "Initialization timeout - forcing exit from loading screen",
          new Error("Initialization timeout"),
          {
            authStatus,
            remoteConfigInitialized,
          },
        );
        setInitializationTimedOut(true);
        setInitializing(false);
        RNBootSplash.hide({ fade: true });
      }
    }, INITIALIZATION_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [initializing, authStatus, remoteConfigInitialized]);

  useEffect(() => {
    const initializeApp = async (
      postInitializeCallback?: () => void,
    ): Promise<void> => {
      const deviceCompromised = isDeviceJailbroken();
      setIsJailbroken(deviceCompromised);

      if (deviceCompromised) {
        setInitializing(false);
        RNBootSplash.hide({ fade: true });
        return; // Block further initialization
      }

      await getAuthStatus();
      if (postInitializeCallback) {
        postInitializeCallback();
      }
    };

    initializeApp(() => {
      triggerFaceIdOnboarding(
        navigation,
        authStatus,
        checkBiometrics,
        isBiometricsEnabled ?? false,
      );
    });
  }, [
    getAuthStatus,
    navigation,
    authStatus,
    checkBiometrics,
    isBiometricsEnabled,
  ]);

  // Wait for all initialization states to complete
  useEffect(() => {
    if (
      (isAnalyticsInitialized() && remoteConfigInitialized) ||
      initializationTimedOut
    ) {
      setInitializing(false);
      RNBootSplash.hide({ fade: true });
    }
  }, [remoteConfigInitialized, initializationTimedOut]);

  // Guard: Detect inconsistent state (AUTHENTICATED but no account)
  // This should never happen after our fixes, but serves as final safety net
  useEffect(() => {
    if (authStatus === AUTH_STATUS.AUTHENTICATED && !account && !initializing) {
      logger.error(
        "RootNavigator",
        "CRITICAL: Detected inconsistent state - AUTHENTICATED with no account. Forcing state change to LOCKED.",
        new Error("Inconsistent auth state"),
        {
          authStatus,
          hasAccount: !!account,
        },
      );
      setAuthStatus(AUTH_STATUS.LOCKED);
    }
  }, [authStatus, account, initializing, setAuthStatus]);

  // Show toast when hash key or temp store is not found (hash key expired)
  useEffect(() => {
    if (
      authStatus === AUTH_STATUS.HASH_KEY_EXPIRED &&
      !initializing &&
      !initializationTimedOut
    ) {
      showToast({
        variant: "error",
        title: t("authStore.error.errorUnlockingWallet"),
        message: t("authStore.error.errorUnlockingWalletMessage"),
        toastId: "hash-key-expired-toast",
        duration: 6000,
      });
    }
  }, [authStatus, initializing, initializationTimedOut, showToast, t]);

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
