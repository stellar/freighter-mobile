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
import { LoadingScreen } from "components/screens/LoadingScreen";
import { LockScreen } from "components/screens/LockScreen";
import ScanQRCodeScreen from "components/screens/ScanQRCodeScreen";
import TokenDetailsScreen from "components/screens/TokenDetailsScreen";
import { STORAGE_KEYS } from "config/constants";
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
import {
  getStackBottomNavigateOptions,
  getScreenOptionsNoHeader,
  getScreenBottomNavigateOptions,
} from "helpers/navigationOptions";
import { useAnalyticsPermissions } from "hooks/useAnalyticsPermissions";
import useAppTranslation from "hooks/useAppTranslation";
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
  const { authStatus, getAuthStatus } = useAuthenticationStore();
  const [initializing, setInitializing] = useState(true);
  const { t } = useAppTranslation();
  const { checkBiometrics, isBiometricsEnabled } = useBiometrics();
  // Use analytics/permissions hook only after splash is hidden
  useAnalyticsPermissions({
    previousState: initializing ? undefined : "none",
  });

  useEffect(() => {
    const initializeApp = async () => {
      await getAuthStatus();
      setInitializing(false);
      RNBootSplash.hide({ fade: true });
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
                    postOnboarding: true,
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
