import HighSignal from "assets/icons/high-signal.svg";
import LowSignal from "assets/icons/low-signal.svg";
import MediumSignal from "assets/icons/medium-signal.svg";
import { NetworkCongestion } from "config/types";
import React from "react";
import { View } from "react-native";

type NetworkCongestionIndicatorProps = {
  level: NetworkCongestion;
  size?: number;
  testID?: string;
};

export const NetworkCongestionIndicator: React.FC<
  NetworkCongestionIndicatorProps
> = ({ level, size = 16, testID }) => {
  const getSignalIcon = () => {
    switch (level) {
      case NetworkCongestion.LOW:
        return <LowSignal width={size} height={size} />;
      case NetworkCongestion.MEDIUM:
        return <MediumSignal width={size} height={size} />;
      case NetworkCongestion.HIGH:
        return <HighSignal width={size} height={size} />;
      default:
        return <LowSignal width={size} height={size} />;
    }
  };

  return <View testID={testID}>{getSignalIcon()}</View>;
};
