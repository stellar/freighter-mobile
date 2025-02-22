import { BUTTON_THEME } from "components/sds/Button/theme";
import { px, fs } from "helpers/dimensions";
import React from "react";
import { TouchableOpacity, ActivityIndicator } from "react-native";
import styled from "styled-components/native";

export enum ButtonVariant {
  PRIMARY = "primary",
  SECONDARY = "secondary",
  TERTIARY = "tertiary",
  DESTRUCTIVE = "destructive",
  ERROR = "error",
}

export enum ButtonSize {
  SMALL = "sm",
  MEDIUM = "md",
  LARGE = "lg",
}

export enum IconPosition {
  LEFT = "left",
  RIGHT = "right",
}

interface ButtonProps {
  /** Variant of the button */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Label of the button */
  children?: string | React.ReactNode;
  /** Icon element */
  icon?: React.ReactNode;
  /** Position of the icon */
  iconPosition?: IconPosition;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Sets width of the button to match the parent container */
  isFullWidth?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** onPress handler */
  onPress?: () => void;
}

interface StyledButtonProps {
  variant: ButtonVariant;
  size: ButtonSize;
  isFullWidth: boolean;
  disabled: boolean;
}

const getButtonHeight = (size: ButtonSize) => px(BUTTON_THEME.height[size]);

const getFontSize = (size: ButtonSize) => fs(BUTTON_THEME.fontSize[size]);

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

const getTextColor = (variant: ButtonVariant, disabled: boolean) => {
  if (disabled) {
    return BUTTON_THEME.colors.disabled.text;
  }
  return BUTTON_THEME.colors[variant].text;
};

const StyledButton = styled(TouchableOpacity)<StyledButtonProps>`
  height: ${({ size }: StyledButtonProps) => getButtonHeight(size)};
  padding: ${({ size }: StyledButtonProps) => getPadding(size)};
  border-radius: ${({ size }: StyledButtonProps) => getBorderRadius(size)};
  background-color: ${({ variant, disabled }: StyledButtonProps) =>
    getBackgroundColor(variant, disabled)};
  opacity: ${({ disabled }: StyledButtonProps) => (disabled ? 0.5 : 1)};
  flex-direction: row;
  align-items: center;
  justify-content: center;
  width: ${({ isFullWidth }: StyledButtonProps) =>
    isFullWidth ? "100%" : "auto"};
  ${({ variant, disabled }: StyledButtonProps) =>
    variant === ButtonVariant.TERTIARY || disabled
      ? `
    border-width: ${px(1)};
    border-color: ${BUTTON_THEME.colors.tertiary.border};
  `
      : ""}
`;

interface ButtonTextProps {
  variant: ButtonVariant;
  size: ButtonSize;
  disabled: boolean;
}

const ButtonText = styled.Text<ButtonTextProps>`
  color: ${({ variant, disabled }: ButtonTextProps) =>
    getTextColor(variant, disabled)};
  font-size: ${({ size }: ButtonTextProps) => getFontSize(size)};
  text-align: center;
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

export const Button = ({
  variant = ButtonVariant.PRIMARY,
  size = ButtonSize.MEDIUM,
  children,
  icon,
  iconPosition = IconPosition.RIGHT,
  isLoading = false,
  isFullWidth = false,
  disabled = false,
  onPress,
}: ButtonProps) => {
  const renderIcon = (position: IconPosition) => {
    if (isLoading && position === IconPosition.RIGHT) {
      return (
        <IconContainer position={IconPosition.RIGHT}>
          <ActivityIndicator
            testID="button-loading-indicator"
            size="small"
            color={getTextColor(variant, disabled)}
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
      variant={variant}
      size={size}
      isFullWidth={isFullWidth}
      disabled={disabled || isLoading}
      onPress={onPress}
    >
      {renderIcon(IconPosition.LEFT)}
      <ButtonText variant={variant} size={size} disabled={disabled}>
        {children}
      </ButtonText>
      {renderIcon(IconPosition.RIGHT)}
    </StyledButton>
  );
};
