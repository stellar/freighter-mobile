import React from "react";
import { View, ViewStyle } from "react-native";
import { SvgProps } from "react-native-svg";

const SvgMock = "SvgMock";
const MockedSvg: React.FC<SvgProps> = ({ width, height, style }) => (
  <View
    testID={SvgMock}
    style={[
      { width: Number(width), height: Number(height) },
      style as ViewStyle,
    ]}
  />
);

export default MockedSvg;
