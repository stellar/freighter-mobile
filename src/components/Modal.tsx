import { useAuthenticationStore } from "ducks/auth";
import React, { useEffect, useState } from "react";
import {
  type StyleProp,
  View,
  type ViewStyle,
  Keyboard,
  type KeyboardEvent,
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  TouchableWithoutFeedback,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/** Gap kept between the card and the keyboard in "keyboard" position mode. */
const KEYBOARD_GAP = 20;
const KEYBOARD_FALLBACK_DURATION_MS = 250;

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
   * text-input modals — sliding up just enough to clear the keyboard while
   * it's visible and back to the center once it's dismissed.
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
 * Animated keyboard height. Driven by keyboardWillShow/Hide on iOS (so the
 * slide runs in sync with the keyboard) and keyboardDidShow/Hide on Android
 * (which has no will* events), easing over the keyboard's own duration when
 * the platform reports one.
 */
const useKeyboardSpace = () => {
  const keyboardSpace = useSharedValue(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const timingConfig = (event: KeyboardEvent) => ({
      duration:
        event?.duration && event.duration > 0
          ? event.duration
          : KEYBOARD_FALLBACK_DURATION_MS,
      easing: Easing.out(Easing.quad),
    });

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      keyboardSpace.value = withTiming(
        event.endCoordinates?.height ?? 0,
        timingConfig(event),
      );
    });
    const hideSubscription = Keyboard.addListener(hideEvent, (event) => {
      keyboardSpace.value = withTiming(0, timingConfig(event));
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardSpace]);

  return keyboardSpace;
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
  useEffect(() => {
    if (visible && isSoftLocked && dismissOnSoftLock) {
      onClose();
    }
  }, [visible, isSoftLocked, dismissOnSoftLock, onClose]);

  const keyboardSpace = useKeyboardSpace();
  const [containerHeight, setContainerHeight] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);

  // The card rests centered; as the animated keyboard height grows, it gets
  // "pushed" up only once the keyboard would overlap it (plus the gap), so
  // both show and hide are a single continuous slide instead of a jump.
  const slideStyle = useAnimatedStyle(() => {
    if (!containerHeight || !cardHeight) {
      return {};
    }

    const centeredCardBottom = (containerHeight + cardHeight) / 2;
    const keyboardTopLimit =
      containerHeight - keyboardSpace.value - KEYBOARD_GAP;

    return {
      transform: [
        { translateY: Math.min(0, keyboardTopLimit - centeredCardBottom) },
      ],
    };
  }, [containerHeight, cardHeight]);

  const backdrop = (
    <TouchableWithoutFeedback
      onPress={() => {
        if (closeOnOverlayPress) {
          onClose();
        }
      }}
    >
      <View className="absolute top-0 bottom-0 left-0 right-0" />
    </TouchableWithoutFeedback>
  );

  const card = (
    <View
      className={
        contentClassName ?? "py-8 px-6 bg-background-primary rounded-[32px]"
      }
      style={contentStyle}
      testID={testID}
    >
      {children}
    </View>
  );

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
      {position === "keyboard" ? (
        <View
          className="flex-1"
          onLayout={(event) =>
            setContainerHeight(event.nativeEvent.layout.height)
          }
        >
          {backdrop}
          <View className="flex-1 justify-center mx-2">
            <Animated.View
              style={slideStyle}
              onLayout={(event) =>
                setCardHeight(event.nativeEvent.layout.height)
              }
            >
              {card}
            </Animated.View>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          {backdrop}
          <View className="flex-1 items-center justify-center mx-6">
            {card}
          </View>
        </KeyboardAvoidingView>
      )}
    </RNModal>
  );
};

export default Modal;
