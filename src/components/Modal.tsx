import { useAuthenticationStore } from "ducks/auth";
import React, { useEffect, useState } from "react";
import {
  type StyleProp,
  View,
  type ViewStyle,
  Keyboard,
  type KeyboardEvent,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal as RNModal,
  Platform,
  TouchableWithoutFeedback,
} from "react-native";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  closeOnOverlayPress?: boolean;
  backdropColor?: string;
  contentClassName?: string;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Where the card sits: centered in the free space (default), or — for
   * text-input modals — hugging the keyboard while it's visible and centered
   * once it's dismissed.
   */
  position?: "center" | "keyboard";
  testID?: string;
  /**
   * By default a modal auto-dismisses when the wallet soft-locks (a native RN
   * Modal would otherwise render above the in-tree lock overlay). Set false for
   * modals that are part of the lock screen itself (e.g. the forgot-password
   * warning), which must stay usable while soft-locked.
   */
  dismissOnSoftLock?: boolean;
}

/**
 * Tracks keyboard visibility for the "keyboard" position mode. Flips on
 * keyboardWillShow/Hide (iOS) so the justify-end switch happens in the same
 * layout pass as KeyboardAvoidingView's padding, and animates that pass with
 * the keyboard's own duration — otherwise the card is briefly re-centered in
 * the shrunken space (jumping up) before dropping down next to the keyboard.
 * Android has no will* events, so did* is used there.
 */
const useKeyboardVisible = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const animateWithKeyboard = (event: KeyboardEvent) => {
      LayoutAnimation.configureNext({
        duration: event?.duration > 0 ? event.duration : 250,
        update: { type: LayoutAnimation.Types.keyboard },
      });
    };

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      animateWithKeyboard(event);
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, (event) => {
      animateWithKeyboard(event);
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return isKeyboardVisible;
};

const getContainerClassName = (
  position: "center" | "keyboard",
  isKeyboardVisible: boolean,
) => {
  if (position === "keyboard") {
    // Hug the keyboard while typing (the KeyboardAvoidingView pads the
    // bottom); float back to the center once it's dismissed.
    return isKeyboardVisible
      ? "flex-1 justify-end pb-5 mx-2"
      : "flex-1 justify-center mx-2";
  }

  return "flex-1 items-center justify-center mx-6";
};

const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  children,
  closeOnOverlayPress = false,
  backdropColor = "rgba(0, 0, 0, 0.9)",
  contentClassName,
  contentStyle,
  position = "center",
  testID,
  dismissOnSoftLock = true,
}) => {
  // Dismiss on soft lock: a native RN Modal renders above the in-tree lock
  // overlay, so an open one would sit on top of the lock screen. Gated on
  // isSoftLocked (not a raw background event) so a brief glance keeps state.
  // Skipped for the lock screen's own modals, which must remain interactive
  // while the wallet is soft-locked.
  const isSoftLocked = useAuthenticationStore((state) => state.isSoftLocked);
  const isKeyboardVisible = useKeyboardVisible();
  useEffect(() => {
    if (visible && isSoftLocked && dismissOnSoftLock) {
      onClose();
    }
  }, [visible, isSoftLocked, dismissOnSoftLock, onClose]);

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

        <View className={getContainerClassName(position, isKeyboardVisible)}>
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
