import { IconProps } from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export type IconButtonSize = "sm" | "md" | "lg";
export type IconButtonVariant = "primary" | "ghost" | "secondary";

export const IconButtonVariants = {
  PRIMARY: "primary",
  GHOST: "ghost",
  SECONDARY: "secondary",
} as const;

const getSizeClasses = (size: IconButtonSize) => {
  switch (size) {
    case "sm":
      return {
        container: "w-[34px] h-[34px] px-[10px] py-[6px]",
        icon: 14,
      };
    case "md":
      return {
        container: "w-[40px] h-[40px] p-[12px]",
        icon: 16,
      };
    case "lg":
    default:
      return {
        container: "w-[56px] h-[56px] p-[12px]",
        icon: 24,
      };
  }
};

const getVariantStyles = (
  variant: IconButtonVariant,
  isDisabled: boolean,
  themeColors: ReturnType<typeof useColors>["themeColors"],
) => {
  const variants = {
    primary: {
      backgroundColor: themeColors.background.tertiary,
      borderColor: themeColors.border.primary,
      iconColor: themeColors.base[1],
      hasBorder: true,
    },
    ghost: {
      backgroundColor: themeColors.background.primary,
      borderColor: "transparent",
      iconColor: themeColors.foreground.primary,
      hasBorder: false,
    },
    secondary: {
      backgroundColor: themeColors.background.secondary,
      borderColor: themeColors.border.primary,
      iconColor: themeColors.text.primary,
      hasBorder: true,
    },
  };

  const baseVariant = variants[variant];

  return {
    ...baseVariant,
    iconColor: isDisabled
      ? themeColors.foreground.primary
      : baseVariant.iconColor,
  };
};

interface IconButtonProps {
  Icon: React.FC<IconProps>;
  title?: string;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}

/**
 * IconButton Component
 *
 * A circular button with an icon and optional title, commonly used for navigation or actions.
 * The button becomes disabled when either the disabled prop is true or onPress is not provided.
 * Supports multiple sizes: sm (34px), md (40px), lg (56px) and variants: primary, ghost, secondary.
 *
 * @example
 * // HomeScreen buttons (primary variant - default)
 * <IconButton
 *   Icon={Icon.Home02}
 *   title="Home"
 *   variant="primary"
 *   onPress={() => console.log('Pressed')}
 * />
 *
 * @example
 * // SendScreen chevron buttons (ghost variant)
 * <IconButton
 *   Icon={Icon.ChevronRight}
 *   size="sm"
 *   variant="ghost"
 *   onPress={() => console.log('Pressed')}
 * />
 *
 * @example
 * // Disabled state (any variant)
 * <IconButton
 *   Icon={Icon.Plus}
 *   size="md"
 *   variant="primary"
 *   disabled={true}
 * />
 *
 * @param {Object} props - Component props
 * @param {React.FC<IconProps>} props.Icon - The icon component to display
 * @param {string} [props.title] - Optional text to display below the icon
 * @param {IconButtonSize} [props.size="lg"] - Size variant: "sm" | "md" | "lg"
 * @param {IconButtonVariant} [props.variant="primary"] - Style variant: "primary" | "ghost" | "secondary"
 * @param {() => void} [props.onPress] - Function to call when button is pressed
 * @param {boolean} [props.disabled=false] - Whether the button is disabled
 * @param {string} [props.testID] - Test identifier
 */
export const IconButton: React.FC<IconButtonProps> = ({
  Icon,
  title,
  size = "lg",
  variant = "primary",
  onPress,
  disabled = false,
  testID,
}) => {
  const isDisabled = disabled;
  const { themeColors } = useColors();
  const sizeConfig = getSizeClasses(size);
  const variantStyles = getVariantStyles(variant, isDisabled, themeColors);

  // We should only wrap in TouchableOpacity if onPress is provided
  // otherwise it would steal the touch event from the parent
  const IconWrapper = onPress ? TouchableOpacity : View;

  const effectiveTestID =
    testID ?? `icon-button-${title?.toLowerCase() ?? "button"}`;
  return (
    <View
      className={`flex flex-col items-center ${title ? "gap-[12px]" : ""} ${isDisabled ? "opacity-50" : "opacity-100"}`}
      testID={`${effectiveTestID}-container`}
    >
      <IconWrapper
        onPress={onPress}
        disabled={isDisabled}
        testID={effectiveTestID}
        className={`${sizeConfig.container} rounded-full justify-center items-center ${variantStyles.hasBorder ? "border" : ""}`}
        style={{
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variantStyles.borderColor,
        }}
      >
        <Icon color={variantStyles.iconColor} size={sizeConfig.icon} />
      </IconWrapper>
      {title && (
        <Text md medium secondary>
          {title}
        </Text>
      )}
    </View>
  );
};
