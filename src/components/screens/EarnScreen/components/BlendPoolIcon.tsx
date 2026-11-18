import blendIcon from "assets/logos/blend-icon.png";
import React from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

interface BlendPoolIconProps {
  /** Size and corner radius, which differ by placement. */
  className?: string;
  style?: StyleProp<ImageStyle>;
  testID?: string;
}

/** The Blend logo that stands for a pool across the Earn flow. */
export const BlendPoolIcon: React.FC<BlendPoolIconProps> = ({
  className,
  style,
  testID,
}) => (
  <Image
    source={blendIcon}
    className={className}
    style={style}
    resizeMode="cover"
    accessibilityIgnoresInvertColors
    testID={testID}
  />
);
