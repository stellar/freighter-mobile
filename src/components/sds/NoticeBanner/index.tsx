import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export const NoticeBannerVariants = {
  PRIMARY: "primary",
  SECONDARY: "secondary",
  TERTIARY: "tertiary",
  WARNING: "warning",
  ERROR: "error",
} as const;

export type NoticeBannerVariant =
  (typeof NoticeBannerVariants)[keyof typeof NoticeBannerVariants];

interface NoticeBannerProps {
  text: string;
  onPress?: () => void;
  variant?: NoticeBannerVariant;
}

type VariantConfig = {
  bg: string;
  themeColor: "gray" | "lilac" | "amber" | "red";
  icon: "info" | "infoOctagon";
};

const VARIANT_CONFIG: Record<NoticeBannerVariant, VariantConfig> = {
  // primary uses bg-gray-6 and a direct lilac[9] icon color — see renderIcon()
  primary: { bg: "bg-gray-6", themeColor: "lilac", icon: "info" },
  secondary: { bg: "bg-lilac-2", themeColor: "lilac", icon: "info" },
  tertiary: { bg: "bg-gray-3", themeColor: "gray", icon: "info" },
  warning: { bg: "bg-amber-2", themeColor: "amber", icon: "infoOctagon" },
  error: { bg: "bg-red-2", themeColor: "red", icon: "infoOctagon" },
};

/**
 * Full-width interactive banner strip with icon and text.
 * Variant names follow the button/badge system (primary, secondary, tertiary, warning, error).
 * Defaults to "primary" to preserve backwards compatibility with the app update banner.
 */
export const NoticeBanner: React.FC<NoticeBannerProps> = ({
  text,
  onPress,
  variant = NoticeBannerVariants.PRIMARY,
}) => {
  const { themeColors } = useColors();
  const config = VARIANT_CONFIG[variant];

  const renderIcon = () => {
    // primary matches the original app update banner: InfoCircle with lilac[9] direct color
    if (variant === NoticeBannerVariants.PRIMARY) {
      return <Icon.InfoCircle size={16} color={themeColors.lilac[9]} />;
    }
    if (config.icon === "infoOctagon") {
      return <Icon.InfoOctagon size={16} themeColor={config.themeColor} />;
    }
    return <Icon.InfoCircle size={16} themeColor={config.themeColor} />;
  };

  return (
    <TouchableOpacity
      className={`${config.bg} px-3 py-2`}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View className="flex-row items-center justify-center mr-3 ml-3">
        <View className="mr-2">{renderIcon()}</View>
        <Text sm color={themeColors.gray[12]}>
          {text}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
