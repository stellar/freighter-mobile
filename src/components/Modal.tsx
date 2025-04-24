import React from "react";
import { View, Modal as RNModal, TouchableWithoutFeedback } from "react-native";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  closeOnOverlayPress?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  children,
  closeOnOverlayPress = false,
}) => (
  <RNModal
    animationType="fade"
    transparent={false}
    backdropColor="rgba(0, 0, 0, 0.9)"
    visible={visible}
    presentationStyle="overFullScreen"
    onRequestClose={() => {
      onClose();
    }}
  >
    <>
      <TouchableWithoutFeedback
        onPress={() => {
          if (closeOnOverlayPress) {
            onClose();
          }
        }}
      >
        <View className="absolute top-0 bottom-0 left-0 right-0" />
      </TouchableWithoutFeedback>

      <View className="flex-1 items-center justify-center mx-6">
        <View className="py-8 px-6 bg-background-primary rounded-[32px]">
          {children}
        </View>
      </View>
    </>
  </RNModal>
);

export default Modal;
