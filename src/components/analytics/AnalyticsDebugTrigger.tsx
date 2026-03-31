import Icon from "components/sds/Icon";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity } from "react-native";

interface AnalyticsDebugTriggerProps {
  onPress: () => void;
}

export const AnalyticsDebugTrigger: React.FC<AnalyticsDebugTriggerProps> = ({
  onPress,
}) => {
  const { themeColors } = useColors();

  // Only render in development mode
  if (!__DEV__) {
    return null;
  }

  return (
    <TouchableOpacity
      testID="analytics-debug-trigger"
      onPress={onPress}
      className="absolute bottom-4 right-4 z-50 w-16 h-16 rounded-full items-center justify-center bg-black border border-purple-900"
    >
      <Icon.Terminal color={themeColors.primary} />
    </TouchableOpacity>
  );
};
