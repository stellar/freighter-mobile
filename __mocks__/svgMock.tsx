import React from "react";
import { Pressable, View, ViewStyle } from "react-native";
import { SvgProps } from "react-native-svg";

const SvgMock = "SvgMock";

/**
 * Stands in for an imported SVG.
 *
 * `testID` and `onPress` are forwarded rather than dropped: icons are real
 * interactive elements (a copy button is an `Icon` with an `onPress`), and a
 * mock that swallows them makes those presses untestable. Icons that pass no
 * `testID` keep the shared `SvgMock` id, and a non-interactive icon still
 * renders a plain `View`, so existing queries resolve unchanged.
 */
const MockedSvg: React.FC<SvgProps> = ({
  width,
  height,
  style,
  testID,
  onPress,
}) => {
  const resolvedStyle = [
    { width: Number(width), height: Number(height) },
    style as ViewStyle,
  ];

  if (onPress) {
    return (
      <Pressable
        testID={testID ?? SvgMock}
        onPress={onPress}
        style={resolvedStyle}
      />
    );
  }

  return <View testID={testID ?? SvgMock} style={resolvedStyle} />;
};

export default MockedSvg;
