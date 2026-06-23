import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface SegmentedControlOption {
  label: string;
  value: string | number;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  selectedValue: string | number;
  onValueChange: (value: string | number) => void;
  disabled?: boolean;
}

/**
 * SegmentedControl Component
 *
 * A segmented control component that allows users to select from multiple options
 * in a button group style interface, following the design system patterns.
 *
 * @param {SegmentedControlProps} props - Component props
 * @returns {JSX.Element} The rendered component
 */
const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  selectedValue,
  onValueChange,
  disabled = false,
}) => {
  const { themeColors } = useColors();

  return (
    <View className="flex-row gap-2 w-full">
      {options.map((option) => {
        const isSelected = option.value === selectedValue;

        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => !disabled && onValueChange(option.value)}
            disabled={disabled}
            className={`flex-1 items-center justify-center rounded-md px-[10px] py-[6px] ${
              isSelected ? "bg-lilac-4" : ""
            }`}
          >
            <Text
              sm
              semiBold
              textAlign="center"
              color={
                isSelected ? themeColors.lilac[11] : themeColors.text.secondary
              }
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default SegmentedControl;
