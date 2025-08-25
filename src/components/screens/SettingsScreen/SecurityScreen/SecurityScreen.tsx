import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import { FACE_ID_BIOMETRY_TYPES, useBiometrics } from "hooks/useBiometrics";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";
import { BIOMETRY_TYPE } from "react-native-keychain";

type SecurityScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.SECURITY_SCREEN
>;

const SecurityScreen: React.FC<SecurityScreenProps> = ({ navigation }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { isBiometricsAvailable, biometryType } = useBiometrics();

  const biometryTitle: Partial<Record<BIOMETRY_TYPE, string>> = {
    [BIOMETRY_TYPE.FACE_ID]: t("securityScreen.faceId.title"),
    [BIOMETRY_TYPE.FINGERPRINT]: t("securityScreen.fingerprint.title"),
    [BIOMETRY_TYPE.TOUCH_ID]: t("securityScreen.touchId.title"),
    [BIOMETRY_TYPE.FACE]: t("securityScreen.faceBiometrics.title"),
  };
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
  if (isBiometricsAvailable) {
    listItems.push({
      icon: FACE_ID_BIOMETRY_TYPES.includes(biometryType!) ? (
        <Icon.FaceId color={themeColors.foreground.primary} />
      ) : (
        <Icon.Fingerprint01 color={themeColors.foreground.primary} />
      ),
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
