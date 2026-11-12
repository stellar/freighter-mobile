import React from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

/**
 * The Earn intro's ambient glow is a #6AF17F circle of radius 200.5 at 15%
 * fill opacity, under an SVG `feGaussianBlur` of stdDeviation 100. Shipping
 * that node as an asset renders as a hard-edged disc on device --
 * react-native-svg parses the filter but does not apply it -- so the blur is
 * reproduced as the radial falloff it mathematically is.
 *
 * A disc convolved with a 2D Gaussian has a closed-form radial profile,
 * `I(d) = 1/s^2 * integral(0..R) exp(-(d^2+p^2)/2s^2) * I0(d*p/s^2) * p dp`,
 * normalised so an infinite plane is 1. The stops below are that profile
 * sampled at R=200.5, s=100. Two consequences are easy to get wrong by eye and
 * are why the numbers are computed rather than hand-tuned:
 *
 * - Peak opacity is 0.87, not 1. Because the blur radius is comparable to the
 *   circle's own (100 vs 200.5), even the center pixel loses some of its
 *   weight to the transparent surround.
 * - The gradient's radius is 560, not the circle's 200.5. The falloff is still
 *   at ~1.5% at 400, so stopping earlier leaves a faint circular seam; 560 is
 *   where it reaches ~0.01%.
 *
 * The design uses the same color and opacity in light and dark, so the glow
 * does not follow the theme.
 */
const GLOW_COLOR = "#6AF17F";
const GLOW_OPACITY = 0.15;
const GLOW_RADIUS = 560;
const GLOW_SIZE = GLOW_RADIUS * 2;

/** The sampled profile: [gradient offset, opacity at that offset]. */
const GLOW_STOPS: Array<[string, number]> = [
  ["0", 0.866],
  ["0.1", 0.8238],
  ["0.2", 0.7],
  ["0.3", 0.5146],
  ["0.4", 0.3152],
  ["0.5", 0.1557],
  ["0.6", 0.0605],
  ["0.7", 0.0181],
  ["0.8", 0.0041],
  ["0.9", 0.0007],
  ["1", 0],
];

export interface EarnGlowProps {
  /**
   * Y coordinate of the glow's center, in points from the top of the screen.
   * The glow is always horizontally centered.
   */
  centerY: number;
}

/**
 * Blurred green ambient glow behind the Earn intro.
 *
 * `pointerEvents="none"` because the gradient's box is far larger than its
 * visible falloff and would otherwise swallow taps on whatever it overlaps.
 */
export const EarnGlow: React.FC<EarnGlowProps> = ({ centerY }) => (
  <View
    pointerEvents="none"
    className="absolute left-1/2"
    style={{ top: centerY - GLOW_RADIUS, marginLeft: -GLOW_RADIUS }}
    testID="earn-glow"
  >
    <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
      <Defs>
        <RadialGradient id="earnGlow" cx="50%" cy="50%" r="50%">
          {GLOW_STOPS.map(([offset, stopOpacity]) => (
            <Stop
              key={offset}
              offset={offset}
              stopColor={GLOW_COLOR}
              stopOpacity={stopOpacity * GLOW_OPACITY}
            />
          ))}
        </RadialGradient>
      </Defs>
      <Circle
        cx={GLOW_RADIUS}
        cy={GLOW_RADIUS}
        r={GLOW_RADIUS}
        fill="url(#earnGlow)"
      />
    </Svg>
  </View>
);

export default EarnGlow;
