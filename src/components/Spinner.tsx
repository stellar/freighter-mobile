import { THEME } from "config/theme";
import React from "react";
import { ActivityIndicator } from "react-native";

interface SpinnerProps {
  size?: "small" | "large";
  color?: string;
}

const Spinner: React.FC<SpinnerProps> = ({
  size = "large",
  color = THEME.colors.secondary,
}) => <ActivityIndicator size={size} color={color} />;

export default Spinner;
