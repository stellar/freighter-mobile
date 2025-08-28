/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { AnalyticsEvent } from "config/analyticsConfig";
import { VISUAL_DELAY_MS } from "config/constants";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import { useWordSelection } from "hooks/useWordSelection";
import React, { useCallback, useMemo, useState, useLayoutEffect } from "react";
import { analytics } from "services/analytics";

type ValidateRecoveryPhraseScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.VALIDATE_RECOVERY_PHRASE_SCREEN
>;

export const ValidateRecoveryPhraseScreen: React.FC<
  ValidateRecoveryPhraseScreenProps
> = ({ route, navigation }) => {
  const { password, recoveryPhrase } = route.params;
  const [currentWord, setCurrentWord] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const isSigningUp = useAuthenticationStore((state) => state.isLoading);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { isBiometricsSensorAvailable } = useBiometrics();
  const { signUp } = useAuthenticationStore();
  const { t } = useAppTranslation();

  const { words, selectedIndexes } = useWordSelection(recoveryPhrase);
  const currentWordIndex = selectedIndexes[currentIndex];
  const canContinue = useMemo(
    () =>
      currentWord.trim().toLowerCase() ===
      words[currentWordIndex].toLowerCase(),
    [currentWord, currentWordIndex, words],
  );

  const handleFinishSignUp = useCallback(() => {
    if (isBiometricsSensorAvailable) {
      // Navigate to biometrics onboarding screen
      navigation.navigate(AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN, {
        password,
        mnemonicPhrase: recoveryPhrase,
      });
    } else {
      // No biometrics available, proceed with normal signup
      signUp({
        password,
        mnemonicPhrase: recoveryPhrase,
      });

      analytics.track(AnalyticsEvent.CONFIRM_RECOVERY_PHRASE_SUCCESS);
      analytics.track(AnalyticsEvent.ACCOUNT_CREATOR_FINISHED);
    }
    setIsLoading(false);
  }, [
    password,
    recoveryPhrase,
    signUp,
    isBiometricsSensorAvailable,
    navigation,
  ]);

  const handleContinue = useCallback(() => {
    if (!canContinue) {
      setIsLoading(true);

      analytics.track(AnalyticsEvent.CONFIRM_RECOVERY_PHRASE_FAIL);

      setTimeout(() => {
        setError(t("validateRecoveryPhraseScreen.errorText"));
        setIsLoading(false);
      }, VISUAL_DELAY_MS);

      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      if (currentIndex < 2) {
        setCurrentIndex(currentIndex + 1);
        setCurrentWord("");
        setError(undefined);
        setIsLoading(false);
        return;
      }

      handleFinishSignUp();
    }, VISUAL_DELAY_MS);
  }, [canContinue, currentIndex, handleFinishSignUp, t]);
  const handleOnChangeText = useCallback((value: string) => {
    setCurrentWord(value.trim());
    setError(undefined);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <CustomHeaderButton
          position="left"
          onPress={() => {
            analytics.track(
              AnalyticsEvent.ACCOUNT_CREATOR_CONFIRM_MNEMONIC_BACK,
            );

            navigation.goBack();
          }}
        />
      ),
    });
  }, [navigation]);

  return (
    <OnboardLayout
      icon={<Icon.Passcode circle />}
      title={t("validateRecoveryPhraseScreen.title", {
        number: currentWordIndex + 1,
      })}
      isDefaultActionButtonDisabled={!currentWord || isLoading || isSigningUp}
      defaultActionButtonText={t(
        "validateRecoveryPhraseScreen.defaultActionButtonText",
      )}
      onPressDefaultActionButton={handleContinue}
      isLoading={isLoading || isSigningUp}
    >
      <Input
        autoCapitalize="none"
        isPassword
        placeholder={t("validateRecoveryPhraseScreen.inputPlaceholder")}
        fieldSize="lg"
        value={currentWord}
        onChangeText={handleOnChangeText}
        error={error}
      />
    </OnboardLayout>
  );
};
