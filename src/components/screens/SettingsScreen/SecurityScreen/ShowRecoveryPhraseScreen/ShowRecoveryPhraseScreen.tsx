import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FOCUS_RING_WIDTH } from "components/FocusRing";
import { PasswordField } from "components/PasswordField";
import { BaseLayout } from "components/layout/BaseLayout";
import { BiometricToggleButton } from "components/sds/BiometricToggleButton";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { LoginType } from "config/constants";
import { logger } from "config/logger";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { getActiveMnemonicPhrase, useAuthenticationStore } from "ducks/auth";
import { useLoginDataStore } from "ducks/loginData";
import { hasRecoveryPhrase } from "helpers/hasRecoveryPhrase";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { getSecretSources } from "services/auth/secretSources";

type ShowRecoveryPhraseScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.SHOW_RECOVERY_PHRASE_SCREEN
>;

// A ScrollView clips what it holds, and the page's padding is outside this
// one, so the password field's focus ring would lose its sides. The scroll
// view reaches past the padding by the ring's width and pads its content by
// the same, which leaves the content where it was.
const styles = StyleSheet.create({
  scroll: { marginHorizontal: -FOCUS_RING_WIDTH },
  scrollContent: { paddingHorizontal: FOCUS_RING_WIDTH },
});

const ShowRecoveryPhraseScreen: React.FC<ShowRecoveryPhraseScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const [localPassword, setLocalPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const { getKeyFromKeyManager, signInMethod } = useAuthenticationStore();
  const { setMnemonicPhrase } = useLoginDataStore();

  // Security hides the way here for a wallet with no phrase (one onboarded
  // from a secret key); anything that still lands here goes back.
  useEffect(() => {
    let isActive = true;

    getSecretSources()
      .then((map) => {
        if (isActive && !hasRecoveryPhrase(Object.values(map))) {
          navigation.goBack();
        }
      })
      .catch((sourcesError: unknown) => {
        logger.error(
          "ShowRecoveryPhraseScreen",
          "Failed to read secret sources",
          sourcesError,
        );
      });

    return () => {
      isActive = false;
    };
  }, [navigation]);

  const showRecoveryPhraseAction = async (password: string) => {
    try {
      // Verifies the password against the active keystore, then shows the
      // phrase the session holds. The active keystore itself may carry none:
      // a secret-key import is stamped with no phrase.
      await getKeyFromKeyManager(password ?? localPassword);
      const mnemonicPhrase = await getActiveMnemonicPhrase();

      if (mnemonicPhrase) {
        setMnemonicPhrase(mnemonicPhrase);
        navigation.navigate(SETTINGS_ROUTES.YOUR_RECOVERY_PHRASE_SCREEN);
      } else {
        throw new Error(t("authStore.error.noRecoveryPhrase"));
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
          testID="show-recovery-phrase-scroll"
          className="flex-1"
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
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
                    <Text sm>
                      {t("showRecoveryPhraseScreen.yourRecoveryPhrase")}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-3">
                  <Icon.EyeOff color={themeColors.lime[10]} />
                  <View className="flex-1">
                    <Text sm>
                      {t("showRecoveryPhraseScreen.dontShareWithAnyone")}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-3">
                  <Icon.XSquare color={themeColors.lime[10]} />
                  <View className="flex-1">
                    <Text sm>
                      {t("showRecoveryPhraseScreen.neverAskForYourPhrase")}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View className="mb-6">
            {signInMethod === LoginType.PASSWORD && (
              <PasswordField
                testID="password-input"
                label={t("showRecoveryPhraseScreen.password")}
                placeholder={t(
                  "showRecoveryPhraseScreen.passwordInputPlaceholder",
                )}
                value={localPassword}
                onChangeText={(text) => {
                  setLocalPassword(text);
                  setError(undefined);
                }}
                error={error}
              />
            )}
          </View>

          <Button
            biometric
            secondary
            onPress={handleShowRecoveryPhrase}
            testID="show-recovery-phrase-button"
            isLoading={isLoading}
          >
            {t("showRecoveryPhraseScreen.showPhrase")}
          </Button>
          <View className="mt-4">
            <BiometricToggleButton size="xl" />
          </View>
          <View className="mb-10" />
        </ScrollView>
      </View>
    </BaseLayout>
  );
};

export default ShowRecoveryPhraseScreen;
