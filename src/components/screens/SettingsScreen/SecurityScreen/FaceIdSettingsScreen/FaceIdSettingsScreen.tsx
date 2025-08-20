import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import { Toggle } from "components/sds/Toggle";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useFaceId } from "hooks/useFaceId";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, View } from "react-native";

interface FaceIdSettingsScreenProps
  extends NativeStackScreenProps<
    SettingsStackParamList,
    typeof SETTINGS_ROUTES.FACE_ID_SETTINGS_SCREEN
  > {}

interface FaceIdItem {
  title: string;
  titleColor: string;
  description: string;
  trailingContent: React.ReactNode;
  testID: string;
}

const FaceIdSettingsScreen: React.FC<FaceIdSettingsScreenProps> = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { isFaceIdEnabled, verifyFaceId, setIsFaceIdEnabled } = useFaceId();
  const [shouldVerifyFaceId, setShouldVerifyFaceId] = useState(false);

  useEffect(() => {
    const checkFaceIdMatch = async () => {
      setShouldVerifyFaceId(false);
      const result = await verifyFaceId();
      if (result.success) {
        setIsFaceIdEnabled(false);
      }
    };
    if (shouldVerifyFaceId) {
      checkFaceIdMatch();
    }
  }, [shouldVerifyFaceId, verifyFaceId, setIsFaceIdEnabled]);

  const handleFaceIdDisable = useCallback(() => {
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
          onPress: () => {
            setShouldVerifyFaceId(true);
          },
        },
      ],
    );
  }, [t]);

  const handleFaceIdEnable = useCallback(async () => {
    const result = await verifyFaceId();
    if (result.success) {
      setIsFaceIdEnabled(true);
    }
  }, [verifyFaceId, setIsFaceIdEnabled]);

  const renderFaceIdToggle = useCallback(
    () => (
      <Toggle
        id="face-id-toggle"
        checked={isFaceIdEnabled}
        onChange={isFaceIdEnabled ? handleFaceIdDisable : handleFaceIdEnable}
      />
    ),
    [isFaceIdEnabled, handleFaceIdDisable, handleFaceIdEnable],
  );

  const faceIdItems: FaceIdItem[] = useMemo(
    () => [
      {
        title: t("securityScreen.faceId.toggleTitle"),
        titleColor: themeColors.text.primary,
        description: t("securityScreen.faceId.description"),
        trailingContent: renderFaceIdToggle(),
        testID: "face-id-toggle",
      },
    ],
    [t, themeColors.text.primary, renderFaceIdToggle],
  );

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex gap-6 mt-4">
        <List items={faceIdItems} />
      </View>
    </BaseLayout>
  );
};

export default FaceIdSettingsScreen;
