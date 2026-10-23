import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StrKey } from "@stellar/stellar-sdk";
import { PasswordField } from "components/PasswordField";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Checkbox } from "components/sds/Checkbox";
import Icon from "components/sds/Icon";
import { Text, Display } from "components/sds/Typography";
import {
  MANAGE_WALLETS_ROUTES,
  ManageWalletsStackParamList,
  ROOT_NAVIGATOR_ROUTES,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState, useEffect } from "react";
import { View } from "react-native";

type ImportSecretKeyScreenProps = NativeStackScreenProps<
  ManageWalletsStackParamList,
  typeof MANAGE_WALLETS_ROUTES.IMPORT_SECRET_KEY_SCREEN
>;

const ImportSecretKeyScreen: React.FC<ImportSecretKeyScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const [secretKey, setSecretKey] = useState("");
  const [password, setPassword] = useState("");
  const [isAwareChecked, setIsAwareChecked] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { importSecretKey, isLoading, clearError } = useAuthenticationStore();

  // Clear errors when unmounting
  useEffect(
    () => () => {
      clearError();
      setValidationError(null);
    },
    [clearError],
  );

  // Clear validation error when secret key changes
  useEffect(() => {
    setValidationError(null);
  }, [secretKey]);

  const handleImport = async () => {
    if (!StrKey.isValidEd25519SecretSeed(secretKey)) {
      setValidationError(t("importSecretKeyScreen.invalidSecretKey"));
      return;
    }

    try {
      await importSecretKey({ secretKey, password });

      navigation.reset({
        index: 0,
        // @ts-expect-error: This is a valid route.
        routes: [{ name: ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK }],
      });
    } catch (err) {
      // Error handling is managed by the auth store
    }
  };

  const isFormValid =
    secretKey.length > 0 && password.length > 0 && isAwareChecked;

  return (
    <BaseLayout useKeyboardAvoidingView insets={{ top: false }}>
      <View className="flex-1 pt-5">
        <View>
          <Icon.Download01 themeColor="pink" withBackground />
          <View className="mt-6 mb-6">
            <Display sm primary medium>
              {t("importSecretKeyScreen.title")}
            </Display>
          </View>
        </View>

        <View className="space-y-4">
          <View>
            <PasswordField
              testID="secret-key-input"
              value={secretKey}
              onChangeText={setSecretKey}
              placeholder={t("importSecretKeyScreen.secretKeyPlaceholder")}
              visibilityLabels={{
                show: t("importSecretKeyScreen.showSecretKey"),
                hide: t("importSecretKeyScreen.hideSecretKey"),
              }}
              error={validationError}
            />
          </View>

          <View className="mt-3">
            <PasswordField
              testID="secret-key-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder={t("importSecretKeyScreen.passwordPlaceholder")}
            />
            <View className="mt-2">
              <Text md secondary>
                {t("importSecretKeyScreen.passwordNote")}
              </Text>
            </View>
          </View>

          <View className="mt-2">
            <Checkbox
              testID="import-secret-key-aware-checkbox"
              checked={isAwareChecked}
              onChange={setIsAwareChecked}
              label={t("importSecretKeyScreen.responsibilityNote")}
            />
          </View>
        </View>

        <View className="flex-1" />

        <View className="pb-4 mt-6">
          <Button
            secondary
            disabled={!isFormValid}
            onPress={handleImport}
            isLoading={isLoading}
          >
            {t("importSecretKeyScreen.importButton")}
          </Button>
        </View>
      </View>
    </BaseLayout>
  );
};

export default ImportSecretKeyScreen;
