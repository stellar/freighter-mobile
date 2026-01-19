import { Notification, NotificationVariant } from "components/sds/Notification";
import React, { useEffect, useCallback, useRef } from "react";
import { Animated, PanResponder, View } from "react-native";
import styled from "styled-components/native";

const DEFAULT_REGULAR_DURATION = 3000;
// Let's give users a bit more time to read an error message
const DEFAULT_ERROR_DURATION = 5000;
const ANIMATION_DURATION = 300;
const SWIPE_THRESHOLD = 20; // Minimum dragged distance to trigger dismiss

export type ToastVariant = NotificationVariant;

export interface ToastProps {
  /** Variant of the toast */
  variant: ToastVariant;
  /** Toast title */
  title: string;
  /** Toast icon */
  icon?: React.ReactNode;
  /** Toast message */
  message?: string;
  /** Duration in milliseconds before the toast is dismissed */
  duration?: number;
  /** Callback function when toast is dismissed */
  onDismiss?: () => void;
  /** Whether to show filled background */
  isFilled?: boolean;
  /** If true, the toast will not auto-dismiss and can only be dismissed by user interaction */
  persistent?: boolean;
}

const AnimatedWrapper = styled(Animated.View)`
  width: 100%;
`;

/**
 * Toast component for displaying temporary notification messages.
 * Automatically animates in, stays visible for the specified duration, then animates out.
 *
 * @example
 * <Toast
 *   variant="success"
 *   title="Operation Successful"
 *   message="Your changes have been saved"
 *   duration={5000}
 *   onDismiss={() => console.log('Toast dismissed')}
 * />
 */
export const Toast: React.FC<ToastProps> = ({
  variant,
  title,
  icon,
  message,
  duration = variant === "error"
    ? DEFAULT_ERROR_DURATION
    : DEFAULT_REGULAR_DURATION,
  onDismiss,
  isFilled,
  persistent = false,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const animateIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const animateOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) {
        onDismiss();
      }
    });
  }, [fadeAnim, slideAnim, onDismiss]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        // Only respond to upward swipes
        gestureState.dy < 0,
      onPanResponderGrant: () => {
        // Clear the auto-dismiss timer when user starts interacting
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow upward movement
        if (gestureState.dy < 0) {
          pan.y.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -SWIPE_THRESHOLD) {
          // If swiped up past threshold, dismiss the toast
          Animated.timing(pan, {
            toValue: { x: 0, y: -100 },
            duration: ANIMATION_DURATION,
            useNativeDriver: true,
          }).start(() => {
            if (onDismiss) {
              onDismiss();
            }
          });
        } else {
          // If not swiped far enough, return to original position
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start(() => {
            // Restart the auto-dismiss timer only if not persistent
            if (!persistent) {
              timerRef.current = setTimeout(animateOut, duration);
            }
          });
        }
      },
    }),
  ).current;

  useEffect(() => {
    animateIn();
    // Only set auto-dismiss timer if not persistent
    if (!persistent) {
      timerRef.current = setTimeout(animateOut, duration);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [animateIn, animateOut, duration, persistent]);

  return (
    <View>
      <AnimatedWrapper
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { translateY: pan.y }],
        }}
        {...panResponder.panHandlers}
      >
        <Notification
          variant={variant}
          title={title}
          icon={icon}
          message={message}
          isFilled={isFilled}
        />
      </AnimatedWrapper>
    </View>
  );
};

Toast.displayName = "Toast";
