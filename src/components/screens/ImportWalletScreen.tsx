import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ImportRecoveryPhraseTemplate } from "components/templates/ImportRecoveryPhraseTemplate";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useLoginDataStore } from "ducks/loginData";
import { waitForKeyboardDismiss } from "helpers/keyboard";
import { normalizeAndTrimRecoveryPhrase } from "helpers/recoveryPhrase";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { TextInput } from "react-native";

type ImportWalletScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.IMPORT_WALLET_SCREEN
>;

/**
 * Import Wallet, the first step of importing a wallet: the recovery phrase,
 * then Set Password. Next checks the phrase and keeps it in memory for Set
 * Password, which finishes the import.
 *
 * Design: empty ?node-id=2091-40745, masked 2091-40994, shown 3514-104321
 * (light); colors from 2091-41871 (dark).
 */
export const ImportWalletScreen: React.FC<ImportWalletScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { error, clearError, verifyMnemonicPhrase } = useAuthenticationStore();
  const setMnemonicPhrase = useLoginDataStore(
    (state) => state.setMnemonicPhrase,
  );
  const [phrase, setPhrase] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Set from Next until the phrase fails its check or the screen has moved
  // on, so a second tap meanwhile doesn't check it or move on twice.
  const isSubmittingRef = useRef(false);

  // Raises the keyboard once the screen has slid in: raising it while the
  // screen still slides in glitches. Only on arrival; coming back from Set
  // Password leaves the keyboard down.
  useEffect(() => {
    const unsubscribe = navigation.addListener("transitionEnd", (event) => {
      if (event.data.closing) return;

      inputRef.current?.focus();
      unsubscribe();
    });

    return unsubscribe;
  }, [navigation]);

  // Every visit starts fresh. Coming back from Set Password clears the
  // phrase, its error and the copy kept in memory, ready for a new paste.
  useFocusEffect(
    useCallback(() => {
      setPhrase("");
      clearError();
      setMnemonicPhrase(null);
    }, [clearError, setMnemonicPhrase]),
  );

  const handleChangePhrase = useCallback(
    (text: string) => {
      setPhrase(text);
      // The error was about the phrase as it was; an edited one hasn't been
      // checked yet.
      if (error) clearError();
    },
    [clearError, error],
  );

  const handleNext = useCallback(() => {
    if (!phrase || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    // Typing word by word can leave a space after the last word, which the
    // masked field hides and which would fail the check.
    const normalizedPhrase = normalizeAndTrimRecoveryPhrase(phrase);

    // The keyboard goes first, so the button has settled at the bottom
    // before its spinner shows. Set Password then comes in with the keyboard
    // down; arriving while it's still up leaves the acknowledgement and the
    // button under it.
    waitForKeyboardDismiss().then(() => {
      setIsValidating(true);

      // Checking the phrase derives its seed synchronously and blocks the JS
      // thread for a moment, so let the button's spinner paint first.
      setTimeout(() => {
        const isValid = verifyMnemonicPhrase(normalizedPhrase);
        isSubmittingRef.current = false;
        setIsValidating(false);

        // An invalid phrase leaves the store's error under the field.
        if (!isValid) return;

        setMnemonicPhrase(normalizedPhrase);
        navigation.navigate(AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN, {
          isImporting: true,
        });
      }, 0);
    });
  }, [navigation, phrase, setMnemonicPhrase, verifyMnemonicPhrase]);

  return (
    <ImportRecoveryPhraseTemplate
      testID="import-wallet-input"
      title={t("importWalletScreen.title")}
      description={t("importWalletScreen.description")}
      placeholder={t("importWalletScreen.textAreaPlaceholder")}
      submitButtonText={t("onboarding.next")}
      phrase={phrase}
      onChangePhrase={handleChangePhrase}
      onSubmit={handleNext}
      error={error}
      isSubmitting={isValidating}
      inputRef={inputRef}
    />
  );
};
