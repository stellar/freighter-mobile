import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { truncateAddress } from "helpers/formatAddress";
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
  testID?: string;
}

/**
 * Component to display a contact/address row with avatar and address
 *
 * @param {ContactRowProps} props - Component props
 * @returns {JSX.Element} The rendered component
 */
export const ContactRow: React.FC<ContactRowProps> = ({
  address,
  name,
  onPress,
  showDots = true,
  rightElement,
  className,
  testID,
}) => {
  const { themeColors } = useColors();
  const slicedAddress = truncateAddress(address, 4, 4);

  return (
    <TouchableOpacity
      className={`flex-row w-full h-[44px] justify-between items-center ${className || ""}`}
      onPress={onPress}
      testID={testID}
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
