import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useState } from "react";
import { View } from "react-native";

type ShowRecoveryPhraseScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.SHOW_RECOVERY_PHRASE_SCREEN
>;

interface KeyExtra {
  mnemonicPhrase: string;
}

const ShowRecoveryPhraseScreen: React.FC<ShowRecoveryPhraseScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const { getKeyFromKeyManager } = useAuthenticationStore();

  const handleShowRecoveryPhrase = async () => {
    try {
      setIsLoading(true);
      const key = await getKeyFromKeyManager(password);
      const keyExtra = key.extra as KeyExtra;

      if (keyExtra?.mnemonicPhrase) {
        navigation.navigate(SETTINGS_ROUTES.YOUR_RECOVERY_PHRASE_SCREEN, {
          recoveryPhrase: keyExtra.mnemonicPhrase,
        });
      }
    } catch (err) {
      setError(t("authStore.error.invalidPassword"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1">
        <View className="bg-background-tertiary rounded-xl mt-4 mb-6">
          <View className="p-4">
            <View className="mb-4">
              <Text secondary>{t("showRecoveryPhraseScreen.keepSafe")}</Text>
            </View>
            <View className="mb-6">
              <Text secondary>
                {t("showRecoveryPhraseScreen.accessWarning")}
              </Text>
            </View>

            <View className="flex flex-col gap-6">
              <View className="flex-row items-center gap-3">
                <Icon.Lock01 size={24} color={themeColors.lime[10]} />
                <View className="flex-1">
                  <Text sm color={themeColors.white}>
                    {t("showRecoveryPhraseScreen.yourRecoveryPhrase")}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-3">
                <Icon.EyeOff size={24} color={themeColors.lime[10]} />
                <View className="flex-1">
                  <Text sm color={themeColors.white}>
                    {t("showRecoveryPhraseScreen.dontShareWithAnyone")}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-3">
                <Icon.XSquare size={24} color={themeColors.lime[10]} />
                <View className="flex-1">
                  <Text sm color={themeColors.white}>
                    {t("showRecoveryPhraseScreen.neverAskForYourPhrase")}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View className="mb-6">
          <Input
            label={t("showRecoveryPhraseScreen.password")}
            placeholder={t("showRecoveryPhraseScreen.passwordInputPlaceholder")}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(undefined);
            }}
            secureTextEntry
            testID="password-input"
            error={error}
          />
        </View>

        <View className="flex-1" />

        <Button
          tertiary
          lg
          onPress={handleShowRecoveryPhrase}
          testID="show-recovery-phrase-button"
          isLoading={isLoading}
        >
          {t("showRecoveryPhraseScreen.showPhrase")}
        </Button>
      </View>
    </BaseLayout>
  );
};

export default ShowRecoveryPhraseScreen;
