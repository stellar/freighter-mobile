/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import ChangeNetworkScreen from "components/screens/ChangeNetworkScreen";
import NetworkSettingsScreen from "components/screens/ChangeNetworkScreen/NetworkSettingsScreen";
import SettingsScreen from "components/screens/SettingsScreen";
import AboutScreen from "components/screens/SettingsScreen/AboutScreen";
import PreferencesScreen from "components/screens/SettingsScreen/PreferencesScreen";
import SecurityScreen from "components/screens/SettingsScreen/SecurityScreen";
import ShowRecoveryPhraseScreen from "components/screens/SettingsScreen/SecurityScreen/ShowRecoveryPhraseScreen";
import YourRecoveryPhraseScreen from "components/screens/SettingsScreen/SecurityScreen/YourRecoveryPhraseScreen";
import ShareFeedbackScreen from "components/screens/SettingsScreen/ShareFeedbackScreen";
import Icon from "components/sds/Icon";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

export const SettingsStackNavigator = () => {
  const { t } = useAppTranslation();

  return (
    <SettingsStack.Navigator
      screenOptions={{
        header: (props) => <CustomNavigationHeader {...props} />,
      }}
    >
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.SETTINGS_SCREEN}
        component={SettingsScreen}
        options={{
          headerTitle: t("settings.title"),
          headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
        }}
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
    </SettingsStack.Navigator>
  );
};
