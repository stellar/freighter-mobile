import React from "react";
import { Pressable, View, ViewStyle } from "react-native";
import { SvgProps } from "react-native-svg";

const SvgMock = "SvgMock";

/**
 * Stands in for an imported .svg.
 *
 * `color`, `strokeWidth` and `testID` are forwarded rather than dropped: the
 * real svg paints its strokes with `color` at `strokeWidth`, so a test that
 * cannot see them cannot check what an Icon resolved to. `strokeWidth` is
 * forwarded only when given, so a test can tell "unset" from "set to
 * undefined". `testID` falls back to "SvgMock" so tests that query the mock
 * generically keep working.
 *
 * `onPress` is forwarded too: icons are real interactive elements (a copy
 * button is an `Icon` with an `onPress`), and a mock that swallows it makes
 * those presses untestable. A non-interactive icon still renders a plain
 * `View`, so existing queries resolve unchanged.
 */
const MockedSvg: React.FC<SvgProps> = ({
  width,
  height,
  style,
  color,
  testID,
  onPress,
  ...rest
}) => {
  const forwardedProps = {
    testID: testID ?? SvgMock,
    style: [
      { width: Number(width), height: Number(height) },
      style as ViewStyle,
    ],
    ...({ color } as { color?: SvgProps["color"] }),
    ...(("strokeWidth" in rest ? { strokeWidth: rest.strokeWidth } : {}) as {
      strokeWidth?: SvgProps["strokeWidth"];
    }),
  };

  if (onPress) {
    return <Pressable onPress={onPress} {...forwardedProps} />;
  }

  return <View {...forwardedProps} />;
};

export default MockedSvg;
