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
import { LoadingScreen } from "components/screens/LoadingScreen";
import { LockScreen } from "components/screens/LockScreen";
import ScanQRCodeScreen from "components/screens/ScanQRCodeScreen";
import TokenDetailsScreen from "components/screens/TokenDetailsScreen";
import { BiometricsSource, STORAGE_KEYS, LoginType } from "config/constants";
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
import {
  getStackBottomNavigateOptions,
  getScreenOptionsNoHeader,
  getScreenBottomNavigateOptions,
} from "helpers/navigationOptions";
import { useAnalyticsPermissions } from "hooks/useAnalyticsPermissions";
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
import React, { useEffect, useMemo, useState } from "react";
import RNBootSplash from "react-native-bootsplash";
import { isInitialized as isAnalyticsInitialized } from "services/analytics/core";
import { dataStorage } from "services/storage/storageFactory";

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
  const {
    authStatus,
    getAuthStatus,
    verifyActionWithBiometrics,
    signInMethod,
    signIn,
    hasTriggeredAppOpenBiometricsLogin,
    setHasTriggeredAppOpenBiometricsLogin,
  } = useAuthenticationStore();
  const remoteConfigInitialized = useRemoteConfigStore(
    (state) => state.isInitialized,
  );
  const [initializing, setInitializing] = useState(true);
  const [showForceUpdate, setShowForceUpdate] = useState(false);
  const { t } = useAppTranslation();
  const { checkBiometrics, isBiometricsEnabled } = useBiometrics();
  const { showFullScreenUpdateNotice, dismissFullScreenNotice } =
    useAppUpdate();
  // Use analytics/permissions hook only after splash is hidden
  useAnalyticsPermissions({
    previousState: initializing ? undefined : "none",
  });

  useEffect(() => {
    const initializeApp = async () => {
      await getAuthStatus();
    };

    const triggerFaceIdOnboarding = () => {
      if (authStatus === AUTH_STATUS.AUTHENTICATED) {
        setTimeout(() => {
          dataStorage
            .getItem(STORAGE_KEYS.HAS_SEEN_BIOMETRICS_ENABLE_SCREEN)
            .then(async (hasSeenBiometricsEnableScreenStorage) => {
              const type = await checkBiometrics();
              if (
                !isBiometricsEnabled &&
                hasSeenBiometricsEnableScreenStorage !== "true" &&
                !!type
              ) {
                navigation.navigate(
                  AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN,
                  {
                    source: BiometricsSource.POST_ONBOARDING,
                  },
                );
              }
            });
        }, 3000);
      }
    };

    initializeApp().then(() => {
      triggerFaceIdOnboarding();
    });
  }, [
    getAuthStatus,
    navigation,
    authStatus,
    checkBiometrics,
    isBiometricsEnabled,
  ]);

  // Set hasTriggeredAppOpenBiometricsLogin to true when user becomes authenticated
  useEffect(() => {
    if (authStatus === AUTH_STATUS.AUTHENTICATED) {
      setHasTriggeredAppOpenBiometricsLogin(true);

      return;
    }

    if (
      authStatus === AUTH_STATUS.HASH_KEY_EXPIRED &&
      isBiometricsEnabled &&
      !hasTriggeredAppOpenBiometricsLogin &&
      signInMethod !== LoginType.PASSWORD &&
      !initializing
    ) {
      setHasTriggeredAppOpenBiometricsLogin(true);

      verifyActionWithBiometrics(async (biometricPassword?: string) => {
        if (biometricPassword) {
          await signIn({ password: biometricPassword });
        }
      });
    }
  }, [
    authStatus,
    isBiometricsEnabled,
    signInMethod,
    initializing,
    hasTriggeredAppOpenBiometricsLogin,
    setHasTriggeredAppOpenBiometricsLogin,
    verifyActionWithBiometrics,
    signIn,
  ]);

  // Wait for all initialization states to complete
  useEffect(() => {
    if (isAnalyticsInitialized() && remoteConfigInitialized) {
      setInitializing(false);
      RNBootSplash.hide({ fade: true });
    }
  }, [remoteConfigInitialized]);

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

    if (authStatus === AUTH_STATUS.HASH_KEY_EXPIRED) {
      return ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN;
    }

    return ROOT_NAVIGATOR_ROUTES.AUTH_STACK;
  }, [authStatus]);

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
            name={AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN}
            component={BiometricsOnboardingScreen}
            options={getScreenBottomNavigateOptions("")}
          />
        </RootStack.Group>
      ) : authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ? (
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
