import HighSignal from "assets/icons/high-signal.svg";
import LowSignal from "assets/icons/low-signal.svg";
import MediumSignal from "assets/icons/medium-signal.svg";
import React from "react";
import { View } from "react-native";

type CongestionLevel = "low" | "medium" | "high";

type NetworkCongestionIndicatorProps = {
  level: CongestionLevel;
  size?: number;
  testID?: string;
};

export const NetworkCongestionIndicator: React.FC<
  NetworkCongestionIndicatorProps
> = ({ level, size = 16, testID }) => {
  const getSignalIcon = () => {
    switch (level) {
      case "low":
        return <LowSignal width={size} height={size} />;
      case "medium":
        return <MediumSignal width={size} height={size} />;
      case "high":
        return <HighSignal width={size} height={size} />;
      default:
        return <LowSignal width={size} height={size} />;
    }
  };

  return <View testID={testID}>{getSignalIcon()}</View>;
};
