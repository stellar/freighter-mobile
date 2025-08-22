import Clipboard from "@react-native-clipboard/clipboard";
import { useNavigation } from "@react-navigation/native";
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Textarea } from "components/sds/Textarea";
import {
  AUTH_STACK_ROUTES,
  AuthStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useFaceId } from "hooks/useFaceId";
import React, { useEffect, useState } from "react";

type ImportWalletScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.IMPORT_WALLET_SCREEN
>;

export const ImportWalletScreen: React.FC<ImportWalletScreenProps> = ({
  route,
}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { importWallet, error, clearError, hasSeenFaceIdOnboarding } =
    useAuthenticationStore();
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const { isFaceIdAvailable } = useFaceId();
  const { t } = useAppTranslation();
  const [isImporting, setIsImporting] = useState(false);

  const { password } = route.params;

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleContinue = () => {
    setIsImporting(true);

    setTimeout(() => {
      (async () => {
        const success = await importWallet({
          mnemonicPhrase: recoveryPhrase,
          password,
        });
        const shouldNavigateToFaceIdOnboarding =
          success && !hasSeenFaceIdOnboarding && isFaceIdAvailable;
        if (shouldNavigateToFaceIdOnboarding) {
          navigation.navigate(ROOT_NAVIGATOR_ROUTES.FACE_ID_ONBOARDING_SCREEN, {
            password,
          });
        } else if (success) {
          navigation.navigate(ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK);
        }
        setIsImporting(false);
      })();
    }, 0);
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
