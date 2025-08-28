import { Text } from "components/sds/Typography";
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
        <Text semiBold textAlign="center">
          {word}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
