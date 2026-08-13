import { IconProps } from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity } from "react-native";

const ICON_SIZE = 24;

interface HomeActionButtonProps {
  Icon: React.FC<IconProps>;
  title: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

/**
 * Action card used on the Home screen's Add / Send / Swap row: a flexible
 * rounded rectangle with a lilac icon over a secondary label.
 */
export const HomeActionButton: React.FC<HomeActionButtonProps> = ({
  Icon: IconComponent,
  title,
  onPress,
  disabled = false,
  testID,
}) => {
  const { themeColors } = useColors();

  return (
    <TouchableOpacity
      className={`flex-1 h-[84px] rounded-[16px] bg-background-tertiary items-center justify-center gap-[8px] ${
        disabled ? "opacity-50" : ""
      }`}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
    >
      <IconComponent size={ICON_SIZE} color={themeColors.lilac[11]} />
      <Text sm medium secondary>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

export default HomeActionButton;
