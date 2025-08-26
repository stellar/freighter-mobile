import { NativeStackScreenProps } from "@react-navigation/native-stack";
import ConfirmationModal from "components/ConfirmationModal";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import { Toggle } from "components/sds/Toggle";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
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
  const [shouldTriggerBiometricsDisable, setShouldTriggerBiometricsDisable] =
    useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const handleBiometricsEnable = useCallback(async () => {
    await enableBiometrics();
  }, [enableBiometrics]);

  useEffect(() => {
    if (shouldTriggerBiometricsDisable) {
      setShouldTriggerBiometricsDisable(false);
      disableBiometrics();
    }
  }, [shouldTriggerBiometricsDisable, disableBiometrics]);

  const disableAlertTitle: Partial<Record<BIOMETRY_TYPE, string>> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t("securityScreen.faceId.alert.disable.title"),
      [BIOMETRY_TYPE.FINGERPRINT]: t(
        "securityScreen.fingerprint.alert.disable.title",
      ),
      [BIOMETRY_TYPE.TOUCH_ID]: t("securityScreen.touchId.alert.disable.title"),
      [BIOMETRY_TYPE.FACE]: t(
        "securityScreen.faceBiometrics.alert.disable.title",
      ),
    }),
    [t],
  );

  const disableAlertMessage: Partial<Record<BIOMETRY_TYPE, string>> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t("securityScreen.faceId.alert.disable.message"),
      [BIOMETRY_TYPE.FINGERPRINT]: t(
        "securityScreen.fingerprint.alert.disable.message",
      ),
      [BIOMETRY_TYPE.TOUCH_ID]: t(
        "securityScreen.touchId.alert.disable.message",
      ),
      [BIOMETRY_TYPE.FACE]: t(
        "securityScreen.faceBiometrics.alert.disable.message",
      ),
    }),
    [t],
  );

  const biometryToggleTitle: Partial<Record<BIOMETRY_TYPE, string>> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t("securityScreen.faceId.toggleTitle"),
      [BIOMETRY_TYPE.FINGERPRINT]: t("securityScreen.fingerprint.toggleTitle"),
      [BIOMETRY_TYPE.TOUCH_ID]: t("securityScreen.touchId.toggleTitle"),
      [BIOMETRY_TYPE.FACE]: t("securityScreen.faceBiometrics.toggleTitle"),
    }),
    [t],
  );

  const biometryDescription: Partial<Record<BIOMETRY_TYPE, string>> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t("securityScreen.faceId.description"),
      [BIOMETRY_TYPE.FINGERPRINT]: t("securityScreen.fingerprint.description"),
      [BIOMETRY_TYPE.TOUCH_ID]: t("securityScreen.touchId.description"),
      [BIOMETRY_TYPE.FACE]: t("securityScreen.faceBiometrics.description"),
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

      <ConfirmationModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={disableAlertTitle[biometryType!] ?? ""}
        message={disableAlertMessage[biometryType!] ?? ""}
        confirmText={t("common.yes")}
        cancelText={t("common.cancel")}
        onConfirm={() => setShouldTriggerBiometricsDisable(true)}
      />
    </BaseLayout>
  );
};

export default BiometricsSettingsScreen;
