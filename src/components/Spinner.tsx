import { THEME } from "config/theme";
import React from "react";
import { ActivityIndicator } from "react-native";

interface SpinnerProps {
  size?: "small" | "large";
  color?: string;
  testID?: string;
}

const Spinner: React.FC<SpinnerProps> = ({
  size = "large",
  color = THEME.colors.secondary,
  testID,
}) => <ActivityIndicator size={size} color={color} testID={testID} />;

export default Spinner;
