import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import { Toggle } from "components/sds/Toggle";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import { FACE_ID_BIOMETRY_TYPES, useBiometrics } from "hooks/useBiometrics";
import useColors from "hooks/useColors";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, View } from "react-native";

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

  const handleBiometricsEnable = useCallback(async () => {
    await enableBiometrics();
  }, [enableBiometrics]);

  useEffect(() => {
    if (shouldTriggerBiometricsDisable) {
      setShouldTriggerBiometricsDisable(false);
      disableBiometrics();
    }
  }, [shouldTriggerBiometricsDisable, disableBiometrics]);

  const openFingerprintDisablePrompt = useCallback(() => {
    Alert.alert(
      t("securityScreen.fingerprint.alert.disable.title"),
      t("securityScreen.fingerprint.alert.disable.message"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("common.yes"),
          onPress: () => setShouldTriggerBiometricsDisable(true),
        },
      ],
    );
  }, [t]);

  const openFaceIdDisablePrompt = useCallback(() => {
    Alert.alert(
      t("securityScreen.faceId.alert.disable.title"),
      t("securityScreen.faceId.alert.disable.message"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("common.yes"),
          onPress: () => setShouldTriggerBiometricsDisable(true),
        },
      ],
    );
  }, [t]);

  const handleOnChangeBiometrics = useCallback(() => {
    if (!isBiometricsEnabled) {
      handleBiometricsEnable();
      return;
    }
    if (FACE_ID_BIOMETRY_TYPES.includes(biometryType!)) {
      openFaceIdDisablePrompt();
      return;
    }
    openFingerprintDisablePrompt();
  }, [
    openFaceIdDisablePrompt,
    openFingerprintDisablePrompt,
    biometryType,
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
  const getTitle = useCallback(() => {
    if (biometryType && FACE_ID_BIOMETRY_TYPES.includes(biometryType)) {
      return t("securityScreen.faceId.toggleTitle");
    }
    return t("securityScreen.fingerprint.toggleTitle");
  }, [biometryType, t]);

  const getDescription = useCallback(() => {
    if (biometryType && FACE_ID_BIOMETRY_TYPES.includes(biometryType)) {
      return t("securityScreen.faceId.description");
    }
    return t("securityScreen.fingerprint.description");
  }, [biometryType, t]);

  const biometricsItems: BiometricsItem[] = useMemo(
    () => [
      {
        title: getTitle(),
        titleColor: themeColors.text.primary,
        description: getDescription(),
        trailingContent: renderBiometricsToggle(),
        testID: "biometrics-toggle",
      },
    ],
    [
      themeColors.text.primary,
      renderBiometricsToggle,
      getDescription,
      getTitle,
    ],
  );

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex gap-6 mt-4">
        <List items={biometricsItems} />
      </View>
    </BaseLayout>
  );
};

export default BiometricsSettingsScreen;
