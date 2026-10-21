import React from "react";
import { View, ViewStyle } from "react-native";
import { SvgProps } from "react-native-svg";

const SvgMock = "SvgMock";

/**
 * Stands in for an imported .svg. `color`, `strokeWidth` and `testID` are
 * forwarded rather than dropped: the real svg paints its strokes with
 * `color` at `strokeWidth`, so a test that cannot see them cannot check what
 * an Icon resolved to. `strokeWidth` is forwarded only when given, so a test
 * can tell "unset" from "set to undefined". `testID` falls back to "SvgMock"
 * so tests that query the mock generically keep working.
 */
const MockedSvg: React.FC<SvgProps> = ({
  width,
  height,
  style,
  color,
  testID,
  ...rest
}) => (
  <View
    testID={testID ?? SvgMock}
    style={[
      { width: Number(width), height: Number(height) },
      style as ViewStyle,
    ]}
    {...({ color } as { color?: SvgProps["color"] })}
    {...(("strokeWidth" in rest ? { strokeWidth: rest.strokeWidth } : {}) as {
      strokeWidth?: SvgProps["strokeWidth"];
    })}
  />
);

export default MockedSvg;
