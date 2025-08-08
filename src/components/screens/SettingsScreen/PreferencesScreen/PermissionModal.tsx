import Modal from "components/Modal";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback } from "react";
import { View } from "react-native";

interface PermissionModalProps {
  isModalVisible: boolean;
  setIsModalVisible: (visible: boolean) => void;
  onOpenSettings: () => void;
  isLoading?: boolean;
  action: PermissionAction;
}

type PermissionAction = "enable" | "disable";

const PermissionModal: React.FC<PermissionModalProps> = ({
  isModalVisible,
  setIsModalVisible,
  onOpenSettings,
  isLoading = false,
  action,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

  const handleOpenSettings = useCallback((): void => {
    onOpenSettings();

    setIsModalVisible(false);
  }, [onOpenSettings, setIsModalVisible]);

  const handleDismiss = useCallback((): void => {
    setIsModalVisible(false);
  }, [setIsModalVisible]);

  const renderActionIcon = useCallback((): React.ReactNode => {
    const IconComponent =
      action === "enable" ? Icon.ShieldTick : Icon.ShieldOff;

    return <IconComponent size={32} color={themeColors.foreground.primary} />;
  }, [action, themeColors.foreground.primary]);

  return (
    <Modal
      visible={isModalVisible}
      onClose={handleDismiss}
      closeOnOverlayPress={!isLoading}
    >
      <View className="flex">
        <View className="justify-center items-center">
          <View className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900 justify-center items-center mb-6">
            {renderActionIcon()}
          </View>

          <Text
            primary
            lg
            medium
            textAlign="center"
            style={{ marginBottom: pxValue(8) }}
          >
            {t(`preferences.permissionModal.${action}.title`)}
          </Text>

          <Text
            secondary
            md
            regular
            textAlign="center"
            style={{ marginBottom: pxValue(16) }}
          >
            {t(`preferences.permissionModal.${action}.description`)}
          </Text>

          <Text secondary sm regular textAlign="center">
            {t(`preferences.permissionModal.${action}.instruction`)}
          </Text>

          <View className="h-8" />
        </View>

        <View className="mt-6 gap-3">
          <Button
            secondary
            xl
            isFullWidth
            onPress={handleDismiss}
            disabled={isLoading}
          >
            {t("preferences.permissionModal.notNow")}
          </Button>

          <Button
            xl
            tertiary
            isFullWidth
            onPress={handleOpenSettings}
            isLoading={isLoading}
          >
            {t("preferences.permissionModal.openSettings")}
          </Button>
        </View>
      </View>
    </Modal>
  );
};

export default PermissionModal;
