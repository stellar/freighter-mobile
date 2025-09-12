import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { BiometricToggleButton } from "components/sds/BiometricToggleButton";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { LoginType } from "config/constants";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useState } from "react";
import { View, ScrollView } from "react-native";

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
  const [localPassword, setLocalPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const { getKeyFromKeyManager, signInMethod } = useAuthenticationStore();

  const showRecoveryPhraseAction = async (password: string) => {
    try {
      const key = await getKeyFromKeyManager(password ?? localPassword);
      const keyExtra = key.extra as KeyExtra;

      if (keyExtra?.mnemonicPhrase) {
        navigation.navigate(SETTINGS_ROUTES.YOUR_RECOVERY_PHRASE_SCREEN, {
          recoveryPhrase: keyExtra.mnemonicPhrase,
        });
      } else {
        throw new Error(t("authStore.error.noKeyPairFound"));
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("authStore.error.invalidPassword"));
      }
      throw err; // Re-throw to be handled by the caller
    }
  };

  const handleShowRecoveryPhrase = async (...args: unknown[]) => {
    try {
      setIsLoading(true);
      setError(undefined);

      // Use the password from biometric authentication if available, otherwise use localPassword
      const password = args[0] as string | undefined;
      const passwordToUse = password ?? localPassword;

      if (!passwordToUse) {
        setError(t("authStore.error.invalidPassword"));
        return;
      }

      // Execute the recovery phrase logic with the password
      await showRecoveryPhraseAction(passwordToUse);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("authStore.error.invalidPassword"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BaseLayout
      useKeyboardAvoidingView
      useSafeArea
      insets={{ top: false, bottom: false }}
    >
      <View className="flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
                  <Icon.Lock01 color={themeColors.lime[10]} />
                  <View className="flex-1">
                    <Text sm color={themeColors.white}>
                      {t("showRecoveryPhraseScreen.yourRecoveryPhrase")}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-3">
                  <Icon.EyeOff color={themeColors.lime[10]} />
                  <View className="flex-1">
                    <Text sm color={themeColors.white}>
                      {t("showRecoveryPhraseScreen.dontShareWithAnyone")}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-3">
                  <Icon.XSquare color={themeColors.lime[10]} />
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
            {signInMethod === LoginType.PASSWORD && (
              <Input
                autoCapitalize="none"
                fieldSize="lg"
                label={t("showRecoveryPhraseScreen.password")}
                placeholder={t(
                  "showRecoveryPhraseScreen.passwordInputPlaceholder",
                )}
                value={localPassword}
                onChangeText={(text) => {
                  setLocalPassword(text);
                  setError(undefined);
                }}
                secureTextEntry
                testID="password-input"
                error={error}
              />
            )}
          </View>

          <Button
            biometric
            tertiary
            onPress={handleShowRecoveryPhrase}
            testID="show-recovery-phrase-button"
            isLoading={isLoading}
          >
            {t("showRecoveryPhraseScreen.showPhrase")}
          </Button>
          <View className="mt-4">
            <BiometricToggleButton size="sm" />
          </View>
          <View className="mb-10" />
        </ScrollView>
      </View>
    </BaseLayout>
  );
};

export default ShowRecoveryPhraseScreen;
