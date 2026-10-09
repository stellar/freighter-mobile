import { BUTTON_THEME, ButtonColors } from "components/sds/Button/theme";
import { Text, TextSize } from "components/sds/Typography";
import { useAuthenticationStore } from "ducks/auth";
import { px } from "helpers/dimensions";
import { useBiometrics } from "hooks/useBiometrics";
import useButtonColors from "hooks/useButtonColors";
import React, { useCallback, useMemo } from "react";
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
  size: ButtonSize;
  isFullWidth: boolean;
  disabled: boolean;
  squared?: boolean;
  $backgroundColor: string;
  $borderColor?: string;
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

const getVariantColors = (
  colors: ButtonColors,
  variant: ButtonVariant,
  disabled: boolean,
) => (disabled ? colors.disabled : colors[variant]);

const getFontSize = (size: ButtonSize): TextSize => BUTTON_THEME.fontSize[size];

const StyledButton = styled(TouchableOpacity)<StyledButtonProps>`
  height: ${({ size }: StyledButtonProps) => getButtonHeight(size)};
  padding: ${({ size }: StyledButtonProps) => getPadding(size)};
  border-radius: ${({ size, squared }: StyledButtonProps) =>
    getBorderRadius(size, squared)};
  background-color: ${({ $backgroundColor }: StyledButtonProps) =>
    $backgroundColor};
  flex-direction: row;
  align-items: center;
  justify-content: center;
  width: ${({ isFullWidth }: StyledButtonProps) =>
    isFullWidth ? "100%" : "auto"};
  border-width: ${({ $borderColor }: StyledButtonProps) =>
    $borderColor ? px(1) : 0};
  border-color: ${({ $borderColor }: StyledButtonProps) =>
    $borderColor || "transparent"};
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
 * With variants. Varial buttons are monochrome pills, apart from `primary`,
 * which carries the brand color.
 * ```tsx
 * // secondary - the filled call to action
 * <Button secondary>Create a new wallet</Button>
 *
 * // tertiary - the outlined call to action
 * <Button tertiary>Import wallet</Button>
 *
 * // destructive - solid red, for an irreversible action
 * <Button destructive>Delete</Button>
 *
 * // error - tinted red, for a cautionary action
 * <Button error>Disconnect all</Button>
 *
 * // minimal - bare text, no fill or border
 * <Button minimal>Forgot password</Button>
 * ```
 *
 * @example
 * With sizes:
 * ```tsx
 * // Small
 * <Button sm>Small Button</Button>
 *
 * // Medium
 * <Button md>Medium Button</Button>
 *
 * // Large
 * <Button lg>Large Button</Button>
 *
 * // Extra Large (default)
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
 * - md - Medium buttons (40px height)
 * - lg - Large buttons (48px height)
 * - xl - Extra Large buttons (50px height, default)
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
  onPress?: (...args: unknown[]) => void | Promise<void>;
  testID?: string;
}

// Base button component without hooks
const ButtonBase = ({
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
}: Omit<ButtonProps, "biometric">) => {
  const buttonColors = useButtonColors();
  const disabledState = isLoading || disabled;
  const resolvedVariant = getVariant(
    { variant, ...props },
    ButtonVariants.PRIMARY,
  );
  const resolvedSize = getSize({ size, ...props }, ButtonSizes.EXTRA_LARGE);
  const variantColors = getVariantColors(
    buttonColors,
    resolvedVariant,
    disabledState,
  );

  const handlePress = useCallback(() => {
    if (!onPress) return;
    onPress();
  }, [onPress]);

  // An icon sitting beside a label in a different color reads as a mistake, so
  // it takes the label's color. A caller that sets one keeps it, which leaves
  // room for a deliberate exception such as a status-colored icon.
  const tintedIcon = React.isValidElement<{ color?: string }>(icon)
    ? React.cloneElement(icon, {
        color: icon.props.color ?? variantColors.text,
      })
    : icon;

  const renderIcon = (position: IconPosition) => {
    if (isLoading && position === IconPosition.RIGHT) {
      return (
        <IconContainer position={IconPosition.RIGHT}>
          <ActivityIndicator
            testID="button-loading-indicator"
            size="small"
            color={variantColors.text}
          />
        </IconContainer>
      );
    }

    if (icon && iconPosition === position) {
      return <IconContainer position={position}>{tintedIcon}</IconContainer>;
    }

    return null;
  };

  return (
    <StyledButton
      size={resolvedSize}
      $backgroundColor={variantColors.background}
      $borderColor={variantColors.border}
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
        color={variantColors.text}
        isVerticallyCentered
        // A label wide enough to fill the button would otherwise keep its full
        // width and drive the icon past the edge, taking the pair off center
        // with it. Shrinking it keeps label and icon together and centered; the
        // single line is what isVerticallyCentered's fixed height already
        // allows, so the overflow ellipsizes rather than being clipped.
        numberOfLines={1}
        style={{ flexShrink: 1 }}
      >
        {children}
      </Text>
      {renderIcon(IconPosition.RIGHT)}
    </StyledButton>
  );
};

const withBiometrics =
  (Component: typeof ButtonBase) =>
  ({ iconColor, onPress, ...props }: ButtonProps) => {
    const { verifyActionWithBiometrics } = useAuthenticationStore();
    const { getBiometricButtonIcon } = useBiometrics();

    const handleBiometricPress = useCallback(() => {
      if (!onPress) return;

      verifyActionWithBiometrics(async (...args: unknown[]) => {
        await onPress(...args);
        return Promise.resolve();
      });
    }, [onPress, verifyActionWithBiometrics]);

    const biometricIcon = useMemo(
      () => getBiometricButtonIcon(iconColor),
      [getBiometricButtonIcon, iconColor],
    );

    return (
      <Component
        {...props}
        icon={biometricIcon}
        iconPosition={IconPosition.LEFT}
        onPress={handleBiometricPress}
      />
    );
  };

const ButtonWithBiometrics = withBiometrics(ButtonBase);

export const Button = ({ biometric = false, ...props }: ButtonProps) => {
  if (biometric) {
    return <ButtonWithBiometrics {...props} />;
  }
  return <ButtonBase {...props} />;
};
