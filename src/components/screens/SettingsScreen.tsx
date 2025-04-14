/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { getAppVersion } from "helpers/version";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useEffect } from "react";
import { TouchableOpacity, View } from "react-native";

type SettingsScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.SETTINGS_SCREEN
>;

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  navigation,
}) => {
  const { logout } = useAuthenticationStore();
  const { t } = useAppTranslation();
  const appVersion = getAppVersion();

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={24} color={THEME.colors.base.secondary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  const handleLogout = () => {
    logout();
  };

  const listItems = [
    {
      icon: <Icon.LogOut01 size={24} color={THEME.colors.list.destructive} />,
      title: t("settings.logout"),
      titleColor: THEME.colors.list.destructive,
      onPress: handleLogout,
      testID: "logout-button",
    },
  ];

  const updateListItems = [
    {
      icon: <Icon.GitCommit size={24} color={THEME.colors.list.disabled} />,
      title: t("settings.version", { version: appVersion }),
      testID: "update-button",
    },
  ];

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex flex-col gap-6">
        <List items={listItems} />
        <List items={updateListItems} />
      </View>
    </BaseLayout>
  );
};
