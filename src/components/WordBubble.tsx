import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

type WordBubbleSize = "sm" | "md" | "lg";

interface WordBubbleProps {
  word: string;
  isSelected: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  size?: WordBubbleSize;
}

export const WordBubble: React.FC<WordBubbleProps> = ({
  word,
  isSelected,
  onPress,
  disabled = false,
  testID,
  size = "md",
}) => {
  const { themeColors } = useColors();

  const getSizeClasses = () => {
    const map: Record<WordBubbleSize, string> = {
      sm: "px-3 py-2",
      md: "px-3 py-2",
      lg: "px-4 py-2.5",
    };

    return map[size];
  };

  const containerClasses = `rounded-full ${getSizeClasses()} ${
    isSelected ? "bg-lilac-9" : "bg-gray-4 "
  }`;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.8}
    >
      <View className={`${containerClasses}`}>
        {/* The brand color fills the selected bubble in both schemes, so its
        label is white in both: the default text color is near-black on a light
        device and would not read well on blue. */}
        <Text
          semiBold
          textAlign="center"
          color={isSelected ? themeColors.white : undefined}
        >
          {word}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
