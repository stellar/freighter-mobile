import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity } from "react-native";

interface FloatingTabActionButtonProps {
  /** Label shown next to the plus icon */
  label: string;
  /** Called when the pill is pressed */
  onPress: () => void;
  /** When true, the pill is dimmed and does not respond to presses */
  disabled?: boolean;
  /** Optional testID for the touchable */
  testID?: string;
}

/**
 * FloatingTabActionButton
 *
 * A dark, centered, rounded-full "pill" with a leading plus icon and a label.
 * Presentational only: the caller is responsible for absolute positioning
 * (e.g. anchoring it above the bottom tab bar).
 */
export const FloatingTabActionButton: React.FC<
  FloatingTabActionButtonProps
> = ({ label, onPress, disabled = false, testID }) => {
  const { themeColors } = useColors();

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      className={`flex-row items-center gap-1 self-center px-5 py-3 rounded-full bg-background-tertiary border border-border-primary ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <Icon.Plus size={18} color={themeColors.foreground.primary} />
      <Text semiBold>{label}</Text>
    </TouchableOpacity>
  );
};

export default FloatingTabActionButton;
