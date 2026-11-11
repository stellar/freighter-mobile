import useTheme from "hooks/useTheme";
import React from "react";
import { ActivityIndicator } from "react-native";

interface SpinnerProps {
  size?: "small" | "large";
  color?: string;
  testID?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ size = "large", color, testID }) => {
  const theme = useTheme();
  // Resolved here rather than as a parameter default, which cannot call a hook.
  const resolvedColor = color ?? theme.colors.secondary;

  return (
    <ActivityIndicator size={size} color={resolvedColor} testID={testID} />
  );
};

export default Spinner;
