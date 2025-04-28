import { colors } from "config/colors";
import React from "react";
import { View } from "react-native";

type CongestionLevel = "low" | "medium" | "high";

type BarConfig = {
  width: number;
  height: number;
  borderRadius: number;
};

type NetworkCongestionIndicatorProps = {
  level: CongestionLevel;
  size?: number;
  barConfig?: {
    small: BarConfig;
    medium: BarConfig;
    large: BarConfig;
  };
};

const DEFAULT_BAR_CONFIG = {
  small: {
    width: 4,
    height: 8,
    borderRadius: 32,
  },
  medium: {
    width: 4,
    height: 12,
    borderRadius: 32,
  },
  large: {
    width: 4,
    height: 16,
    borderRadius: 32,
  },
};

const getBarHeights = (level: CongestionLevel) => {
  switch (level) {
    case "low":
      return [1, 0, 0];
    case "medium":
      return [1, 1, 0];
    case "high":
      return [1, 1, 1];
    default:
      return [1, 0, 0];
  }
};

const getBarConfig = (index: number, barConfig: typeof DEFAULT_BAR_CONFIG) => {
  if (index === 0) return barConfig.small;
  if (index === 1) return barConfig.medium;
  return barConfig.large;
};

const getCongestionColor = (level: CongestionLevel) => {
  switch (level) {
    case "low":
      return colors.dark.status.success;
    case "medium":
      return colors.dark.lime[10];
    case "high":
      return colors.dark.status.error;
    default:
      return colors.dark.status.success;
  }
};

export const NetworkCongestionIndicator: React.FC<NetworkCongestionIndicatorProps> = ({
  level,
  size = 16,
  barConfig = DEFAULT_BAR_CONFIG,
}) => {
  const barHeights = getBarHeights(level);
  const barSpacing = barConfig.small.width / 2;
  const activeColor = getCongestionColor(level);

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: size }}>
      {barHeights.map((height, i) => {
        const config = getBarConfig(i, barConfig);
        const barId = `bar-${level}-${i}`;
        return (
          <View
            key={barId}
            style={{
              width: config.width,
              height: config.height,
              backgroundColor: height ? activeColor : colors.dark.foreground.primary,
              marginRight: i < barHeights.length - 1 ? barSpacing : 0,
              borderRadius: config.borderRadius,
            }}
          />
        );
      })}
    </View>
  );
}; 