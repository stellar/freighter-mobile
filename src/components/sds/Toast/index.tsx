import { Notification, NotificationVariant } from "components/sds/Notification";
import React, { useEffect, useCallback } from "react";
import { Animated } from "react-native";
import styled from "styled-components/native";

const DEFAULT_DURATION = 3000;
const ANIMATION_DURATION = 300;

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
  duration = DEFAULT_DURATION,
  onDismiss,
  isFilled,
}) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-50)).current;

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

  useEffect(() => {
    animateIn();
    const timer = setTimeout(animateOut, duration);
    return () => clearTimeout(timer);
  }, [animateIn, animateOut, duration]);

  return (
    <AnimatedWrapper
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <Notification
        variant={variant}
        title={title}
        icon={icon}
        message={message}
        isFilled={isFilled}
      />
    </AnimatedWrapper>
  );
};

Toast.displayName = "Toast";
