import Clipboard from "@react-native-clipboard/clipboard";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RecoveryPhraseInput } from "components/RecoveryPhraseInput";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { BiometricsSource } from "config/constants";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useLoginDataStore } from "ducks/loginData";
import { normalizeAndTrimRecoveryPhrase } from "helpers/recoveryPhrase";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import useColors from "hooks/useColors";
import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable } from "react-native";

type ImportWalletScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.IMPORT_WALLET_SCREEN
>;

export const ImportWalletScreen: React.FC<ImportWalletScreenProps> = ({
  navigation,
}) => {
  const { importWallet, error, clearError, verifyMnemonicPhrase } =
    useAuthenticationStore();
  const [localMnemonicPhrase, setLocalMnemonicPhrase] = useState("");
  const { setMnemonicPhrase, setPassword, clearLoginData } =
    useLoginDataStore();
  const { biometryType } = useBiometrics();
  const { storeBiometricPassword } = useAuthenticationStore();
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const [isImporting, setIsImporting] = useState(false);
  const [showMasked, setShowMasked] = useState(true);

  const { password } = useLoginDataStore();

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleContinue = useCallback(() => {
    setIsImporting(true);

    setTimeout(() => {
      (async () => {
        const isValidMnemonicPhrase = verifyMnemonicPhrase(localMnemonicPhrase);
        if (!isValidMnemonicPhrase) {
          setIsImporting(false);
          return;
        }

        setMnemonicPhrase(localMnemonicPhrase);
        setPassword(password);

        if (biometryType) {
          storeBiometricPassword(password!).then(() => {
            navigation.navigate(AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN, {
              source: BiometricsSource.IMPORT_WALLET,
            });
          });
        } else {
          // No biometrics available, proceed with normal import
          await importWallet({
            mnemonicPhrase: localMnemonicPhrase,
            password: password!,
          });
          clearLoginData(); // Clear sensitive data after successful import
        }
        setIsImporting(false);
      })();
    }, 0);
  }, [
    navigation,
    password,
    localMnemonicPhrase,
    verifyMnemonicPhrase,
    importWallet,
    biometryType,
    storeBiometricPassword,
    setMnemonicPhrase,
    setPassword,
    clearLoginData,
  ]);

  const onPressPasteFromClipboard = async () => {
    const clipboardText = await Clipboard.getString();
    setLocalMnemonicPhrase(normalizeAndTrimRecoveryPhrase(clipboardText));
  };

  const handleToggleMasked = useCallback(() => {
    setShowMasked((prev) => !prev);
  }, []);

  const IconComponent = showMasked ? Icon.Eye : Icon.EyeOff;
  const pressableNote = (
    <Pressable onPress={handleToggleMasked} className="flex-row items-center">
      <IconComponent size={20} themeColor="gray" />
      <View className="ml-2">
        <Text sm color={themeColors.foreground.primary}>
          {t("importWalletScreen.textAreaNote")}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <OnboardLayout
      icon={
        <Icon.Download01
          circle
          circleBackground={themeColors.lilac[3]}
          circleBorder={themeColors.lilac[6]}
        />
      }
      title={t("importWalletScreen.title")}
      defaultActionButtonText={t("importWalletScreen.defaultActionButtonText")}
      onPressDefaultActionButton={handleContinue}
      isDefaultActionButtonDisabled={!localMnemonicPhrase}
      hasClipboardButton
      onPressClipboardButton={onPressPasteFromClipboard}
      isLoading={isImporting}
    >
      <RecoveryPhraseInput
        fieldSize="lg"
        placeholder={t("importWalletScreen.textAreaPlaceholder")}
        note={pressableNote}
        value={localMnemonicPhrase}
        setValue={setLocalMnemonicPhrase}
        error={error}
        showMasked={showMasked}
        testID="import-wallet-input"
      />
    </OnboardLayout>
  );
};
