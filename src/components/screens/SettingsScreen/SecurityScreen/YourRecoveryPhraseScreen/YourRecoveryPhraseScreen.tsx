import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";
import { analytics } from "services/analytics";

type YourRecoveryPhraseScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.YOUR_RECOVERY_PHRASE_SCREEN
>;

const YourRecoveryPhraseScreen: React.FC<YourRecoveryPhraseScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { recoveryPhrase } = route.params;
  const { copyToClipboard } = useClipboard();
  const handleCopyToClipboard = () => {
    copyToClipboard(recoveryPhrase);

    analytics.trackCopyBackupPhrase();
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1 p-4">
        <View className="bg-background-tertiary rounded-xl p-8 mb-6">
          <Text textAlign="center" md medium>
            {recoveryPhrase}
          </Text>
        </View>

        <View className="mb-6">
          <Text sm secondary textAlign="center">
            {t("yourRecoveryPhrase.securityNote")}
          </Text>
        </View>

        <View className="flex-1" />

        <View className="mb-4">
          <Button
            secondary
            lg
            onPress={handleCopyToClipboard}
            testID="copy-to-clipboard-button"
            icon={
              <Icon.Copy01 size={20} color={themeColors.foreground.primary} />
            }
          >
            {t("yourRecoveryPhrase.copyButton")}
          </Button>
        </View>

        <Button
          tertiary
          lg
          onPress={() => navigation.popToTop()}
          testID="done-button"
        >
          {t("common.done")}
        </Button>
      </View>
    </BaseLayout>
  );
};

export default YourRecoveryPhraseScreen;
