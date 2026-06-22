import { useAuthenticationStore } from "ducks/auth";
import React, { useEffect } from "react";
import {
  type StyleProp,
  View,
  type ViewStyle,
  Modal as RNModal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from "react-native";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  closeOnOverlayPress?: boolean;
  backdropColor?: string;
  contentClassName?: string;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  children,
  closeOnOverlayPress = false,
  backdropColor = "rgba(0, 0, 0, 0.9)",
  contentClassName,
  contentStyle,
  testID,
}) => {
  // Dismiss on soft lock: a native RN Modal renders above the in-tree lock
  // overlay, so an open one would sit on top of the lock screen. Gated on
  // isSoftLocked (not a raw background event) so a brief glance keeps state.
  const isSoftLocked = useAuthenticationStore((state) => state.isSoftLocked);
  useEffect(() => {
    if (visible && isSoftLocked) {
      onClose();
    }
  }, [visible, isSoftLocked, onClose]);

  return (
    <RNModal
      animationType="fade"
      transparent={false}
      backdropColor={backdropColor}
      visible={visible}
      presentationStyle="overFullScreen"
      onRequestClose={() => {
        onClose();
      }}
    >
      <KeyboardAvoidingView behavior="padding" className="flex-1">
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
          <View
            className={
              contentClassName ??
              "py-8 px-6 bg-background-primary rounded-[32px]"
            }
            style={contentStyle}
            testID={testID}
          >
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
};

export default Modal;
