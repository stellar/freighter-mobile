/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/CustomNavigationHeader";
import ChangeNetworkScreen from "components/screens/ChangeNetworkScreen";
import NetworkSettingsScreen from "components/screens/ChangeNetworkScreen/NetworkSettingsScreen";
import SettingsScreen from "components/screens/SettingsScreen";
import AboutScreen from "components/screens/SettingsScreen/AboutScreen";
import ShareFeedbackScreen from "components/screens/SettingsScreen/ShareFeedbackScreen";
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
    </SettingsStack.Navigator>
  );
};
