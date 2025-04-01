import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useWordSelection } from "hooks/useWordSelection";
import React, { useCallback, useMemo, useState } from "react";

type ValidateRecoveryPhraseScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.VALIDATE_RECOVERY_PHRASE_SCREEN
>;

const DELAY_MS = 500;

export const ValidateRecoveryPhraseScreen: React.FC<
  ValidateRecoveryPhraseScreenProps
> = ({ route }) => {
  const { password, recoveryPhrase } = route.params;
  const [currentWord, setCurrentWord] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const isSigningUp = useAuthenticationStore((state) => state.isLoading);
  const [currentIndex, setCurrentIndex] = useState(0);

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

  const handleContinue = useCallback(() => {
    if (!canContinue) {
      setIsLoading(true);
      setTimeout(() => {
        setError(t("validateRecoveryPhraseScreen.errorText"));
        setIsLoading(false);
      }, DELAY_MS);
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      if (currentIndex < 2) {
        setCurrentIndex(currentIndex + 1);
        setCurrentWord("");
        setError(undefined);
      } else {
        signUp({
          password,
          mnemonicPhrase: recoveryPhrase,
        });
      }
      setIsLoading(false);
    }, DELAY_MS);
  }, [canContinue, currentIndex, password, recoveryPhrase, signUp, t]);

  const handleOnChangeText = useCallback((value: string) => {
    setCurrentWord(value.trim());
    setError(undefined);
  }, []);

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
