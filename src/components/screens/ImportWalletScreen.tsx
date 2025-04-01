import Clipboard from "@react-native-clipboard/clipboard";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Textarea } from "components/sds/Textarea";
import { Text } from "components/sds/Typography";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState } from "react";

type ImportWalletScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.IMPORT_WALLET_SCREEN
>;

export const ImportWalletScreen: React.FC<ImportWalletScreenProps> = ({
  route,
}) => {
  const { password } = route.params;
  const { importWallet, error, isLoading } = useAuthenticationStore();
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const { t } = useAppTranslation();

  const handleContinue = () => {
    importWallet({
      mnemonicPhrase: recoveryPhrase,
      password,
    });
  };

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
      isLoading={isLoading}
    >
      <Textarea
        fieldSize="lg"
        placeholder={t("importWalletScreen.textAreaPlaceholder")}
        note={t("importWalletScreen.textAreaNote")}
        value={recoveryPhrase}
        onChangeText={setRecoveryPhrase}
      />
      {error && (
        <Text secondary md>
          {error}
        </Text>
      )}
    </OnboardLayout>
  );
};
