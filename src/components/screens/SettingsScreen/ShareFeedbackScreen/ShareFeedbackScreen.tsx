import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import {
  FREIGHTER_DISCORD_URL,
  FREIGHTER_GITHUB_ISSUE_URL,
} from "config/constants";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { Linking, View } from "react-native";

type ShareFeedbackScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.SHARE_FEEDBACK_SCREEN
>;

const ShareFeedbackScreen: React.FC<ShareFeedbackScreenProps> = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const feedbackItems = [
    {
      icon: <Icon.Link02 size={20} color={themeColors.foreground.primary} />,
      title: t("shareFeedbackScreen.discord"),
      onPress: () => Linking.openURL(FREIGHTER_DISCORD_URL),
      trailingContent: (
        <Icon.ChevronRight size={24} color={themeColors.foreground.primary} />
      ),
    },
    {
      icon: <Icon.Link02 size={20} color={themeColors.foreground.primary} />,
      title: t("shareFeedbackScreen.github"),
      onPress: () => Linking.openURL(FREIGHTER_GITHUB_ISSUE_URL),
      trailingContent: (
        <Icon.ChevronRight size={24} color={themeColors.foreground.primary} />
      ),
    },
  ];

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex mt-4">
        <List items={feedbackItems} />
      </View>
    </BaseLayout>
  );
};

export default ShareFeedbackScreen;
