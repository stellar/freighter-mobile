import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ImportRecoveryPhraseTemplate } from "components/templates/ImportRecoveryPhraseTemplate";
import {
  MANAGE_WALLETS_ROUTES,
  ManageWalletsStackParamList,
} from "config/routes";
import {
  clearPendingRecoveryPhrase,
  holdPendingRecoveryPhrase,
} from "ducks/auth";
import { waitForKeyboardDismiss } from "helpers/keyboard";
import {
  isValidImportMnemonic,
  normalizeAndTrimRecoveryPhrase,
} from "helpers/recoveryPhrase";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { TextInput } from "react-native";

type ImportRecoveryPhraseScreenProps = NativeStackScreenProps<
  ManageWalletsStackParamList,
  typeof MANAGE_WALLETS_ROUTES.IMPORT_RECOVERY_PHRASE_SCREEN
>;

/**
 * Import Recovery Phrase, from Add wallet: the phrase, then the password
 * step. Unlike onboarding's Import Wallet, this adds the phrase to the
 * wallet as a new source instead of replacing the wallet.
 *
 * Next checks the phrase and hands it to the auth store, which holds it for
 * the password step; the route carries only the hold's id. The hold is
 * dropped when this screen goes away.
 */
const ImportRecoveryPhraseScreen: React.FC<ImportRecoveryPhraseScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const heldPhraseIdRef = useRef<string | null>(null);
  // Set from Next until the screen has moved on, so a second tap meanwhile
  // doesn't hold the phrase or navigate twice.
  const isSubmittingRef = useRef(false);

  // Raises the keyboard once the screen has slid in: raising it while the
  // screen still slides in glitches. Only on arrival.
  useEffect(() => {
    const unsubscribe = navigation.addListener("transitionEnd", (event) => {
      if (event.data.closing) return;

      inputRef.current?.focus();
      unsubscribe();
    });

    return unsubscribe;
  }, [navigation]);

  // Leaving the flow drops the held phrase. Only this screen's hold, so a
  // newer one is left alone.
  useEffect(
    () => () => {
      if (heldPhraseIdRef.current) {
        clearPendingRecoveryPhrase(heldPhraseIdRef.current);
      }
    },
    [],
  );

  const handleChangePhrase = useCallback((text: string) => {
    setPhrase(text);
    // The error was about the phrase as it was.
    setError(null);
  }, []);

  const handleNext = useCallback(() => {
    if (!phrase || isSubmittingRef.current) return;

    // Typing word by word can leave a space after the last word, which the
    // masked field hides and which would fail the check.
    const normalizedPhrase = normalizeAndTrimRecoveryPhrase(phrase);
    if (!isValidImportMnemonic(normalizedPhrase)) {
      setError(t("authStore.error.invalidMnemonicPhrase"));
      return;
    }

    isSubmittingRef.current = true;
    heldPhraseIdRef.current = holdPendingRecoveryPhrase(normalizedPhrase);
    const pendingPhraseId = heldPhraseIdRef.current;

    // The keyboard goes first, so the password step comes in with it down.
    waitForKeyboardDismiss().then(() => {
      isSubmittingRef.current = false;
      navigation.navigate(MANAGE_WALLETS_ROUTES.VERIFY_PASSWORD_SCREEN, {
        kind: "importPhrase",
        pendingPhraseId,
      });
    });
  }, [navigation, phrase, t]);

  return (
    <ImportRecoveryPhraseTemplate
      testID="import-recovery-phrase-input"
      title={t("importRecoveryPhraseScreen.title")}
      description={t("importRecoveryPhraseScreen.description")}
      placeholder={t("importRecoveryPhraseScreen.textAreaPlaceholder")}
      submitButtonText={t("importRecoveryPhraseScreen.importButton")}
      phrase={phrase}
      onChangePhrase={handleChangePhrase}
      onSubmit={handleNext}
      error={error}
      inputRef={inputRef}
    />
  );
};

export default ImportRecoveryPhraseScreen;
