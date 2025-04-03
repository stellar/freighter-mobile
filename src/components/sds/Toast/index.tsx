import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { PALETTE } from "config/theme";
import { px } from "helpers/dimensions";
import React, { useEffect, useCallback } from "react";
import { Animated } from "react-native";
import styled from "styled-components/native";

export type ToastVariant =
  | "primary"
  | "secondary"
  | "success"
  | "error"
  | "warning";

export interface ToastProps {
  /** Variant of the toast */
  variant: ToastVariant;
  /** Toast title */
  title: string;
  /** Toast icon @defaultValue `<Icon.InfoCircle />` */
  icon?: React.ReactNode;
  /** Toast message */
  message?: string;
  /** Duration in milliseconds before auto-dismissing (default: 3000) */
  duration?: number;
  /** Callback when toast is dismissed */
  onDismiss?: () => void;
  /** Whether to show filled background */
  isFilled?: boolean;
}

const getBackgroundColor = (
  variant: ToastVariant,
  isFilled?: boolean,
): string => {
  if (isFilled) {
    switch (variant) {
      case "success":
        return PALETTE.dark.green["03"];
      case "error":
        return PALETTE.dark.red["02"];
      case "warning":
        return PALETTE.dark.amber["03"];
      case "secondary":
        return PALETTE.dark.gray["03"];
      case "primary":
      default:
        return PALETTE.dark.gray["01"];
    }
  }
  return PALETTE.dark.gray["01"];
};

const getIconColor = (variant: ToastVariant): string => {
  switch (variant) {
    case "success":
      return PALETTE.dark.green["09"];
    case "error":
      return PALETTE.dark.red["09"];
    case "warning":
      return PALETTE.dark.amber["09"];
    case "secondary":
      return PALETTE.dark.gray["11"];
    case "primary":
    default:
      return PALETTE.dark.lilac["09"];
  }
};

const ToastWrapper = styled.View`
  width: 100%;
  padding: 0 ${px(24)};
`;

const ToastContainer = styled(Animated.View)<{
  variant: ToastVariant;
  isFilled?: boolean;
}>`
  background-color: ${({
    variant,
    isFilled,
  }: {
    variant: ToastVariant;
    isFilled?: boolean;
  }) => getBackgroundColor(variant, isFilled)};
  border: 1px solid ${PALETTE.dark.gray["06"]};
  border-radius: ${px(8)};
  padding: ${px(12)};
  margin: ${px(8)} 0;
  flex-direction: column;
  gap: ${px(8)};
  width: 100%;
  shadow-color: #000;
  shadow-offset: 0px 2px;
  shadow-opacity: 0.25;
  shadow-radius: 3.84px;
  elevation: 5;
`;

const TitleContainer = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: ${px(8)};
`;

const IconContainer = styled.View`
  width: ${px(16)};
  height: ${px(16)};
  margin-top: ${px(2)};
  flex-shrink: 0;
`;

const TitleText = styled(Text)`
  color: ${PALETTE.dark.gray["12"]};
  font-size: ${px(14)};
  line-height: ${px(20)};
  font-weight: 600;
`;

const MessageText = styled(Text)`
  color: ${PALETTE.dark.gray["11"]};
  font-size: ${px(14)};
  line-height: ${px(20)};
  font-weight: 400;
`;

/**
 * Toast component for displaying temporary notifications
 *
 * @example
 * <Toast
 *   variant="success"
 *   title="Success!"
 *   message="Your action was completed successfully."
 *   duration={3000}
 *   onDismiss={() => console.log('Toast dismissed')}
 * />
 */
export const Toast: React.FC<ToastProps> = ({
  variant,
  title,
  icon,
  message,
  duration = 3000,
  onDismiss,
  isFilled = false,
}) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  const dismissToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  }, [fadeAnim, slideAnim, onDismiss]);

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss after duration
    const timer = setTimeout(dismissToast, duration);
    return () => clearTimeout(timer);
  }, [dismissToast, duration, fadeAnim, slideAnim]);

  return (
    <ToastWrapper>
      <ToastContainer
        variant={variant}
        isFilled={isFilled}
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <TitleContainer>
          <IconContainer>
            {icon || (
              <Icon.InfoCircle size={16} color={getIconColor(variant)} />
            )}
          </IconContainer>
          <TitleText>{title}</TitleText>
        </TitleContainer>
        {message && <MessageText>{message}</MessageText>}
      </ToastContainer>
    </ToastWrapper>
  );
};

Toast.displayName = "Toast";
