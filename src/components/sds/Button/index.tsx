import { BUTTON_THEME } from "components/sds/Button/theme";
import { Text, TextSize } from "components/sds/Typography";
import { px } from "helpers/dimensions";
import React from "react";
import { TouchableOpacity, ActivityIndicator } from "react-native";
import styled from "styled-components/native";

// Convert enums to const objects for better type inference
export const ButtonVariants = {
  PRIMARY: "primary",
  SECONDARY: "secondary",
  TERTIARY: "tertiary",
  DESTRUCTIVE: "destructive",
  ERROR: "error",
} as const;

export const ButtonSizes = {
  SMALL: "sm",
  MEDIUM: "md",
  LARGE: "lg",
} as const;

// Create types from the const objects
export type ButtonVariant =
  (typeof ButtonVariants)[keyof typeof ButtonVariants];
export type ButtonSize = (typeof ButtonSizes)[keyof typeof ButtonSizes];

// Create shorthand types
type VariantProps = {
  primary?: boolean;
  secondary?: boolean;
  tertiary?: boolean;
  destructive?: boolean;
  error?: boolean;
};

type SizeProps = {
  sm?: boolean;
  md?: boolean;
  lg?: boolean;
};

export enum IconPosition {
  LEFT = "left",
  RIGHT = "right",
}

/**
 * Button component with support for variants, sizes, icons, and loading states
 *
 * Variants:
 * - primary (default) - Main call-to-action
 * - secondary - Alternative action
 * - tertiary - Less prominent action
 * - destructive - Dangerous action
 * - error - Error state
 *
 * Sizes:
 * - sm - Small buttons
 * - md - Medium buttons (default)
 * - lg - Large buttons
 *
 * @example
 * ```tsx
 * // Using shorthands
 * <Button primary lg>Large Primary Button</Button>
 * <Button secondary sm>Small Secondary Button</Button>
 *
 * // Using explicit props
 * <Button
 *   variant={ButtonVariant.PRIMARY}
 *   size={ButtonSize.LARGE}
 * >
 *   Large Primary Button
 * </Button>
 * ```
 */
interface ButtonProps extends VariantProps, SizeProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: string | React.ReactNode;
  icon?: React.ReactNode;
  iconPosition?: IconPosition;
  isLoading?: boolean;
  isFullWidth?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
}

interface StyledButtonProps {
  variant: ButtonVariant;
  size: ButtonSize;
  isFullWidth: boolean;
  disabled: boolean;
}

const getButtonHeight = (size: ButtonSize) => px(BUTTON_THEME.height[size]);

const getPadding = (size: ButtonSize) => {
  const { vertical, horizontal } = BUTTON_THEME.padding[size];
  return `${px(vertical)} ${px(horizontal)}`;
};

const getBorderRadius = (size: ButtonSize) =>
  px(BUTTON_THEME.borderRadius[size]);

const getBackgroundColor = (variant: ButtonVariant, disabled: boolean) => {
  if (disabled) {
    return BUTTON_THEME.colors.disabled.background;
  }
  return BUTTON_THEME.colors[variant].background;
};

const getBorderColor = (variant: ButtonVariant, disabled: boolean) => {
  if (disabled) {
    return BUTTON_THEME.colors.disabled.border;
  }
  return BUTTON_THEME.colors[variant].border;
};

const getTextColor = (variant: ButtonVariant, disabled: boolean) => {
  if (disabled) {
    return BUTTON_THEME.colors.disabled.text;
  }
  return BUTTON_THEME.colors[variant].text;
};

const getFontSize = (size: ButtonSize): TextSize => BUTTON_THEME.fontSize[size];

const StyledButton = styled(TouchableOpacity)<StyledButtonProps>`
  height: ${({ size }: StyledButtonProps) => getButtonHeight(size)};
  padding: ${({ size }: StyledButtonProps) => getPadding(size)};
  border-radius: ${({ size }: StyledButtonProps) => getBorderRadius(size)};
  background-color: ${({ variant, disabled }: StyledButtonProps) =>
    getBackgroundColor(variant, disabled)};
  flex-direction: row;
  align-items: center;
  justify-content: center;
  width: ${({ isFullWidth }: StyledButtonProps) =>
    isFullWidth ? "100%" : "auto"};
  border-width: ${({ variant, disabled }: StyledButtonProps) =>
    getBorderColor(variant, disabled) ? px(1) : 0};
  border-color: ${({ variant, disabled }: StyledButtonProps) =>
    getBorderColor(variant, disabled) || "transparent"};
`;

interface IconContainerProps {
  position: IconPosition;
}

const IconContainer = styled.View<IconContainerProps>`
  margin-left: ${({ position }: IconContainerProps) =>
    position === IconPosition.RIGHT ? px(BUTTON_THEME.icon.spacing) : 0};
  margin-right: ${({ position }: IconContainerProps) =>
    position === IconPosition.LEFT ? px(BUTTON_THEME.icon.spacing) : 0};
`;

/* eslint-disable no-nested-ternary */
// Helper to get variant from props
const getVariant = (
  props: { variant?: ButtonVariant } & VariantProps,
  defaultVariant: ButtonVariant,
): ButtonVariant =>
  props.variant ||
  (props.primary
    ? ButtonVariants.PRIMARY
    : props.secondary
      ? ButtonVariants.SECONDARY
      : props.tertiary
        ? ButtonVariants.TERTIARY
        : props.destructive
          ? ButtonVariants.DESTRUCTIVE
          : props.error
            ? ButtonVariants.ERROR
            : defaultVariant);

// Helper to get size from props
const getSize = (
  props: { size?: ButtonSize } & SizeProps,
  defaultSize: ButtonSize,
): ButtonSize =>
  props.size ||
  (props.sm
    ? ButtonSizes.SMALL
    : props.lg
      ? ButtonSizes.LARGE
      : props.md
        ? ButtonSizes.MEDIUM
        : defaultSize);
/* eslint-enable no-nested-ternary */

export const Button = ({
  variant,
  size,
  children,
  icon,
  iconPosition = IconPosition.RIGHT,
  isLoading = false,
  isFullWidth = false,
  disabled = false,
  onPress,
  testID,
  ...props
}: ButtonProps) => {
  const disabledState = isLoading || disabled;
  const resolvedVariant = getVariant(
    { variant, ...props },
    ButtonVariants.PRIMARY,
  );
  const resolvedSize = getSize({ size, ...props }, ButtonSizes.MEDIUM);

  const renderIcon = (position: IconPosition) => {
    if (isLoading && position === IconPosition.RIGHT) {
      return (
        <IconContainer position={IconPosition.RIGHT}>
          <ActivityIndicator
            testID="button-loading-indicator"
            size="small"
            color={getTextColor(resolvedVariant, disabledState)}
          />
        </IconContainer>
      );
    }

    if (icon && iconPosition === position) {
      return <IconContainer position={position}>{icon}</IconContainer>;
    }

    return null;
  };

  return (
    <StyledButton
      variant={resolvedVariant}
      size={resolvedSize}
      isFullWidth={isFullWidth}
      disabled={disabledState}
      onPress={onPress}
      testID={testID}
    >
      {renderIcon(IconPosition.LEFT)}
      <Text
        size={getFontSize(resolvedSize)}
        weight="semiBold"
        color={getTextColor(resolvedVariant, disabledState)}
        isVerticallyCentered
      >
        {children}
      </Text>
      {renderIcon(IconPosition.RIGHT)}
    </StyledButton>
  );
};
