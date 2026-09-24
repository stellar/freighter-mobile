import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { useLoginDataStore } from "ducks/loginData";
import useAppTranslation from "hooks/useAppTranslation";
import { useSecureClipboard } from "hooks/useSecureClipboard";
import React from "react";
import { View } from "react-native";
import { analytics } from "services/analytics";

type YourRecoveryPhraseScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.YOUR_RECOVERY_PHRASE_SCREEN
>;

const YourRecoveryPhraseScreen: React.FC<YourRecoveryPhraseScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { mnemonicPhrase } = useLoginDataStore();
  const { copyToClipboard } = useSecureClipboard();
  const handleCopyToClipboard = () => {
    if (mnemonicPhrase) {
      copyToClipboard(mnemonicPhrase);
      analytics.trackCopyBackupPhrase();
    }
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1 p-4">
        <View className="bg-background-tertiary rounded-xl p-8 mb-6">
          <Text textAlign="center" md medium>
            {mnemonicPhrase || ""}
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
            tertiary
            onPress={handleCopyToClipboard}
            testID="copy-to-clipboard-button"
            icon={<Icon.Copy01 size={20} />}
            iconPosition={IconPosition.LEFT}
          >
            {t("yourRecoveryPhrase.copyButton")}
          </Button>
        </View>

        <Button
          secondary
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
