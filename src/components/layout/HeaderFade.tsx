import { ColorScheme, DEFAULT_COLOR_SCHEME } from "config/theme";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import React, { useId } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/**
 * Figma's Top, the header Home's content scrolls up under (light
 * ?node-id=3705-77862, dark ?node-id=3272-113092). Its 140pt frame is filled
 * with the page color down to `solidTo` of its height, fading to clear at
 * `clearAt`; past 1 means it's still faintly there at the bottom edge.
 */
const FIGMA_HEADER_HEIGHT = 140;
const FIGMA_FADES: Record<ColorScheme, { solidTo: number; clearAt: number }> = {
  light: { solidTo: 0.82571, clearAt: 1.0321 },
  dark: { solidTo: 0.80714, clearAt: 0.93214 },
};

/**
 * The fade's strip and its gradient stops, from Figma's fill. The tabs' rows
 * are 32pt rather than Figma's 40, so the strip keeps Figma's distance from
 * the bottom edge instead of its share of the height.
 */
const getHeaderFade = (scheme: ColorScheme) => {
  const { solidTo, clearAt } = FIGMA_FADES[scheme];
  const span = 1 - solidTo;

  return {
    height: span * FIGMA_HEADER_HEIGHT,
    stops:
      clearAt >= 1
        ? [
            { offset: 0, opacity: 1 },
            { offset: 1, opacity: (clearAt - 1) / (clearAt - solidTo) },
          ]
        : [
            { offset: 0, opacity: 1 },
            { offset: (clearAt - solidTo) / span, opacity: 0 },
            { offset: 1, opacity: 0 },
          ],
  };
};

/**
 * The background of a main tab's header (Home, History, Discover): the page
 * color, fading out over its last points so content scrolling up dissolves
 * under it. It fills its parent, so the header sets the height. Figma also
 * blurs the light one by 1pt, too little to see, so it's left out.
 */
export const HeaderFade: React.FC = () => {
  const { themeColors } = useColors();
  const scheme = useColorScheme() ?? DEFAULT_COLOR_SCHEME;
  const { height, stops } = getHeaderFade(scheme);
  const color = themeColors.base[0];
  const gradientId = `header-fade-${useId().replace(/:/g, "")}`;

  return (
    <View
      testID="header-fade"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      <View
        testID="header-fade-solid"
        style={{ flex: 1, backgroundColor: color }}
      />
      <View testID="header-fade-strip" style={{ height: pxValue(height) }}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              {stops.map(({ offset, opacity }) => (
                <Stop
                  key={offset}
                  offset={offset}
                  stopColor={color}
                  stopOpacity={opacity}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      </View>
    </View>
  );
};
