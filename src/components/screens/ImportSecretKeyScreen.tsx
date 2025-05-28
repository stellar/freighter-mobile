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
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useState, useEffect } from "react";
import { View, TouchableOpacity } from "react-native";

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
      await importSecretKey(secretKey);
      navigation.goBack();
    } catch (err) {
      // Error from the store will be handled separately
    }
  };

  const isFormValid =
    secretKey.length > 0 && password.length > 0 && isAwareChecked;

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1 pt-5">
        <View>
          <Icon.Download01 themeColor="pink" size={24} withBackground />
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
                <TouchableOpacity
                  onPress={() => setShowSecretKey(!showSecretKey)}
                  activeOpacity={0.7}
                >
                  {showSecretKey ? (
                    <Icon.Eye
                      size={20}
                      color={themeColors.foreground.primary}
                    />
                  ) : (
                    <Icon.EyeOff
                      size={20}
                      color={themeColors.foreground.primary}
                    />
                  )}
                </TouchableOpacity>
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
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  {showPassword ? (
                    <Icon.Eye
                      size={20}
                      color={themeColors.foreground.primary}
                    />
                  ) : (
                    <Icon.EyeOff
                      size={20}
                      color={themeColors.foreground.primary}
                    />
                  )}
                </TouchableOpacity>
              }
            />
            <View className="mt-2">
              <Text md secondary>
                {t("importSecretKeyScreen.passwordNote")}
              </Text>
            </View>
          </View>

          <View className="mt-2 flex-row items-center">
            <TouchableOpacity
              onPress={() => setIsAwareChecked(!isAwareChecked)}
              activeOpacity={0.7}
            >
              <View
                className={`h-5 w-5 items-center justify-center rounded-sm ${
                  isAwareChecked
                    ? "bg-primary border-primary"
                    : "bg-transparent border border-gray-500"
                }`}
              >
                {isAwareChecked && (
                  <Icon.Check size={14} color={themeColors.base.secondary} />
                )}
              </View>
            </TouchableOpacity>
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
