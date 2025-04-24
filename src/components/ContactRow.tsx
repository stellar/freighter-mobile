import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface ContactRowProps {
  address: string;
  name?: string;
  onPress?: () => void;
}

export const ContactRow: React.FC<ContactRowProps> = ({
  address,
  name,
  onPress,
}) => {
  const slicedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <View className="flex-row w-full h-[44px] justify-between items-center mb-[24px]">
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
      <TouchableOpacity onPress={onPress}>
        <Icon.DotsHorizontal
          size={24}
          color={THEME.colors.foreground.secondary}
        />
      </TouchableOpacity>
    </View>
  );
};
