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
    <View className="bg-background-tertiary rounded-lg flex-row">
      {options.map((option, index) => {
        const isSelected = option.value === selectedValue;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;

        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => !disabled && onValueChange(option.value)}
            disabled={disabled}
            className={`flex-1 py-2 px-3 ${isSelected ? "bg-lilac-4" : ""} ${
              isFirst ? "rounded-l-lg" : ""
            } ${isLast ? "rounded-r-lg" : ""}`}
          >
            <Text
              md
              medium={isSelected}
              semiBold={!isSelected}
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
