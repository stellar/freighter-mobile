import Modal from "components/Modal";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import React from "react";
import { View } from "react-native";

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  destructive?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  onClose,
  title,
  message,
  confirmText = "common.confirm",
  cancelText = "common.cancel",
  onConfirm,
  onCancel,
  isLoading = false,
  destructive = false,
}) => {
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal visible={visible} onClose={onClose}>
      <Text xl regular>
        {title}
      </Text>
      <View className="h-2" />
      <Text md regular secondary>
        {message}
      </Text>
      <View className="h-8" />
      <View className="flex-row justify-between w-full gap-3">
        <View className="flex-1">
          <Button
            secondary
            lg
            isFullWidth
            onPress={handleCancel}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            lg
            destructive={destructive}
            isFullWidth
            onPress={handleConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </View>
      </View>
    </Modal>
  );
};

export default ConfirmationModal;
