import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button, ButtonVariants } from "components/sds/Button";
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

const ShowRecoveryPhraseScreen: React.FC<ShowRecoveryPhraseScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const { signIn, getTemporaryStore } = useAuthenticationStore();

  const handleShowRecoveryPhrase = async () => {
    try {
      await signIn({ password });
      const store = await getTemporaryStore();
      if (store?.mnemonicPhrase) {
        navigation.navigate(SETTINGS_ROUTES.YOUR_RECOVERY_PHRASE_SCREEN, {
          recoveryPhrase: store.mnemonicPhrase,
        });
      }
    } catch (err) {
      setError(t("authStore.error.invalidPassword"));
    }
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1">
        <View className="bg-background-tertiary rounded-xl mt-4 mb-6">
          <View className="p-4">
            <View className="mb-4">
              <Text color={themeColors.text.secondary}>
                {t("showRecoveryPhraseScreen.keepSafe")}
              </Text>
            </View>
            <View className="mb-6">
              <Text color={themeColors.text.secondary}>
                {t("showRecoveryPhraseScreen.accessWarning")}
              </Text>
            </View>

            <View className="flex flex-col gap-6">
              <View className="flex-row items-center gap-3">
                <Icon.Lock01 size={24} color={themeColors.lime[10]} />
                <View className="flex-1">
                  <Text color={themeColors.white} sm>
                    {t("showRecoveryPhraseScreen.yourRecoveryPhrase")}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-3">
                <Icon.EyeOff size={24} color={themeColors.lime[10]} />
                <View className="flex-1">
                  <Text color={themeColors.white} sm>
                    {t("showRecoveryPhraseScreen.dontShareWithAnyone")}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-3">
                <Icon.XSquare size={24} color={themeColors.lime[10]} />
                <View className="flex-1">
                  <Text color={themeColors.white} sm>
                    {t("showRecoveryPhraseScreen.neverAskForYourPhrase")}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View className="mb-6">
          <View className="mb-2">
            <Text color={themeColors.foreground.primary}>
              {t("showRecoveryPhraseScreen.password")}
            </Text>
          </View>
          <Input
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
          variant={ButtonVariants.TERTIARY}
          size="lg"
          onPress={handleShowRecoveryPhrase}
          testID="show-recovery-phrase-button"
        >
          {t("showRecoveryPhraseScreen.showPhrase")}
        </Button>
      </View>
    </BaseLayout>
  );
};

export default ShowRecoveryPhraseScreen;
