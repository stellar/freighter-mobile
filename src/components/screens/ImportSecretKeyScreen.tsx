import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StrKey } from "@stellar/stellar-sdk";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text, Display } from "components/sds/Typography";
import {
  MANAGE_WALLETS_ROUTES,
  ManageWalletsStackParamList,
  ROOT_NAVIGATOR_ROUTES,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useState, useEffect } from "react";
import { Pressable, View } from "react-native";

type ImportSecretKeyScreenProps = NativeStackScreenProps<
  ManageWalletsStackParamList,
  typeof MANAGE_WALLETS_ROUTES.IMPORT_SECRET_KEY_SCREEN
>;

const ImportSecretKeyScreen: React.FC<ImportSecretKeyScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const [secretKey, setSecretKey] = useState("");
  const [password, setPassword] = useState("");
  const [isAwareChecked, setIsAwareChecked] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
            <Input
              value={secretKey}
              onChangeText={setSecretKey}
              secureTextEntry={!showSecretKey}
              isPassword
              fieldSize="lg"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t("importSecretKeyScreen.secretKeyPlaceholder")}
              rightElement={
                showSecretKey ? (
                  <Icon.Eye
                    size={20}
                    color={themeColors.foreground.primary}
                    onPress={() => setShowSecretKey(false)}
                  />
                ) : (
                  <Icon.EyeOff
                    size={20}
                    color={themeColors.foreground.primary}
                    onPress={() => setShowSecretKey(true)}
                  />
                )
              }
            />
            {validationError && (
              <Text sm color={themeColors.status.error} className="mt-1">
                {t("importSecretKeyScreen.invalidSecretKey")}
              </Text>
            )}
          </View>

          <View className="mt-3">
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              isPassword
              fieldSize="lg"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t("importSecretKeyScreen.passwordPlaceholder")}
              rightElement={
                showPassword ? (
                  <Icon.Eye
                    size={20}
                    color={themeColors.foreground.primary}
                    onPress={() => setShowPassword(false)}
                  />
                ) : (
                  <Icon.EyeOff
                    size={20}
                    color={themeColors.foreground.primary}
                    onPress={() => setShowPassword(true)}
                  />
                )
              }
            />
            <View className="mt-2">
              <Text md>{t("importSecretKeyScreen.passwordNote")}</Text>
            </View>
          </View>

          <View className="mt-2 flex-row items-center">
            <Pressable onPress={() => setIsAwareChecked(!isAwareChecked)}>
              <View
                className={`h-5 w-5 items-center justify-center rounded-sm ${isAwareChecked ? "bg-primary" : "bg-transparent"}`}
              >
                {isAwareChecked ? (
                  <Icon.Check size={15} color={themeColors.white} />
                ) : (
                  <Icon.Square
                    size={21}
                    color={themeColors.foreground.secondary}
                  />
                )}
              </View>
            </Pressable>
            <View className="flex-1 ml-2 pt-5">
              <Text sm className="leading-5 text-white">
                {t("importSecretKeyScreen.responsibilityNote")}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-1" />

        <View className="pb-4 mt-6">
          <Button
            lg
            tertiary
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
