import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React, { useEffect, useState } from "react";
import { LayoutChangeEvent, TouchableOpacity, View } from "react-native";

interface TabOption {
  label: string;
  value: string | number;
}

interface TabsProps {
  options: TabOption[];
  selectedValue: string | number;
  onValueChange: (value: string | number) => void;
  /**
   * "hug" (default): container wraps its content and every tab shares the width
   * of the widest tab. "fill": container spans the full available width and
   * tabs share it equally.
   */
  sizing?: "hug" | "fill";
  /** Fixed total width in px. Overrides `sizing`; tabs fill it equally. */
  width?: number;
  disabled?: boolean;
  testID?: string;
}

/**
 * Tabs Component
 *
 * A segmented tab control that lets users pick one option from a set. The
 * selected tab is highlighted with a rounded pill inset within the rounded
 * container. Supports three sizing modes: hug-content (default), full-width,
 * and a fixed width.
 */
const Tabs: React.FC<TabsProps> = ({
  options,
  selectedValue,
  onValueChange,
  sizing = "hug",
  width,
  disabled = false,
  testID,
}) => {
  const { themeColors } = useColors();

  const hasFixedWidth = typeof width === "number";
  // Fixed width and fill both stretch tabs equally via flex-1; only "hug" sizes
  // tabs to their labels.
  const tabsFill = hasFixedWidth || sizing === "fill";
  const isHug = !tabsFill;

  // In hug mode every pill matches the widest pill so the tabs read as a
  // consistent set. We measure each pill's natural width and grow them all to
  // the largest via minWidth. minWidth only ever increases a width, so this
  // converges after a single extra layout pass rather than looping.
  const [maxTabWidth, setMaxTabWidth] = useState(0);

  // Reset the measured width whenever the tab set changes so widths can shrink
  // to fit new labels instead of staying stuck at a previous maximum.
  const labelsKey = options.map((option) => option.label).join("|");
  useEffect(() => {
    setMaxTabWidth(0);
  }, [labelsKey, isHug]);

  const handleTabLayout = (event: LayoutChangeEvent) => {
    const { width: tabWidth } = event.nativeEvent.layout;
    setMaxTabWidth((prev) => (tabWidth > prev ? tabWidth : prev));
  };

  // Hug mode needs one layout pass to learn the widest pill. Until it does, the
  // pills would paint at their natural (unequal) widths and then snap wider — a
  // visible glitch. opacity does not affect layout, so we keep the pills laid
  // out and measurable but hidden for that single frame, then reveal them
  // already equalized. Non-hug modes have nothing to measure and paint at once.
  const isMeasured = !isHug || maxTabWidth > 0;

  const containerWidthClass = (() => {
    if (hasFixedWidth) return "";
    return sizing === "fill" ? "w-full" : "self-start";
  })();

  return (
    <View
      testID={testID}
      style={hasFixedWidth ? { width } : undefined}
      className={`bg-background-tertiary rounded-3xl p-2 flex-row gap-2 ${containerWidthClass} ${
        isMeasured ? "" : "opacity-0"
      }`}
    >
      {options.map((option) => {
        const isSelected = option.value === selectedValue;

        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => !disabled && onValueChange(option.value)}
            onLayout={isHug ? handleTabLayout : undefined}
            disabled={disabled}
            style={
              isHug && maxTabWidth > 0 ? { minWidth: maxTabWidth } : undefined
            }
            className={`rounded-2xl py-2 px-4 items-center justify-center ${
              tabsFill ? "flex-1" : ""
            } ${isSelected ? "bg-lilac-4" : ""}`}
          >
            <Text
              md
              semiBold={isSelected}
              medium={!isSelected}
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

export default Tabs;
