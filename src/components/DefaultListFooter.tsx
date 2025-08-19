import React from "react";
import { View } from "react-native";

/**
 * DefaultListFooter Component
 *
 * A reusable footer component that provides consistent bottom spacing
 * for FlatLists throughout the app.
 *
 * @returns {JSX.Element} A View with consistent height for list footers
 */
export const DefaultListFooter: React.FC = React.memo(() => (
  <View className="h-10" />
));

DefaultListFooter.displayName = "DefaultListFooter";
