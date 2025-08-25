/* eslint-disable no-nested-ternary */
/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import AccountQRCodeScreen from "components/screens/AccountQRCodeScreen";
import { BiometricsOnboardingScreen } from "components/screens/BiometricsOnboardingScreen";
import CollectibleDetailsScreen from "components/screens/CollectibleDetailsScreen";
import ConnectedAppsScreen from "components/screens/ConnectedAppsScreen";
import { LoadingScreen } from "components/screens/LoadingScreen";
import { LockScreen } from "components/screens/LockScreen";
import ScanQRCodeScreen from "components/screens/ScanQRCodeScreen";
import TokenDetailsScreen from "components/screens/TokenDetailsScreen";
import Icon from "components/sds/Icon";
import {
  ManageWalletsStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
  SettingsStackParamList,
  SendPaymentStackParamList,
  BuyXLMStackParamList,
  ManageTokensStackParamList,
} from "config/routes";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useAnalyticsPermissions } from "hooks/useAnalyticsPermissions";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import {
  AuthNavigator,
  BuyXLMStackNavigator,
  ManageTokensStackNavigator,
  ManageWalletsStackNavigator,
  SendPaymentStackNavigator,
  SettingsStackNavigator,
  SwapStackNavigator,
} from "navigators";
import { TabNavigator } from "navigators/TabNavigator";
import React, { useEffect, useMemo, useState } from "react";
import RNBootSplash from "react-native-bootsplash";

const RootStack = createNativeStackNavigator<
  RootStackParamList &
    ManageTokensStackParamList &
    SettingsStackParamList &
    ManageWalletsStackParamList &
    SendPaymentStackParamList &
    BuyXLMStackParamList
>();

export const RootNavigator = () => {
  const { authStatus, getAuthStatus } = useAuthenticationStore();
  const { isBiometricsEnabled } = useBiometrics();
  const [initializing, setInitializing] = useState(true);
  const { t } = useAppTranslation();

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
    initializeApp();
  }, [getAuthStatus]);

  // Make the stack re-render when auth status changes
  const initialRouteName = useMemo(() => {
    if (authStatus === AUTH_STATUS.AUTHENTICATED) {
      return ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK;
    }

    if (authStatus === AUTH_STATUS.HASH_KEY_EXPIRED) {
      return ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN;
    }
    if (
      authStatus === AUTH_STATUS.AUTHENTICATED_UNVERIFIED_BIOMETRICS &&
      isBiometricsEnabled === undefined
    ) {
      return ROOT_NAVIGATOR_ROUTES.BIOMETRICS_ONBOARDING_SCREEN;
    }

    return ROOT_NAVIGATOR_ROUTES.AUTH_STACK;
  }, [authStatus, isBiometricsEnabled]);

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
            name={ROOT_NAVIGATOR_ROUTES.AUTH_STACK}
            component={AuthNavigator}
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK}
            component={TabNavigator}
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.MANAGE_TOKENS_STACK}
            component={ManageTokensStackNavigator}
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.MANAGE_WALLETS_STACK}
            component={ManageWalletsStackNavigator}
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.SETTINGS_STACK}
            component={SettingsStackNavigator}
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
            options={{
              headerTitle: t("accountQRCodeScreen.title"),
              headerShown: true,
              header: (props) => <CustomNavigationHeader {...props} />,
            }}
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN}
            component={ScanQRCodeScreen}
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.CONNECTED_APPS_SCREEN}
            component={ConnectedAppsScreen}
            options={{
              headerTitle: t("connectedApps.title"),
              headerShown: true,
              header: (props) => <CustomNavigationHeader {...props} />,
              headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
            }}
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK}
            component={BuyXLMStackNavigator}
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN}
            component={TokenDetailsScreen}
            options={{
              headerShown: true,
              header: (props) => <CustomNavigationHeader {...props} />,
              headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
            }}
          />
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.COLLECTIBLE_DETAILS_SCREEN}
            component={CollectibleDetailsScreen}
            options={{
              headerShown: true,
              header: (props) => <CustomNavigationHeader {...props} />,
              headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
            }}
          />
        </RootStack.Group>
      ) : authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ? (
        <RootStack.Screen
          name={ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN}
          component={LockScreen}
        />
      ) : authStatus === AUTH_STATUS.AUTHENTICATED_UNVERIFIED_BIOMETRICS ? (
        <RootStack.Screen
          name={ROOT_NAVIGATOR_ROUTES.BIOMETRICS_ONBOARDING_SCREEN}
          component={BiometricsOnboardingScreen}
          options={{
            headerShown: true,
            header: (props) => <CustomNavigationHeader {...props} />,
            headerBackButtonMenuEnabled: false,
            headerLeft: () => null,
          }}
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
