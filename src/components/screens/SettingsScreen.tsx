/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { getAppVersion } from "helpers/version";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
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
  const { themeColors } = useColors();

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t, themeColors]);

  const handleLogout = () => {
    logout();
  };

  const topListItems = [
    {
      icon: <Icon.Server05 size={24} color={themeColors.foreground.primary} />,
      title: t("settings.network"),
      titleColor: themeColors.text.primary,
      onPress: () => navigation.navigate(SETTINGS_ROUTES.CHANGE_NETWORK_SCREEN),
      testID: "change-network-button",
    },
    {
      icon: <Icon.LogOut01 size={24} color={themeColors.status.error} />,
      title: t("settings.logout"),
      titleColor: themeColors.status.error,
      onPress: handleLogout,
      testID: "logout-button",
    },
  ];

  const bottomListItems = [
    {
      icon: <Icon.GitCommit size={24} color={themeColors.foreground.primary} />,
      title: t("settings.version", { version: appVersion }),
      testID: "update-button",
    },
  ];

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex flex-col gap-6">
        <List items={topListItems} />
        <List items={bottomListItems} />
      </View>
    </BaseLayout>
  );
};
