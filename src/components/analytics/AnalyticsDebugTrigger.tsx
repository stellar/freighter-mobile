import { Text } from "components/sds/Typography";
import React from "react";
import { TouchableOpacity } from "react-native";

interface AnalyticsDebugTriggerProps {
  onPress: () => void;
}

export const AnalyticsDebugTrigger: React.FC<AnalyticsDebugTriggerProps> = ({
  onPress,
}) => {
  // Only render in development mode
  if (!__DEV__) {
    return null;
  }

  return (
    <TouchableOpacity
      testID="analytics-debug-trigger"
      onPress={onPress}
      className="absolute bottom-4 right-4 z-50 w-12 h-12 rounded-full items-center justify-center bg-black/80 border border-gray-700"
    >
      <Text md>📊</Text>
    </TouchableOpacity>
  );
};
