import React from "react";
import { View, Text } from "react-native";

// Constants for variants and sizes
export const BadgeVariants = {
  PRIMARY: "primary",
  SECONDARY: "secondary",
  TERTIARY: "tertiary",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
} as const;

export const BadgeSizes = {
  SMALL: "sm",
  MEDIUM: "md",
  LARGE: "lg",
} as const;

export type BadgeVariant = (typeof BadgeVariants)[keyof typeof BadgeVariants];
export type BadgeSize = (typeof BadgeSizes)[keyof typeof BadgeSizes];

export enum IconPosition {
  LEFT = "left",
  RIGHT = "right",
}

export interface BadgeProps {
  /** Variant of the badge */
  variant?: BadgeVariant;
  /** Size of the badge */
  size?: BadgeSize;
  /** Use outlined style */
  isOutlined?: boolean;
  /** Use square corners */
  isSquare?: boolean;
  /** Icon element */
  icon?: React.ReactNode;
  /** Position of the icon */
  iconPosition?: IconPosition;
  /** Add dot icon on the left side */
  isStatus?: boolean;
  /** Label of the badge */
  children: string;
  /** Optional testID for testing */
  testID?: string;
}

/**
 * Badge component used to label, categorize items or show status with various styling options.
 *
 * @example
 * Basic usage:
 * ```tsx
 * <Badge>New</Badge>
 * ```
 *
 * @example
 * With variant and size:
 * ```tsx
 * <Badge variant="success" size="md">Success</Badge>
 * ```
 *
 * @example
 * With status indicator:
 * ```tsx
 * <Badge isStatus variant="warning">Warning</Badge>
 * ```
 *
 * @example
 * With icon:
 * ```tsx
 * <Badge
 *   icon={<SomeIcon />}
 *   iconPosition="left"
 *   variant="error"
 * >
 *   Error
 * </Badge>
 * ```
 *
 * @example
 * Outlined and square:
 * ```tsx
 * <Badge isOutlined isSquare variant="secondary">
 *   Draft
 * </Badge>
 * ```
 *
 * @param {BadgeProps} props - The component props
 * @param {BadgeVariant} [props.variant="primary"] - Variant style of the badge ("primary" | "secondary" | "tertiary" | "success" | "warning" | "error")
 * @param {BadgeSize} [props.size="sm"] - Size of the badge ("sm" | "md" | "lg")
 * @param {boolean} [props.isOutlined=false] - Whether to use the outlined style instead of filled
 * @param {boolean} [props.isSquare=false] - Whether to use square corners instead of rounded
 * @param {ReactNode} [props.icon] - Icon element to display
 * @param {IconPosition} [props.iconPosition="right"] - Position of the icon ("left" | "right")
 * @param {boolean} [props.isStatus=false] - Whether to show a status dot
 * @param {string} props.children - The text content of the badge
 * @param {string} [props.testID] - Test ID for testing
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = BadgeVariants.PRIMARY,
  size = BadgeSizes.SMALL,
  isOutlined = false,
  isSquare = false,
  icon,
  iconPosition = IconPosition.RIGHT,
  isStatus = false,
  children,
  testID,
}) => {
  const getVariantClasses = () => {
    const baseClasses: Record<BadgeVariant, string> = {
      primary: "bg-gray-1 border-gray-6 text-gray-12",
      secondary: "bg-lilac-2 border-lilac-6 text-lilac-11",
      tertiary: "bg-gray-3 border-gray-6 text-gray-11",
      success: "bg-green-2 border-green-6 text-green-11",
      warning: "bg-amber-2 border-amber-6 text-amber-11",
      error: "bg-red-2 border-red-6 text-red-11",
    };

    const outlinedClasses: Record<BadgeVariant, string> = {
      primary: "bg-transparent border-gray-8 text-gray-12",
      secondary: "bg-transparent border-lilac-8 text-lilac-11",
      tertiary: "bg-transparent border-gray-8 text-gray-11",
      success: "bg-transparent border-green-8 text-green-11",
      warning: "bg-transparent border-amber-8 text-amber-11",
      error: "bg-transparent border-red-8 text-red-11",
    };

    return isOutlined ? outlinedClasses[variant] : baseClasses[variant];
  };

  const getSizeClasses = () => {
    const classes: Record<BadgeSize, string> = {
      sm: "px-1.5 py-0.5 text-xs",
      md: "px-2 py-0.5 text-sm",
      lg: "px-2.5 py-0.5 text-base",
    };

    return classes[size];
  };

  const getIconColor = () => {
    const colors: Record<BadgeVariant, string> = {
      primary: "text-gray-9",
      secondary: "text-lilac-9",
      tertiary: "text-gray-9",
      success: "text-green-9",
      warning: "text-amber-9",
      error: "text-red-9",
    };

    return colors[variant];
  };

  const getDotColor = () => {
    const colors: Record<BadgeVariant, string> = {
      primary: "bg-green-9",
      secondary: "bg-lilac-9",
      tertiary: "bg-gray-9",
      success: "bg-green-9",
      warning: "bg-amber-9",
      error: "bg-red-9",
    };

    return colors[variant];
  };

  const getTextSizeClass = () => {
    if (size === BadgeSizes.SMALL) return "text-xs";
    if (size === BadgeSizes.MEDIUM) return "text-sm";
    return "text-base";
  };

  const getTextColor = () => {
    if (variant === BadgeVariants.PRIMARY) return "text-gray-12";
    if (variant === BadgeVariants.SECONDARY) return "text-lilac-11";
    if (variant === BadgeVariants.TERTIARY) return "text-gray-11";
    return "text-gray-12";
  };

  const badgeClasses = `flex flex-row items-center border ${getVariantClasses()} ${getSizeClasses()} ${isSquare ? "rounded-md" : "rounded-full"}`;

  const textClasses = `font-medium ${getTextSizeClass()} ${getTextColor()}`;

  const renderIcon = (position: IconPosition) => {
    if (!isStatus && icon && iconPosition === position) {
      return (
        <View
          className={`mx-0.5 ${position === IconPosition.LEFT ? "mr-1" : "ml-1"} ${getIconColor()}`}
        >
          {icon}
        </View>
      );
    }

    return null;
  };

  return (
    <View className={badgeClasses} testID={testID}>
      {isStatus && (
        <View className={`w-1.5 h-1.5 rounded-full mr-1 ${getDotColor()}`} />
      )}
      {renderIcon(IconPosition.LEFT)}
      <Text className={textClasses}>{children}</Text>
      {renderIcon(IconPosition.RIGHT)}
    </View>
  );
};
