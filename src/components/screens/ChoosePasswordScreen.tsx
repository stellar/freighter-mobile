import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PasswordField } from "components/PasswordField";
import { OnboardLayout } from "components/layout/OnboardLayout";
import { Checkbox } from "components/sds/Checkbox";
import { BiometricsSource, PASSWORD_MAX_LENGTH } from "config/constants";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useLoginDataStore } from "ducks/loginData";
import { waitForKeyboardDismiss } from "helpers/keyboard";
import { isValidPasswordLength } from "helpers/passwordValidation";
import useAppTranslation from "hooks/useAppTranslation";
import { useFinishWalletSetup } from "hooks/useFinishWalletSetup";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, TextInput, View } from "react-native";

type ChoosePasswordScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN
>;

/**
 * Set Password: the first step of creating a wallet and the second of
 * importing one. The password is typed twice on this one screen, which
 * focuses the first field once it has slid in; the keyboard's return key
 * moves on to the confirmation. Next stays disabled until both are filled in, match and show
 * no error.
 *
 * Creating, the screen slides up with an X back to Welcome
 * (getSetPasswordScreenOptions), and Next keeps the password in memory and
 * opens the recovery phrase. Importing, it slides in with a back arrow to
 * Import Wallet, and the button says "Import wallet" throughout. The user
 * also acknowledges that an imported phrase can't be recovered, and the
 * button stays disabled until they have; then it finishes the setup with the
 * phrase Import Wallet kept in memory.
 *
 * Design: create ?node-id=370-8343, import ?node-id=2091-40291 (light);
 * colors from 760-36962 and 2091-41902 (dark).
 */
export const ChoosePasswordScreen: React.FC<ChoosePasswordScreenProps> = ({
  navigation,
  route,
}) => {
  const isImporting = route.params?.isImporting ?? false;
  const { t } = useAppTranslation();
  const setStoredPassword = useLoginDataStore((state) => state.setPassword);
  const isFinishing = useAuthenticationStore((state) => state.isLoading);
  const finishWalletSetup = useFinishWalletSetup();
  const passwordRef = useRef<TextInput>(null);
  const confirmationRef = useRef<TextInput>(null);
  // Set while the screen waits for the keyboard to hide before moving on, so
  // a second tap meanwhile doesn't move on twice.
  const isLeavingRef = useRef(false);

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  const passwordError =
    password.length > PASSWORD_MAX_LENGTH
      ? t("choosePasswordScreen.passwordTooLong")
      : null;
  // Only once the confirmation is as long as the password, or longer, when
  // it can no longer match. A shorter one may still be on its way, and an
  // error while the user is still typing would just be noise.
  const mismatchError =
    confirmation.length > 0 &&
    confirmation.length >= password.length &&
    confirmation !== password
      ? t("choosePasswordScreen.passwordsDontMatch")
      : null;
  const doPasswordsMatch =
    isValidPasswordLength(password) && confirmation === password;
  const canContinue = doPasswordsMatch && (!isImporting || hasAcknowledged);

  // Raises the keyboard once the screen has slid in: raising it while the
  // screen still slides in looks rushed. Only on arrival; coming back from
  // Recovery Phrase leaves the keyboard down.
  useEffect(() => {
    const unsubscribe = navigation.addListener("transitionEnd", (event) => {
      if (event.data.closing) return;

      passwordRef.current?.focus();
      unsubscribe();
    });

    return unsubscribe;
  }, [navigation]);

  const moveToConfirmation = useCallback(() => {
    confirmationRef.current?.focus();
  }, []);

  // Ticking the acknowledgement means the typing is done, so the keyboard
  // goes and Import wallet returns to the bottom of the screen.
  const handleAcknowledgeChange = useCallback((checked: boolean) => {
    setHasAcknowledged(checked);
    Keyboard.dismiss();
  }, []);

  const moveOn = useCallback(() => {
    if (!isImporting) {
      navigation.navigate(AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN);
      return;
    }

    // Import Wallet keeps the phrase in memory before opening this screen.
    // Without it there is nothing to import, so ask for it again.
    if (!useLoginDataStore.getState().mnemonicPhrase) {
      navigation.goBack();
      return;
    }

    finishWalletSetup(BiometricsSource.IMPORT_WALLET);
  }, [finishWalletSetup, isImporting, navigation]);

  const handleContinue = useCallback(() => {
    if (!canContinue || isLeavingRef.current) return;

    setStoredPassword(password);
    isLeavingRef.current = true;
    // The next screen comes in once the keyboard is down, rather than while
    // it's still sliding away.
    waitForKeyboardDismiss().then(() => {
      isLeavingRef.current = false;
      moveOn();
    });
  }, [canContinue, moveOn, password, setStoredPassword]);

  return (
    <OnboardLayout
      title={t("choosePasswordScreen.title")}
      description={t("choosePasswordScreen.description")}
      defaultActionButtonText={
        isImporting
          ? t("choosePasswordScreen.importWalletButtonText")
          : t("onboarding.next")
      }
      isDefaultActionButtonDisabled={!canContinue}
      onPressDefaultActionButton={handleContinue}
      isLoading={isImporting && isFinishing}
    >
      {/* Grows rather than flexes, so it keeps its full height and a small
          screen with the keyboard up scrolls to the acknowledgement. */}
      <View testID="set-password-form" className="grow">
        {/* 20pt under the fields, so with the keyboard up on a small screen
            the button never touches the confirmation. */}
        <View testID="set-password-fields" className="gap-[12px] pb-[20px]">
          <PasswordField
            ref={passwordRef}
            testID="password-input"
            value={password}
            onChangeText={setPassword}
            placeholder={t("choosePasswordScreen.passwordInputPlaceholder")}
            note={t("passwordInput.passwordNote")}
            error={passwordError}
            returnKeyType="next"
            // Keeps the keyboard up while focus moves to the confirmation.
            submitBehavior="submit"
            onSubmitEditing={moveToConfirmation}
          />
          <PasswordField
            ref={confirmationRef}
            testID="confirm-password-input"
            value={confirmation}
            onChangeText={setConfirmation}
            placeholder={t(
              "choosePasswordScreen.confirmPasswordInputPlaceholder",
            )}
            error={mismatchError}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
        </View>
        {isImporting && (
          // Figma keeps the acknowledgement just above the button, 20pt
          // under the fields (their own padding). 16pt above the button
          // keeps the whole button above the keyboard on a 6.3" iPhone.
          <View testID="import-acknowledgement" className="mt-auto pb-[16px]">
            <Checkbox
              testID="import-acknowledgement-checkbox"
              checked={hasAcknowledged}
              onChange={handleAcknowledgeChange}
              label={t("choosePasswordScreen.importAcknowledgement")}
            />
          </View>
        )}
      </View>
    </OnboardLayout>
  );
};
