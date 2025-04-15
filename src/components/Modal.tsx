import React from "react";
import { View, Modal as RNModal } from "react-native";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ visible, onClose, children }) => (
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
    <View className="flex-1 items-center justify-center mx-6">
      <View className="py-8 px-6 bg-background-primary rounded-[32px]">
        {children}
      </View>
    </View>
  </RNModal>
);

export default Modal;
