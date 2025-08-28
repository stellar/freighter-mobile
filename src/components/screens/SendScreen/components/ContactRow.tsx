import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PRESS_DELAY } from "config/constants";
import { truncateAddress } from "helpers/stellar";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface ContactRowProps {
  address: string;
  name?: string;
  onPress?: () => void;
  onDotsPress?: () => void;
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
  onDotsPress,
  rightElement,
  className,
  testID,
}) => {
  const { themeColors } = useColors();
  const slicedAddress = truncateAddress(address, 4, 4);

  const renderPlusIcon = () => (
    <View className="w-[40px] h-[40px] rounded-full border justify-center items-center mr-4 bg-gray-3 border-gray-6 p-[7.5px]">
      <Icon.Plus size={25} themeColor="gray" />
    </View>
  );

  const renderContent = () => {
    if (!address) {
      return (
        <View className="flex-row items-center gap-16px">
          {renderPlusIcon()}
          <View className="flex-col flex-1">
            <Text>Send to</Text>
            <Text sm secondary>
              Choose recipient
            </Text>
          </View>
        </View>
      );
    }

    return (
      <>
        <Avatar size="lg" publicAddress={address} />
        <View className="flex-col ml-4 flex-1">
          <Text medium numberOfLines={1}>
            {name || slicedAddress}
          </Text>
          <Text sm medium secondary numberOfLines={1}>
            {slicedAddress}
          </Text>
        </View>
      </>
    );
  };

  return (
    <TouchableOpacity
      className={`flex-row w-full h-[44px] justify-between items-center ${className || ""}`}
      onPress={onPress}
      delayPressIn={DEFAULT_PRESS_DELAY}
      testID={testID}
    >
      <View className="flex-row items-center flex-1 mr-4">
        {renderContent()}
      </View>
      {rightElement ||
        (onDotsPress && (
          <Icon.DotsHorizontal
            color={themeColors.foreground.secondary}
            onPress={onDotsPress}
          />
        ))}
    </TouchableOpacity>
  );
};
