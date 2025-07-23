import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import { Toggle } from "components/sds/Toggle";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { useAnalyticsStore } from "ducks/analytics";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";
import { analytics } from "services/analytics";

type PreferencesScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.PREFERENCES_SCREEN
>;

const PreferencesScreen: React.FC<PreferencesScreenProps> = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { isEnabled } = useAnalyticsStore();

  const handleAnalyticsToggle = () => {
    analytics.setAnalyticsEnabled(!isEnabled);
  };

  const preferencesItems = [
    {
      title: t("preferences.anonymousDataSharing.title"),
      titleColor: themeColors.text.primary,
      description: t("preferences.anonymousDataSharing.description"),
      trailingContent: (
        <Toggle
          id="analytics-toggle"
          checked={isEnabled}
          onChange={handleAnalyticsToggle}
        />
      ),
      testID: "anonymous-data-sharing-item",
    },
  ];

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex gap-6 mt-4">
        <List items={preferencesItems} />
      </View>
    </BaseLayout>
  );
};

export default PreferencesScreen;
