import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { FACE_ID_BIOMETRY_TYPES } from "config/constants";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import useColors from "hooks/useColors";
import React, { useCallback } from "react";
import { View } from "react-native";
import { BIOMETRY_TYPE } from "react-native-keychain";

type SecurityScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.SECURITY_SCREEN
>;

const SecurityScreen: React.FC<SecurityScreenProps> = ({ navigation }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { isBiometricsSensorAvailable, biometryType } = useBiometrics();

  const biometryTitle: Record<BIOMETRY_TYPE, string> = {
    [BIOMETRY_TYPE.FACE_ID]: t("securityScreen.faceId.title"),
    [BIOMETRY_TYPE.FINGERPRINT]: t("securityScreen.fingerprint.title"),
    [BIOMETRY_TYPE.TOUCH_ID]: t("securityScreen.touchId.title"),
    [BIOMETRY_TYPE.FACE]: t("securityScreen.faceBiometrics.title"),
    [BIOMETRY_TYPE.OPTIC_ID]: t("securityScreen.opticId.title"),
    [BIOMETRY_TYPE.IRIS]: t("securityScreen.iris.title"),
  };

  const getBiometryIcon = useCallback(() => {
    if (biometryType && FACE_ID_BIOMETRY_TYPES.includes(biometryType)) {
      return <Icon.FaceId color={themeColors.foreground.primary} />;
    }
    return <Icon.Fingerprint01 color={themeColors.foreground.primary} />;
  }, [biometryType, themeColors]);

  const listItems = [
    {
      icon: <Icon.FileLock02 color={themeColors.foreground.primary} />,
      title: t("securityScreen.showRecoveryPhrase"),
      titleColor: themeColors.text.primary,
      onPress: () =>
        navigation.navigate(SETTINGS_ROUTES.SHOW_RECOVERY_PHRASE_SCREEN),
      trailingContent: (
        <Icon.ChevronRight color={themeColors.foreground.primary} />
      ),
      testID: "show-recovery-phrase-button",
    },
  ];
  if (isBiometricsSensorAvailable) {
    listItems.push({
      icon: getBiometryIcon(),
      title: biometryTitle[biometryType!] ?? "",
      titleColor: themeColors.text.primary,
      onPress: () =>
        navigation.navigate(SETTINGS_ROUTES.BIOMETRICS_SETTINGS_SCREEN),
      trailingContent: (
        <Icon.ChevronRight color={themeColors.foreground.primary} />
      ),
      testID: "face-id-settings-button",
    });
  }

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex flex-col gap-6 mt-4">
        <List items={listItems} />
      </View>
    </BaseLayout>
  );
};

export default SecurityScreen;
