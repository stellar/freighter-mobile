import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { Pressable, View } from "react-native";

const RADIO_SIZE = 16;
// Figma's checked radio is a filled circle with a white dot of half its size.
const DOT_SIZE = 8;

export interface RadioButtonProps {
  checked: boolean;
  onPress: () => void;
  label: string;
  testID?: string;
}

/**
 * A round radio with its label; the whole row selects it. Checked, it fills
 * with Varial Blue (lilac 9) around a white dot, matching Checkbox's checked
 * fill (Figma "Checkbox", type Radio).
 */
export const RadioButton: React.FC<RadioButtonProps> = ({
  checked,
  onPress,
  label,
  testID,
}) => {
  const { themeColors } = useColors();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      className="flex-row items-center gap-[8px]"
    >
      <View>
        <View
          className="items-center justify-center"
          style={{
            width: RADIO_SIZE,
            height: RADIO_SIZE,
            borderRadius: RADIO_SIZE / 2,
            backgroundColor: checked
              ? themeColors.lilac[9]
              : themeColors.background.primary,
            borderWidth: checked ? 0 : 1,
            borderColor: themeColors.border.primary,
          }}
        >
          {checked && (
            <View
              style={{
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: DOT_SIZE / 2,
                backgroundColor: themeColors.white,
              }}
            />
          )}
        </View>
      </View>
      <Text md semiBold>
        {label}
      </Text>
    </Pressable>
  );
};
