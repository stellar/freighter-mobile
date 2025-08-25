import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export type BannerVariant = "warning" | "error" | "success" | "info";

export interface BannerProps {
  /** The variant/type of banner */
  variant: BannerVariant;
  /** The banner text to display */
  text: string;
  /** Optional onPress handler for interactive banners */
  onPress?: () => void;
  /** Optional className for additional styling */
  className?: string;
  /** Optional custom icon to override the default */
  icon?: React.ReactNode;
  /** Whether to show the chevron right icon (default: true) */
  showChevron?: boolean;
}

/**
 * Banner component for displaying informational messages with consistent styling.
 * Supports multiple variants and can be interactive or static.
 *
 * @example
 * // Warning banner (amber)
 * <Banner
 *   variant="warning"
 *   text="This dApp was flagged as suspicious"
 *   onPress={() => handleWarning()}
 * />
 *
 * // Error banner (red)
 * <Banner
 *   variant="error"
 *   text="This token was flagged as malicious"
 *   onPress={() => handleError()}
 * />
 *
 * // Success banner (green)
 * <Banner
 *   variant="success"
 *   text="Transaction completed successfully"
 * />
 */
export const Banner: React.FC<BannerProps> = ({
  variant,
  text,
  onPress,
  className = "",
  icon,
  showChevron = true,
}) => {
  const { themeColors } = useColors();

  // Determine background and theme color based on variant
  const getBackgroundClass = () => {
    switch (variant) {
      case "error":
        return "bg-red-3";
      case "warning":
        return "bg-amber-3";
      case "success":
        return "bg-green-3";
      case "info":
        return "bg-navy-3";
      default:
        return "bg-gray-3";
    }
  };

  // Determine text color based on variant
  const getTextColor = () => {
    switch (variant) {
      case "error":
        return themeColors.red[11];
      case "warning":
        return themeColors.amber[11];
      case "success":
        return themeColors.green[11];
      case "info":
        return themeColors.navy[11];
      default:
        return themeColors.text.secondary;
    }
  };

  // Determine theme color for icons based on variant
  const getThemeColor = (): "red" | "amber" | "green" | "navy" | "gray" => {
    switch (variant) {
      case "error":
        return "red";
      case "warning":
        return "amber";
      case "success":
        return "green";
      case "info":
        return "navy";
      default:
        return "gray";
    }
  };

  // Default icon based on variant
  const getDefaultIcon = () => {
    if (icon) return icon;

    const themeColor = getThemeColor();

    switch (variant) {
      case "error":
      case "warning":
        return <Icon.AlertSquare size={16} themeColor={themeColor} />;
      case "success":
        return <Icon.CheckCircle size={16} themeColor={themeColor} />;
      case "info":
        return <Icon.InfoCircle size={16} themeColor={themeColor} />;
      default:
        return <Icon.InfoCircle size={16} themeColor={themeColor} />;
    }
  };

  const backgroundClass = getBackgroundClass();
  const textColor = getTextColor();
  const themeColor = getThemeColor();

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        className={`px-[16px] py-[12px] rounded-[16px] w-full ${backgroundClass} ${className}`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 gap-[8px]">
            {getDefaultIcon()}
            <Text sm color={textColor}>
              {text}
            </Text>
          </View>
          {showChevron && (
            <Icon.ChevronRight size={16} themeColor={themeColor} />
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View
      className={`px-[16px] py-[12px] rounded-[16px] w-full ${backgroundClass} ${className}`}
    >
      <View className="flex-row items-center justify-between">
        <View className={`flex-row items-center ${!showChevron ? "justify-center" : ""} flex-1 gap-[8px]`}>
          {getDefaultIcon()}
          <Text sm color={textColor}>
            {text}
          </Text>
        </View>
        {showChevron && <Icon.ChevronRight size={16} themeColor={themeColor} />}
      </View>
    </View>
  );
};
