import Clipboard from "@react-native-clipboard/clipboard";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Textarea } from "components/sds/Textarea";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import React, { useCallback, useEffect, useState } from "react";

type ImportWalletScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.IMPORT_WALLET_SCREEN
>;

export const ImportWalletScreen: React.FC<ImportWalletScreenProps> = ({
  route,
  navigation,
}) => {
  const { importWallet, error, clearError, verifyMnemonicPhrase } =
    useAuthenticationStore();
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const { isBiometricsSensorAvailable } = useBiometrics();
  const { t } = useAppTranslation();
  const [isImporting, setIsImporting] = useState(false);

  const { password } = route.params;

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleContinue = useCallback(() => {
    setIsImporting(true);

    setTimeout(() => {
      (async () => {
        if (isBiometricsSensorAvailable) {
          const isValidMnemonicPhrase = verifyMnemonicPhrase(recoveryPhrase);
          if (!isValidMnemonicPhrase) {
            setIsImporting(false);
            return;
          }
          // Navigate to biometrics onboarding screen
          navigation.navigate(AUTH_STACK_ROUTES.BIOMETRICS_ONBOARDING_SCREEN, {
            password,
            mnemonicPhrase: recoveryPhrase,
          });
        } else {
          // No biometrics available, proceed with normal import
          await importWallet({
            mnemonicPhrase: recoveryPhrase,
            password,
          });
        }
        setIsImporting(false);
      })();
    }, 0);
  }, [
    isBiometricsSensorAvailable,
    navigation,
    password,
    recoveryPhrase,
    verifyMnemonicPhrase,
    importWallet,
  ]);

  const onPressPasteFromClipboard = async () => {
    const clipboardText = await Clipboard.getString();
    setRecoveryPhrase(clipboardText);
  };

  return (
    <OnboardLayout
      icon={<Icon.Download01 circle />}
      title={t("importWalletScreen.title")}
      defaultActionButtonText={t("importWalletScreen.defaultActionButtonText")}
      onPressDefaultActionButton={handleContinue}
      isDefaultActionButtonDisabled={!recoveryPhrase}
      hasClipboardButton
      onPressClipboardButton={onPressPasteFromClipboard}
      isLoading={isImporting}
    >
      <Textarea
        fieldSize="lg"
        placeholder={t("importWalletScreen.textAreaPlaceholder")}
        note={t("importWalletScreen.textAreaNote")}
        value={recoveryPhrase}
        onChangeText={setRecoveryPhrase}
        error={error}
      />
    </OnboardLayout>
  );
};
