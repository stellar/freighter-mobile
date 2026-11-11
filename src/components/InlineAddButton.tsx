import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity } from "react-native";

interface InlineAddButtonProps {
  /** Label shown next to the plus icon, and the button's accessibility label */
  label: string;
  /** Called when the button is pressed */
  onPress: () => void;
  /** When true, the button is dimmed and does not respond to presses */
  disabled?: boolean;
  /** Optional testID for the touchable */
  testID?: string;
}

/**
 * InlineAddButton
 *
 * The "+ Add token" / "+ Add collectible" action that ends a Home list and
 * scrolls with it (Figma 760:33267): a full-width, 44pt tall, fully rounded
 * button with no fill, an 18pt plus in Gray/9 and a Text/MD/600 label in
 * primary text, 4pt apart.
 *
 * The sizes are arbitrary-value classes because NativeWind's rem is 14 here:
 * `h-11` would come out at 38.5pt, not 44.
 */
export const InlineAddButton: React.FC<InlineAddButtonProps> = ({
  label,
  onPress,
  disabled = false,
  testID,
}) => {
  const { themeColors } = useColors();

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      activeOpacity={0.8}
      className={`h-[44px] w-full flex-row items-center justify-center gap-[4px] rounded-full px-[16px] ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <Icon.Plus size={18} strokeWidth={2} color={themeColors.gray[9]} />
      <Text md semiBold>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export default InlineAddButton;
