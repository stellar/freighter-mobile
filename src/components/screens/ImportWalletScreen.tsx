import Clipboard from "@react-native-clipboard/clipboard";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Textarea } from "components/sds/Textarea";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState } from "react";

type ImportWalletScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.IMPORT_WALLET_SCREEN
>;

export const ImportWalletScreen: React.FC<ImportWalletScreenProps> = ({
  navigation,
}) => {
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const { t } = useAppTranslation();

  const handleContinue = () => {
    // TODO: Navigate to the next screen after authentication is implemented
    navigation.replace(AUTH_STACK_ROUTES.WELCOME_SCREEN);
  };

  const onPressPasteFromClipboard = async () => {
    const clipboardText = await Clipboard.getString();
    setRecoveryPhrase(clipboardText);
  };

  const canContinue = !!recoveryPhrase;

  return (
    <OnboardLayout
      icon={<Icon.Download01 circle />}
      title={t("importWalletScreen.title")}
      isDefaultActionButtonDisabled={!canContinue}
      defaultActionButtonText={t("importWalletScreen.defaultActionButtonText")}
      onPressDefaultActionButton={handleContinue}
      hasClipboardButton
      onPressClipboardButton={onPressPasteFromClipboard}
    >
      <Textarea
        fieldSize="lg"
        placeholder={t("importWalletScreen.textAreaPlaceholder")}
        note={t("importWalletScreen.textAreaNote")}
        value={recoveryPhrase}
        onChangeText={setRecoveryPhrase}
      />
    </OnboardLayout>
  );
};
