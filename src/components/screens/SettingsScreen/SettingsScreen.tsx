/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { FREIGHTER_BASE_URL } from "config/constants";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { getAppVersionAndBuildNumber } from "helpers/version";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { Linking, View } from "react-native";

type SettingsScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.SETTINGS_SCREEN
>;

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { logout } = useAuthenticationStore();
  const { t } = useAppTranslation();
  const appVersion = getAppVersionAndBuildNumber();
  const { themeColors } = useColors();

  const handleLogout = () => {
    logout();
  };

  const topListItems = [
    {
      icon: <Icon.UserCircle color={themeColors.foreground.primary} />,
      title: t("settings.preferences"),
      titleColor: themeColors.text.primary,
      onPress: () => navigation.navigate(SETTINGS_ROUTES.PREFERENCES_SCREEN),
      trailingContent: (
        <Icon.ChevronRight color={themeColors.foreground.primary} />
      ),
      testID: "preferences-button",
    },
  ];

  const midListItems = [
    {
      icon: <Icon.Server05 color={themeColors.foreground.primary} />,
      title: t("settings.network"),
      titleColor: themeColors.text.primary,
      onPress: () => navigation.navigate(SETTINGS_ROUTES.CHANGE_NETWORK_SCREEN),
      trailingContent: (
        <Icon.ChevronRight color={themeColors.foreground.primary} />
      ),
      testID: "change-network-button",
    },
    {
      icon: <Icon.Shield01 color={themeColors.foreground.primary} />,
      title: t("settings.security"),
      titleColor: themeColors.text.primary,
      onPress: () => navigation.navigate(SETTINGS_ROUTES.SECURITY_SCREEN),
      trailingContent: (
        <Icon.ChevronRight color={themeColors.foreground.primary} />
      ),
      testID: "security-button",
    },
    {
      icon: <Icon.LifeBuoy01 color={themeColors.foreground.primary} />,
      title: t("settings.help"),
      titleColor: themeColors.text.primary,
      onPress: () => Linking.openURL(`${FREIGHTER_BASE_URL}/faq`),
      trailingContent: (
        <Icon.ChevronRight color={themeColors.foreground.primary} />
      ),
      testID: "help-button",
    },
    {
      icon: <Icon.MessageAlertCircle color={themeColors.foreground.primary} />,
      title: t("settings.feedback"),
      titleColor: themeColors.text.primary,
      onPress: () => navigation.navigate(SETTINGS_ROUTES.SHARE_FEEDBACK_SCREEN),
      trailingContent: (
        <Icon.ChevronRight color={themeColors.foreground.primary} />
      ),
      testID: "share-feedback-button",
    },
    {
      icon: <Icon.InfoCircle color={themeColors.foreground.primary} />,
      title: t("settings.about"),
      titleColor: themeColors.text.primary,
      onPress: () => navigation.navigate(SETTINGS_ROUTES.ABOUT_SCREEN),
      trailingContent: (
        <Icon.ChevronRight color={themeColors.foreground.primary} />
      ),
      testID: "about-button",
    },
    {
      icon: <Icon.LogOut01 color={themeColors.status.error} />,
      title: t("settings.logout"),
      titleColor: themeColors.status.error,
      onPress: handleLogout,
      testID: "logout-button",
    },
  ];

  const bottomListItems = [
    {
      icon: <Icon.GitCommit color={themeColors.foreground.primary} />,
      title: t("settings.version", { version: appVersion }),
      testID: "update-button",
    },
  ];

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex flex-col gap-6 mt-4">
        <List items={topListItems} />
        <List items={midListItems} />
        <List items={bottomListItems} />
      </View>
    </BaseLayout>
  );
};

export default SettingsScreen;
