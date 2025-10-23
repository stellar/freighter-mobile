import Icon from "components/sds/Icon";
import useColors from "hooks/useColors";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

interface NoticeBannerProps {
  text: string;
  onPress?: () => void;
}

/**
 * Interactive banner component with info icon and text
 * Used for displaying informational messages like app update notices
 * Can be tapped when onPress is provided
 */
export const NoticeBanner: React.FC<NoticeBannerProps> = ({
  text,
  onPress,
}) => {
  const { themeColors } = useColors();

  return (
    <TouchableOpacity
      className="flex-row items-center justify-center bg-gray-6 px-3 py-2"
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View className="mr-2">
        <Icon.InfoCircle size={16} color={themeColors.lilac[9]} />
      </View>
      <Text className="flex-1 text-sm text-gray-12">{text}</Text>
      {onPress && (
        <View className="ml-2">
          <Icon.ChevronRight size={14} color={themeColors.gray[6]} />
        </View>
      )}
    </TouchableOpacity>
  );
};
