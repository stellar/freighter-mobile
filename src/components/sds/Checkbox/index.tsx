import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { Pressable, View } from "react-native";

const BOX_SIZE = 16;
const BOX_RADIUS = 4;
// Figma insets the check 12.5% on each side of the box.
const CHECK_SIZE = 12;
const CHECK_STROKE_WIDTH = 1.5;

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Sits beside the box; pressing it toggles the box too. */
  label: React.ReactNode;
  disabled?: boolean;
  testID?: string;
}

/**
 * A square checkbox with its label; the whole row toggles it.
 *
 * Checked, the box fills with Varial Blue (lilac 9) in both themes, with a
 * white check (import Set Password, ?node-id=2091-41929). Figma's light frame
 * fills it with the text ink; blue in both keeps the two themes consistent.
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  testID,
}) => {
  const { themeColors } = useColors();
  const checkedFill = themeColors.lilac[9];

  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      className="flex-row items-start gap-[8px]"
    >
      {/* Centres the box on the label's 22pt first line. */}
      <View className="pt-[3px]">
        <View
          testID={testID ? `${testID}-box` : undefined}
          className="items-center justify-center"
          style={{
            width: BOX_SIZE,
            height: BOX_SIZE,
            borderRadius: BOX_RADIUS,
            backgroundColor: checked
              ? checkedFill
              : themeColors.background.primary,
            borderWidth: checked ? 0 : 1,
            borderColor: themeColors.border.primary,
          }}
        >
          {checked && (
            <Icon.Check
              size={CHECK_SIZE}
              strokeWidth={CHECK_STROKE_WIDTH}
              color={themeColors.white}
            />
          )}
        </View>
      </View>
      <View className="flex-1">
        {typeof label === "string" ? (
          <Text sm secondary>
            {label}
          </Text>
        ) : (
          label
        )}
      </View>
    </Pressable>
  );
};
