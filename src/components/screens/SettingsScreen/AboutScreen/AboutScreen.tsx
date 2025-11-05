import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FreighterLogo } from "components/FreighterLogo";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  FREIGHTER_BASE_URL,
  STELLAR_FOUNDATION_BASE_URL,
  FREIGHTER_TERMS_URL,
  FREIGHTER_PRIVACY_URL,
} from "config/constants";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { getAppVersionAndBuildNumber } from "helpers/version";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React from "react";
import { View } from "react-native";

type AboutScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.ABOUT_SCREEN
>;

const AboutScreen: React.FC<AboutScreenProps> = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const appVersion = getAppVersionAndBuildNumber();
  const currentYear = new Date().getFullYear();
  const { open: openInAppBrowser } = useInAppBrowser();

  const linksListItems = [
    {
      icon: <Icon.Link02 size={20} color={themeColors.foreground.primary} />,
      title: t("aboutScreen.links.freighter"),
      onPress: () => openInAppBrowser(FREIGHTER_BASE_URL),
    },
    {
      icon: <Icon.Link02 size={20} color={themeColors.foreground.primary} />,
      title: t("aboutScreen.links.stellar"),
      onPress: () => openInAppBrowser(STELLAR_FOUNDATION_BASE_URL),
    },
    {
      icon: <Icon.Link02 size={20} color={themeColors.foreground.primary} />,
      title: t("aboutScreen.links.privacyPolicy"),
      onPress: () => openInAppBrowser(FREIGHTER_PRIVACY_URL),
    },
    {
      icon: <Icon.Link02 size={20} color={themeColors.foreground.primary} />,
      title: t("aboutScreen.links.termsOfService"),
      onPress: () => openInAppBrowser(FREIGHTER_TERMS_URL),
    },
  ];

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex mt-4 bg-background-secondary rounded-[16px] gap-9 p-7">
        <View className="flex gap-4">
          <FreighterLogo />

          <View className="flex gap-2">
            <Text md medium>
              {t("aboutScreen.freighterDescription")}
            </Text>
            <Text sm medium secondary>
              {appVersion}
            </Text>
          </View>
        </View>
        <View className="flex gap-2">
          <Text md medium>
            {t("aboutScreen.listTitle")}
          </Text>
          <List
            items={linksListItems}
            variant="transparent"
            hideDivider
            compact
          />
        </View>
        <Text sm medium secondary>
          {t("aboutScreen.stellarFoundation", { year: currentYear })}
        </Text>
      </View>
    </BaseLayout>
  );
};

export default AboutScreen;
