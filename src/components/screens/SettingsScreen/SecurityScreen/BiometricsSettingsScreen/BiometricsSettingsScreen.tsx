import { NativeStackScreenProps } from "@react-navigation/native-stack";
import ConfirmationModal from "components/ConfirmationModal";
import { List } from "components/List";
import Modal from "components/Modal";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import { Toggle } from "components/sds/Toggle";
import { Text } from "components/sds/Typography";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import useColors from "hooks/useColors";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { BIOMETRY_TYPE } from "react-native-keychain";

interface BiometricsSettingsScreenProps
  extends NativeStackScreenProps<
    SettingsStackParamList,
    typeof SETTINGS_ROUTES.BIOMETRICS_SETTINGS_SCREEN
  > {}

interface BiometricsItem {
  title: string;
  titleColor: string;
  description: string;
  trailingContent: React.ReactNode;
  testID: string;
}

const BiometricsSettingsScreen: React.FC<
  BiometricsSettingsScreenProps
> = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const {
    isBiometricsEnabled,
    enableBiometrics,
    disableBiometrics,
    biometryType,
  } = useBiometrics();
  const { getKeyFromKeyManager, storeBiometricPassword } =
    useAuthenticationStore();
  const [shouldTriggerBiometricsDisable, setShouldTriggerBiometricsDisable] =
    useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [reEnableModalVisible, setReEnableModalVisible] = useState(false);
  const [reEnablePassword, setReEnablePassword] = useState("");
  const [reEnableError, setReEnableError] = useState<string | undefined>();
  const [isReEnabling, setIsReEnabling] = useState(false);

  const closeReEnableModal = useCallback(() => {
    setReEnableModalVisible(false);
    setReEnablePassword("");
    setReEnableError(undefined);
  }, []);

  const handleBiometricsEnable = useCallback(async () => {
    const success = await enableBiometrics();
    if (!success) {
      setReEnableModalVisible(true);
    }
  }, [enableBiometrics]);

  const handleReEnableWithPassword = useCallback(async () => {
    if (!reEnablePassword) return;
    setIsReEnabling(true);
    setReEnableError(undefined);
    try {
      await getKeyFromKeyManager(reEnablePassword);
      await storeBiometricPassword(reEnablePassword);
      await enableBiometrics();
      closeReEnableModal();
    } catch (err) {
      setReEnableError(
        err instanceof Error
          ? err.message
          : t("authStore.error.invalidPassword"),
      );
    } finally {
      setIsReEnabling(false);
    }
  }, [
    reEnablePassword,
    getKeyFromKeyManager,
    storeBiometricPassword,
    enableBiometrics,
    closeReEnableModal,
    t,
  ]);

  useEffect(() => {
    if (shouldTriggerBiometricsDisable) {
      setShouldTriggerBiometricsDisable(false);
      disableBiometrics();
    }
  }, [shouldTriggerBiometricsDisable, disableBiometrics]);

  const disableAlertTitle: Record<BIOMETRY_TYPE, string> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t("securityScreen.faceId.disableAlertTitle"),
      [BIOMETRY_TYPE.FINGERPRINT]: t(
        "securityScreen.fingerprint.disableAlertTitle",
      ),
      [BIOMETRY_TYPE.TOUCH_ID]: t("securityScreen.touchId.disableAlertTitle"),
      [BIOMETRY_TYPE.FACE]: t(
        "securityScreen.faceBiometrics.disableAlertTitle",
      ),
      [BIOMETRY_TYPE.OPTIC_ID]: t("securityScreen.opticId.disableAlertTitle"),
      [BIOMETRY_TYPE.IRIS]: t("securityScreen.iris.disableAlertTitle"),
    }),
    [t],
  );

  const disableAlertMessage: Record<BIOMETRY_TYPE, string> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t("securityScreen.faceId.disableAlertMessage"),
      [BIOMETRY_TYPE.FINGERPRINT]: t(
        "securityScreen.fingerprint.disableAlertMessage",
      ),
      [BIOMETRY_TYPE.TOUCH_ID]: t("securityScreen.touchId.disableAlertMessage"),
      [BIOMETRY_TYPE.FACE]: t(
        "securityScreen.faceBiometrics.disableAlertMessage",
      ),
      [BIOMETRY_TYPE.OPTIC_ID]: t("securityScreen.opticId.disableAlertMessage"),
      [BIOMETRY_TYPE.IRIS]: t("securityScreen.iris.disableAlertMessage"),
    }),
    [t],
  );

  const biometryToggleTitle: Record<BIOMETRY_TYPE, string> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t("securityScreen.faceId.toggleTitle"),
      [BIOMETRY_TYPE.FINGERPRINT]: t("securityScreen.fingerprint.toggleTitle"),
      [BIOMETRY_TYPE.TOUCH_ID]: t("securityScreen.touchId.toggleTitle"),
      [BIOMETRY_TYPE.FACE]: t("securityScreen.faceBiometrics.toggleTitle"),
      [BIOMETRY_TYPE.OPTIC_ID]: t("securityScreen.opticId.toggleTitle"),
      [BIOMETRY_TYPE.IRIS]: t("securityScreen.iris.toggleTitle"),
    }),
    [t],
  );

  const biometryDescription: Record<BIOMETRY_TYPE, string> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t("securityScreen.faceId.description"),
      [BIOMETRY_TYPE.FINGERPRINT]: t("securityScreen.fingerprint.description"),
      [BIOMETRY_TYPE.TOUCH_ID]: t("securityScreen.touchId.description"),
      [BIOMETRY_TYPE.FACE]: t("securityScreen.faceBiometrics.description"),
      [BIOMETRY_TYPE.OPTIC_ID]: t("securityScreen.opticId.description"),
      [BIOMETRY_TYPE.IRIS]: t("securityScreen.iris.description"),
    }),
    [t],
  );

  const reEnableDescriptionMap: Record<BIOMETRY_TYPE, string> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t("securityScreen.faceId.reEnableDescription"),
      [BIOMETRY_TYPE.FINGERPRINT]: t(
        "securityScreen.fingerprint.reEnableDescription",
      ),
      [BIOMETRY_TYPE.TOUCH_ID]: t("securityScreen.touchId.reEnableDescription"),
      [BIOMETRY_TYPE.FACE]: t(
        "securityScreen.faceBiometrics.reEnableDescription",
      ),
      [BIOMETRY_TYPE.OPTIC_ID]: t("securityScreen.opticId.reEnableDescription"),
      [BIOMETRY_TYPE.IRIS]: t("securityScreen.iris.reEnableDescription"),
    }),
    [t],
  );

  const openDisableBiometricsPrompt = useCallback(() => {
    setModalVisible(true);
  }, []);

  const handleOnChangeBiometrics = useCallback(() => {
    if (!isBiometricsEnabled) {
      handleBiometricsEnable();
      return;
    }
    openDisableBiometricsPrompt();
  }, [
    openDisableBiometricsPrompt,
    handleBiometricsEnable,
    isBiometricsEnabled,
  ]);

  const renderBiometricsToggle = useCallback(
    () => (
      <Toggle
        id="biometrics-toggle"
        checked={!!isBiometricsEnabled}
        onChange={handleOnChangeBiometrics}
      />
    ),
    [isBiometricsEnabled, handleOnChangeBiometrics],
  );

  const biometricsItems: BiometricsItem[] = useMemo(
    () => [
      {
        title: biometryToggleTitle[biometryType!] ?? "",
        titleColor: themeColors.text.primary,
        description: biometryDescription[biometryType!] ?? "",
        trailingContent: renderBiometricsToggle(),
        testID: "biometrics-toggle",
      },
    ],
    [
      themeColors.text.primary,
      renderBiometricsToggle,
      biometryType,
      biometryDescription,
      biometryToggleTitle,
    ],
  );

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex gap-6 mt-4">
        <List items={biometricsItems} />
      </View>
      <View>
        <ConfirmationModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          title={disableAlertTitle[biometryType!] ?? ""}
          message={disableAlertMessage[biometryType!] ?? ""}
          confirmText={t("common.yes")}
          cancelText={t("common.cancel")}
          onConfirm={() => setShouldTriggerBiometricsDisable(true)}
        />
        <Modal visible={reEnableModalVisible} onClose={closeReEnableModal}>
          <View className="w-full">
            <Text xl regular>
              {biometryToggleTitle[biometryType!] ?? ""}
            </Text>
            <View className="mt-4">
              <Text md regular secondary>
                {reEnableDescriptionMap[biometryType!] ?? ""}
              </Text>
            </View>
            <View className="mt-6 mb-6">
              <Input
                autoCapitalize="none"
                fieldSize="lg"
                label={t("showRecoveryPhraseScreen.password")}
                placeholder={t(
                  "showRecoveryPhraseScreen.passwordInputPlaceholder",
                )}
                value={reEnablePassword}
                onChangeText={(text) => {
                  setReEnablePassword(text);
                  setReEnableError(undefined);
                }}
                secureTextEntry
                error={reEnableError}
              />
            </View>
            <View className="flex-row justify-between w-full gap-3">
              <View className="flex-1">
                <Button
                  secondary
                  isFullWidth
                  onPress={closeReEnableModal}
                  disabled={isReEnabling}
                >
                  {t("common.cancel")}
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  isFullWidth
                  onPress={handleReEnableWithPassword}
                  isLoading={isReEnabling}
                  disabled={!reEnablePassword || isReEnabling}
                >
                  {t("common.confirm")}
                </Button>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </BaseLayout>
  );
};

export default BiometricsSettingsScreen;
