/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import ChangeNetworkScreen from "components/screens/ChangeNetworkScreen";
import NetworkSettingsScreen from "components/screens/ChangeNetworkScreen/NetworkSettingsScreen";
import SettingsScreen from "components/screens/SettingsScreen";
import AboutScreen from "components/screens/SettingsScreen/AboutScreen";
import PreferencesScreen from "components/screens/SettingsScreen/PreferencesScreen";
import SecurityScreen from "components/screens/SettingsScreen/SecurityScreen";
import BiometricsSettingsScreen from "components/screens/SettingsScreen/SecurityScreen/BiometricsSettingsScreen";
import ShowRecoveryPhraseScreen from "components/screens/SettingsScreen/SecurityScreen/ShowRecoveryPhraseScreen";
import YourRecoveryPhraseScreen from "components/screens/SettingsScreen/SecurityScreen/YourRecoveryPhraseScreen";
import ShareFeedbackScreen from "components/screens/SettingsScreen/ShareFeedbackScreen";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import {
  getScreenBottomNavigateOptions,
  resetNestedNavigationOptions,
} from "helpers/navigationOptions";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import React from "react";
import { BIOMETRY_TYPE } from "react-native-keychain";

const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

export const SettingsStackNavigator = () => {
  const { t } = useAppTranslation();
  const { biometryType } = useBiometrics();

  const biometryTitle: Record<BIOMETRY_TYPE, string> = {
    [BIOMETRY_TYPE.FACE_ID]: t("securityScreen.faceId.title"),
    [BIOMETRY_TYPE.FINGERPRINT]: t("securityScreen.fingerprint.title"),
    [BIOMETRY_TYPE.TOUCH_ID]: t("securityScreen.touchId.title"),
    [BIOMETRY_TYPE.FACE]: t("securityScreen.faceBiometrics.title"),
    [BIOMETRY_TYPE.OPTIC_ID]: t("securityScreen.opticId.title"),
    [BIOMETRY_TYPE.IRIS]: t("securityScreen.iris.title"),
  };
  return (
    <SettingsStack.Navigator
      screenOptions={{
        header: (props) => <CustomNavigationHeader {...props} />,
        ...resetNestedNavigationOptions(t("settings.title")),
      }}
    >
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.SETTINGS_SCREEN}
        component={SettingsScreen}
        options={getScreenBottomNavigateOptions(t("settings.title"))}
      />
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.CHANGE_NETWORK_SCREEN}
        component={ChangeNetworkScreen}
        options={{
          headerTitle: t("settings.network"),
        }}
      />
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.NETWORK_SETTINGS_SCREEN}
        component={NetworkSettingsScreen}
        options={{
          headerTitle: t("networkSettingsScreen.title"),
        }}
      />
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.PREFERENCES_SCREEN}
        component={PreferencesScreen}
        options={{
          headerTitle: t("settings.preferences"),
        }}
      />
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.SHARE_FEEDBACK_SCREEN}
        component={ShareFeedbackScreen}
        options={{
          headerTitle: t("shareFeedbackScreen.title"),
        }}
      />
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.ABOUT_SCREEN}
        component={AboutScreen}
        options={{
          headerTitle: t("aboutScreen.title"),
        }}
      />
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.SECURITY_SCREEN}
        component={SecurityScreen}
        options={{
          headerTitle: t("securityScreen.title"),
        }}
      />
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.SHOW_RECOVERY_PHRASE_SCREEN}
        component={ShowRecoveryPhraseScreen}
        options={{
          headerTitle: t("showRecoveryPhraseScreen.title"),
        }}
      />
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.YOUR_RECOVERY_PHRASE_SCREEN}
        component={YourRecoveryPhraseScreen}
        options={{
          headerTitle: t("yourRecoveryPhrase.title"),
        }}
      />
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.BIOMETRICS_SETTINGS_SCREEN}
        component={BiometricsSettingsScreen}
        options={{
          headerTitle: biometryTitle[biometryType!],
        }}
      />
    </SettingsStack.Navigator>
  );
};
