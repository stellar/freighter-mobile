import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

type SecurityScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.SECURITY_SCREEN
>;

const SecurityScreen: React.FC<SecurityScreenProps> = ({ navigation }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const listItems = [
    {
      icon: <Icon.FileLock02 color={themeColors.foreground.primary} />,
      title: t("securityScreen.showRecoveryPhrase"),
      titleColor: themeColors.text.primary,
      onPress: () =>
        navigation.navigate(SETTINGS_ROUTES.SHOW_RECOVERY_PHRASE_SCREEN),
      trailingContent: (
        <Icon.ChevronRight color={themeColors.foreground.primary} />
      ),
      testID: "show-recovery-phrase-button",
    },
  ];

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex flex-col gap-6 mt-4">
        <List items={listItems} />
      </View>
    </BaseLayout>
  );
};

export default SecurityScreen;
