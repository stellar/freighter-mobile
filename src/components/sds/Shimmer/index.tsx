import {
  Canvas,
  Group,
  LinearGradient,
  Rect,
  RoundedRect,
  rrect,
  rect,
  vec,
} from "@shopify/react-native-skia";
import { useShimmerClock, shimmerProgress } from "components/sds/Shimmer/clock";
import useColors from "hooks/useColors";
import useIsReduceMotionEnabled from "hooks/useIsReduceMotionEnabled";
import React from "react";
import { useColorScheme, View } from "react-native";
import { useDerivedValue } from "react-native-reanimated";

export enum ShimmerVariant {
  Pill = "pill",
  Hairline = "hairline",
}

export interface ShimmerProps {
  width: number;
  height: number;
  /** Corner radius. Pills default to 8; the hairline passes 0. */
  radius?: number;
  variant?: ShimmerVariant;
  testID?: string;
}

export const SHIMMER_PILL_RADIUS = 8;

/** The frames draw the highlight white in both themes. */
const HIGHLIGHT = "#ffffff";
/** Alpha hex for the five stops: 0 / 3 / 7 / 3 / 0 percent, hairline 0 / 8 / 15 / 8 / 0. */
const PILL_STOPS = ["00", "08", "12", "08", "00"];
// Light pills fade white to gray 5, where 7% white disappears; 60% reads.
const LIGHT_PILL_STOPS = ["00", "4D", "99", "4D", "00"];
const HAIRLINE_STOPS = ["00", "14", "26", "14", "00"];
const STOP_POSITIONS = [0, 0.3, 0.5, 0.7, 1];

/**
 * A loading placeholder: a rounded base gradient with a white highlight
 * sweeping across it on the shared clock. Decorative — the element that owns
 * the area announces the loading state. Skia draws both inside the rounded
 * shape, so nothing relies on `overflow: hidden`.
 */
const Shimmer: React.FC<ShimmerProps> = ({
  width,
  height,
  radius = SHIMMER_PILL_RADIUS,
  variant = ShimmerVariant.Pill,
  testID,
}) => {
  const { themeColors } = useColors();
  const isDark = useColorScheme() === "dark";
  const isReduceMotionEnabled = useIsReduceMotionEnabled();
  useShimmerClock(!isReduceMotionEnabled);

  // −width → +width across the sweep; held at +width through the hold.
  const transform = useDerivedValue(() => [
    { translateX: -width + shimmerProgress.value * 2 * width },
  ]);

  let baseColors: string[];
  if (variant === ShimmerVariant.Hairline) {
    baseColors = [themeColors.border.primary, themeColors.border.primary];
  } else if (isDark) {
    baseColors = [themeColors.gray[5], themeColors.base[0]];
  } else {
    baseColors = [themeColors.base[0], themeColors.gray[5]];
  }
  const pillStops = isDark ? PILL_STOPS : LIGHT_PILL_STOPS;
  const stops =
    variant === ShimmerVariant.Hairline ? HAIRLINE_STOPS : pillStops;
  const highlightColors = stops.map((alpha) => `${HIGHLIGHT}${alpha}`);

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height }}
    >
      {width > 0 && height > 0 && (
        <Canvas style={{ width, height }}>
          <Group clip={rrect(rect(0, 0, width, height), radius, radius)}>
            <RoundedRect x={0} y={0} width={width} height={height} r={radius}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(width, 0)}
                colors={baseColors}
              />
            </RoundedRect>
            {!isReduceMotionEnabled && (
              <Group transform={transform}>
                <Rect x={0} y={0} width={width} height={height}>
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec(width, 0)}
                    colors={highlightColors}
                    positions={STOP_POSITIONS}
                  />
                </Rect>
              </Group>
            )}
          </Group>
        </Canvas>
      )}
    </View>
  );
};

export default Shimmer;
