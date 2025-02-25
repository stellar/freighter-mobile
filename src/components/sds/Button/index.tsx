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

interface ButtonProps extends VariantProps, SizeProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: string | React.ReactNode;
  icon?: React.ReactNode;
  iconPosition?: IconPosition;
  isLoading?: boolean;
  isFullWidth?: boolean;
  disabled?: boolean;
  squared?: boolean;
  onPress?: () => void;
  testID?: string;
}

interface StyledButtonProps {
  variant: ButtonVariant;
  size: ButtonSize;
  isFullWidth: boolean;
  disabled: boolean;
  squared?: boolean;
}

const getButtonHeight = (size: ButtonSize) => px(BUTTON_THEME.height[size]);

const getPadding = (size: ButtonSize) => {
  const { vertical, horizontal } = BUTTON_THEME.padding[size];
  return `${px(vertical)} ${px(horizontal)}`;
};

const getBorderRadius = (size: ButtonSize, squared = false) =>
  squared ? px(BUTTON_THEME.borderRadius[size]) : px(100);

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
  border-radius: ${({ size, squared }: StyledButtonProps) =>
    getBorderRadius(size, squared)};
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

// Helper to get variant from props
const getVariant = (
  props: { variant?: ButtonVariant } & VariantProps,
  defaultVariant: ButtonVariant,
): ButtonVariant => {
  if (props.variant) return props.variant;
  if (props.primary) return ButtonVariants.PRIMARY;
  if (props.secondary) return ButtonVariants.SECONDARY;
  if (props.tertiary) return ButtonVariants.TERTIARY;
  if (props.destructive) return ButtonVariants.DESTRUCTIVE;
  if (props.error) return ButtonVariants.ERROR;
  return defaultVariant;
};

// Helper to get size from props
const getSize = (
  props: { size?: ButtonSize } & SizeProps,
  defaultSize: ButtonSize,
): ButtonSize => {
  if (props.size) return props.size;
  if (props.sm) return ButtonSizes.SMALL;
  if (props.lg) return ButtonSizes.LARGE;
  if (props.md) return ButtonSizes.MEDIUM;
  return defaultSize;
};

/**
 * Button component with support for variants, sizes, icons, and loading states
 *
 * @prop {ButtonVariant} [variant] - Explicit variant value
 * @prop {ButtonSize} [size] - Explicit size value
 * @prop {React.ReactNode} [icon] - Icon element to display
 * @prop {IconPosition} [iconPosition=RIGHT] - Position of the icon (LEFT or RIGHT)
 * @prop {boolean} [isLoading=false] - Shows loading indicator when true
 * @prop {boolean} [isFullWidth=false] - Makes button fill container width
 * @prop {boolean} [disabled=false] - Disables button interactions
 * @prop {boolean} [squared=false] - Uses squared corners when true, rounded when false
 * @prop {() => void} [onPress] - Handler for press events
 *
 * Variant shorthands (alternative to variant prop):
 * - primary - Main call-to-action (default)
 * - secondary - Alternative action
 * - tertiary - Less prominent action
 * - destructive - Dangerous action
 * - error - Error state
 *
 * Size shorthands (alternative to size prop):
 * - sm - Small buttons (32px height)
 * - md - Medium buttons (40px height, default)
 * - lg - Large buttons (48px height)
 *
 * @example
 * ```tsx
 * // Rounded button (default)
 * <Button primary lg>
 *   Rounded Primary Button
 * </Button>
 *
 * // Squared button
 * <Button secondary md squared>
 *   Squared Secondary Button
 * </Button>
 *
 * // Using explicit props
 * <Button
 *   variant={ButtonVariants.PRIMARY}
 *   size={ButtonSizes.LARGE}
 *   isFullWidth
 * >
 *   Full Width Button
 * </Button>
 *
 * // With icon
 * <Button
 *   tertiary
 *   icon={<Icon name="settings" />}
 *   iconPosition={IconPosition.LEFT}
 * >
 *   Settings
 * </Button>
 *
 * // Loading state
 * <Button
 *   destructive
 *   isLoading
 *   disabled={false}
 *   onPress={handleDelete}
 * >
 *   Delete Account
 * </Button>
 * ```
 */
export const Button = ({
  variant,
  size,
  children,
  icon,
  iconPosition = IconPosition.RIGHT,
  isLoading = false,
  isFullWidth = false,
  disabled = false,
  squared = false,
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
      squared={squared}
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
