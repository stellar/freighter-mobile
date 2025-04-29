import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface ContactRowProps {
  address: string;
  name?: string;
  onPress?: () => void;
  showDots?: boolean;
  rightElement?: React.ReactNode;
  className?: string;
}

export const ContactRow: React.FC<ContactRowProps> = ({
  address,
  name,
  onPress,
  showDots = true,
  rightElement,
  className,
}) => {
  const { themeColors } = useColors();
  const slicedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <TouchableOpacity
      className={`flex-row w-full h-[44px] justify-between items-center ${className || ""}`}
      onPress={onPress}
    >
      <View className="flex-row items-center flex-1 mr-4">
        <Avatar size="lg" publicAddress={address} />
        <View className="flex-col ml-4 flex-1">
          <Text medium numberOfLines={1}>
            {name || slicedAddress}
          </Text>
          <Text sm medium secondary numberOfLines={1}>
            {slicedAddress}
          </Text>
        </View>
      </View>
      {rightElement ||
        (showDots && (
          <Icon.DotsHorizontal
            size={24}
            color={themeColors.foreground.secondary}
          />
        ))}
    </TouchableOpacity>
  );
}; 