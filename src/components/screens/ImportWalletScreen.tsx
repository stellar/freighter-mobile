import Clipboard from "@react-native-clipboard/clipboard";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RecoveryPhraseInput } from "components/RecoveryPhraseInput";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { BiometricsSource } from "config/constants";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { pxValue } from "helpers/dimensions";
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
  route,
  navigation,
}) => {
  const { importWallet, error, clearError, verifyMnemonicPhrase } =
    useAuthenticationStore();
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const { biometryType } = useBiometrics();
  const { storeBiometricPassword } = useAuthenticationStore();
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const [isImporting, setIsImporting] = useState(false);
  const [showMasked, setShowMasked] = useState(true);

  const { password } = route.params;

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleContinue = useCallback(() => {
    setIsImporting(true);

    setTimeout(() => {
      (async () => {
        if (biometryType) {
          const isValidMnemonicPhrase = verifyMnemonicPhrase(recoveryPhrase);
          if (!isValidMnemonicPhrase) {
            setIsImporting(false);
            return;
          }
          storeBiometricPassword(password).then(() => {
            navigation.navigate(AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN, {
              password,
              mnemonicPhrase: recoveryPhrase,
              source: BiometricsSource.IMPORT_WALLET,
            });
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
    navigation,
    password,
    recoveryPhrase,
    verifyMnemonicPhrase,
    importWallet,
    biometryType,
    storeBiometricPassword,
  ]);

  const onPressPasteFromClipboard = async () => {
    const clipboardText = await Clipboard.getString();
    setRecoveryPhrase(normalizeAndTrimRecoveryPhrase(clipboardText));
  };

  const handleToggleMasked = useCallback(() => {
    setShowMasked((prev) => !prev);
  }, []);

  const IconComponent = showMasked ? Icon.EyeOff : Icon.Eye;
  const pressableNote = (
    <Pressable onPress={handleToggleMasked} className="flex-row items-center">
      <IconComponent
        size={pxValue(20)}
        color={themeColors.foreground.primary}
      />
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
      isDefaultActionButtonDisabled={!recoveryPhrase}
      hasClipboardButton
      onPressClipboardButton={onPressPasteFromClipboard}
      isLoading={isImporting}
    >
      <RecoveryPhraseInput
        fieldSize="lg"
        placeholder={t("importWalletScreen.textAreaPlaceholder")}
        note={pressableNote}
        value={recoveryPhrase}
        setValue={setRecoveryPhrase}
        error={error}
        showMasked={showMasked}
      />
    </OnboardLayout>
  );
};
