import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { View, TouchableOpacity } from "react-native";

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
      className="bg-gray-6 px-3 py-2"
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View className="flex-row items-center justify-center mr-3 ml-3">
        <View className="mr-2">
          <Icon.InfoCircle size={16} color={themeColors.lilac[9]} />
        </View>
        <Text sm color={themeColors.gray[12]}>
          {text}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
