import { BUTTON_THEME } from "components/sds/Button/theme";
import { Text, TextSize } from "components/sds/Typography";
import { useAuthenticationStore } from "ducks/auth";
import { px } from "helpers/dimensions";
import { useBiometrics } from "hooks/useBiometrics";
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
  MINIMAL: "minimal",
} as const;

export const ButtonSizes = {
  SMALL: "sm",
  MEDIUM: "md",
  LARGE: "lg",
  EXTRA_LARGE: "xl",
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
  minimal?: boolean;
};

type SizeProps = {
  sm?: boolean;
  md?: boolean;
  lg?: boolean;
  xl?: boolean;
};

export enum IconPosition {
  LEFT = "left",
  RIGHT = "right",
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

const getBorderRadius = (size: ButtonSize, squared = false) => {
  if (squared) {
    return px(BUTTON_THEME.borderRadius[size]);
  }

  return px(100);
};

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
  if (props.minimal) return ButtonVariants.MINIMAL;
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
  if (props.xl) return ButtonSizes.EXTRA_LARGE;
  if (props.md) return ButtonSizes.MEDIUM;
  return defaultSize;
};

/**
 * Button component with support for variants, sizes, icons, and loading states.
 *
 * @example
 * Basic usage:
 * ```tsx
 * <Button onPress={handlePress}>
 *   Click me
 * </Button>
 * ```
 *
 * @example
 * With variants:
 * ```tsx
 * // Primary (default)
 * <Button primary>Primary Button</Button>
 *
 * // Secondary
 * <Button secondary>Secondary Button</Button>
 *
 * // Destructive
 * <Button destructive>Delete</Button>
 * ```
 *
 * @example
 * With sizes:
 * ```tsx
 * // Small
 * <Button sm>Small Button</Button>
 *
 * // Medium (default)
 * <Button md>Medium Button</Button>
 *
 * // Large
 * <Button lg>Large Button</Button>
 *
 * // Extra Large
 * <Button xl>Extra Large Button</Button>
 * ```
 *
 * @example
 * With icons and loading state:
 * ```tsx
 * <Button
 *   icon={<Icon name="arrow-right" />}
 *   iconPosition={IconPosition.RIGHT}
 *   isLoading={isSubmitting}
 * >
 *   Submit
 * </Button>
 * ```
 *
 * @example
 * With biometric authentication:
 * ```tsx
 * <Button
 *   biometric={true}
 *   onPress={() => handleConfirm()}
 * >
 *   Confirm with Biometrics
 * </Button>
 * ```
 *
 * @example
 * With biometric authentication:
 * ```tsx
 * <Button
 *   biometric={true}
 *   onPress={() => handleConfirm()}
 * >
 *   Confirm with Biometrics
 * </Button>
 * ```
 *
 * @param {ButtonProps} props - The component props
 * @param {ButtonVariant} [props.variant] - Explicit variant value (overrides shorthand props)
 * @param {ButtonSize} [props.size] - Explicit size value (overrides shorthand props)
 * @param {React.ReactNode} [props.icon] - Icon element to display
 * @param {IconPosition} [props.iconPosition=RIGHT] - Position of the icon (LEFT or RIGHT)
 * @param {boolean} [props.isLoading=false] - Shows loading indicator when true
 * @param {boolean} [props.isFullWidth=false] - Makes button fill container width
 * @param {boolean} [props.disabled=false] - Disables button interactions
 * @param {boolean} [props.squared=false] - Uses squared corners when true, rounded when false
 * @param {boolean} [props.biometric=false] - Enables biometric authentication for the onPress action
 * @param {() => void} [props.onPress] - Handler for press events
 * @param {string} [props.testID] - Test ID for testing
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
 * - xl - Extra Large buttons (50px height)
 */
interface ButtonProps extends VariantProps, SizeProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: string | React.ReactNode;
  icon?: React.ReactNode;
  iconPosition?: IconPosition;
  iconColor?: string;
  isLoading?: boolean;
  isFullWidth?: boolean;
  disabled?: boolean;
  squared?: boolean;
  biometric?: boolean;
  onPress?: () => void | Promise<void>;
  testID?: string;
}

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
  biometric = false,
  onPress,
  testID,
  iconColor,
  ...props
}: ButtonProps) => {
  const { verifyActionWithBiometrics } = useAuthenticationStore();
  const { getBiometricButtonIcon } = useBiometrics();

  const disabledState = isLoading || disabled;
  const resolvedVariant = getVariant(
    { variant, ...props },
    ButtonVariants.PRIMARY,
  );
  const resolvedSize = getSize({ size, ...props }, ButtonSizes.MEDIUM);

  // Handle biometric authentication
  const handlePress = React.useCallback(() => {
    if (!onPress) return;

    if (biometric) {
      verifyActionWithBiometrics(async () => {
        await onPress();
        return Promise.resolve();
      });
    } else {
      onPress();
    }
  }, [onPress, biometric, verifyActionWithBiometrics]);

  // Determine icon to display
  const resolvedIcon = React.useMemo(() => {
    if (biometric) {
      return getBiometricButtonIcon(iconColor);
    }
    return icon;
  }, [biometric, icon, getBiometricButtonIcon, iconColor]);

  // Determine icon position for biometric buttons
  const resolvedIconPosition = React.useMemo(() => {
    if (biometric) {
      return IconPosition.LEFT;
    }
    return iconPosition;
  }, [biometric, iconPosition]);

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

    if (resolvedIcon && resolvedIconPosition === position) {
      return <IconContainer position={position}>{resolvedIcon}</IconContainer>;
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
      onPress={handlePress}
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
