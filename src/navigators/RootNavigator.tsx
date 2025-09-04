/* eslint-disable no-nested-ternary */
/* eslint-disable react/no-unstable-nested-components */
import { useNavigation } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import AccountQRCodeScreen from "components/screens/AccountQRCodeScreen";
import AddCollectibleScreen from "components/screens/AddCollectibleScreen";
import { BiometricsOnboardingScreen } from "components/screens/BiometricsEnableScreen/BiometricsEnableScreen";
import CollectibleDetailsScreen from "components/screens/CollectibleDetailsScreen";
import ConnectedAppsScreen from "components/screens/ConnectedAppsScreen";
import { LoadingScreen } from "components/screens/LoadingScreen";
import { LockScreen } from "components/screens/LockScreen";
import ScanQRCodeScreen from "components/screens/ScanQRCodeScreen";
import TokenDetailsScreen from "components/screens/TokenDetailsScreen";
import Icon from "components/sds/Icon";
import { STORAGE_KEYS } from "config/constants";
import {
  ManageWalletsStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
  SettingsStackParamList,
  SendPaymentStackParamList,
  BuyXLMStackParamList,
  ManageTokensStackParamList,
  AUTH_STACK_ROUTES,
  AuthStackParamList,
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
import React, { useEffect, useMemo, useRef, useState } from "react";
import RNBootSplash from "react-native-bootsplash";
import { dataStorage } from "services/storage/storageFactory";

const RootStack = createNativeStackNavigator<
  RootStackParamList &
    ManageTokensStackParamList &
    SettingsStackParamList &
    ManageWalletsStackParamList &
    SendPaymentStackParamList &
    BuyXLMStackParamList &
    AuthStackParamList
>();

export const RootNavigator = () => {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList & AuthStackParamList>
    >();
  const { authStatus, getAuthStatus } = useAuthenticationStore();
  const [initializing, setInitializing] = useState(true);
  const hasSeenFaceIdOnboardingRef = useRef(false);
  const { t } = useAppTranslation();
  const { checkBiometrics } = useBiometrics();
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
            .getItem(STORAGE_KEYS.HAS_SEEN_FACE_ID_ONBOARDING)
            .then(async (hasSeenFaceIdOnboardingStorage) => {
              const type = await checkBiometrics();
              if (hasSeenFaceIdOnboardingStorage !== "true" && !!type) {
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
    hasSeenFaceIdOnboardingRef,
    navigation,
    authStatus,
    checkBiometrics,
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
          <RootStack.Screen
            name={ROOT_NAVIGATOR_ROUTES.ADD_COLLECTIBLE_SCREEN}
            component={AddCollectibleScreen}
            options={{
              headerTitle: t("addCollectibleScreen.title"),
              headerShown: true,
              header: (props) => <CustomNavigationHeader {...props} />,
              headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
            }}
          />
          {!hasSeenFaceIdOnboardingRef.current && (
            <RootStack.Screen
              name={AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN}
              component={BiometricsOnboardingScreen}
              options={{
                headerShown: true,
                header: (props) => <CustomNavigationHeader {...props} />,
                headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
              }}
            />
          )}
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
