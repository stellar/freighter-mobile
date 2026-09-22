import React from "react";
import { View, ViewStyle } from "react-native";
import { SvgProps } from "react-native-svg";

const SvgMock = "SvgMock";

/**
 * Stands in for an imported .svg. `color` and `testID` are forwarded rather
 * than dropped: the real svg paints its strokes with `color`, so a test that
 * cannot see it cannot check what an Icon resolved to. `testID` falls back to
 * "SvgMock" so tests that query the mock generically keep working.
 */
const MockedSvg: React.FC<SvgProps> = ({
  width,
  height,
  style,
  color,
  testID,
}) => (
  <View
    testID={testID ?? SvgMock}
    style={[
      { width: Number(width), height: Number(height) },
      style as ViewStyle,
    ]}
    {...({ color } as { color?: SvgProps["color"] })}
  />
);

export default MockedSvg;
