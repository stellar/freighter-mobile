/* eslint-disable react/no-unstable-nested-components */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/CustomNavigationHeader";
import ChangeNetworkScreen from "components/screens/ChangeNetworkScreen";
import { SettingsScreen } from "components/screens/SettingsScreen";
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
    </SettingsStack.Navigator>
  );
};
