import React from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

/**
 * The Earn designs' ambient glow is a solid #11351E circle of radius 132
 * under an SVG `feGaussianBlur` of stdDeviation 100. Shipping that node as an
 * asset renders as a hard-edged disc on device -- react-native-svg parses the
 * filter but does not apply it -- so the blur is reproduced as the radial
 * falloff it mathematically is.
 *
 * A disc convolved with a 2D Gaussian has a closed-form radial profile,
 * `I(d) = 1/s^2 * integral(0..R) exp(-(d^2+p^2)/2s^2) * I0(d*p/s^2) * p dp`,
 * normalised so an infinite plane is 1. The stops below are that profile
 * sampled at R=132, s=100. Two consequences are easy to get wrong by eye and
 * are why the numbers are computed rather than hand-tuned:
 *
 * - Peak opacity is 0.58, not 1. Because the blur radius is comparable to the
 *   circle's own (100 vs 132), even the center pixel loses most of its weight
 *   to the transparent surround; painting the center at full opacity would
 *   make the glow markedly heavier than the design.
 * - The gradient's radius is 460, not the source node's 332. The falloff is
 *   still at ~1.2% opacity at 332, so stopping there leaves a faint but
 *   visible circular seam; 460 is where it reaches ~0.02%.
 */
const GLOW_COLOR = "#11351E";
const GLOW_RADIUS = 460;
const GLOW_SIZE = GLOW_RADIUS * 2;

/** The sampled profile: [gradient offset, opacity at that offset]. */
const GLOW_STOPS: Array<[string, number]> = [
  ["0", 0.5816],
  ["0.1", 0.5441],
  ["0.2", 0.4445],
  ["0.29", 0.3282],
  ["0.36", 0.2384],
  ["0.43", 0.1603],
  ["0.5", 0.0995],
  ["0.58", 0.052],
  ["0.7", 0.0159],
  ["0.85", 0.0025],
  ["1", 0],
];

export interface EarnGlowProps {
  /**
   * Y coordinate of the glow's center, in points from the top of the screen,
   * taken straight from the Figma frame (both frames are 402 wide, so the
   * glow is always horizontally centered).
   */
  centerY: number;
  /**
   * The source circle's own `fill-opacity`, which differs per frame (the
   * intro's is 1, the picker's 0.7). Multiplies the whole profile.
   */
  opacity?: number;
}

/**
 * Blurred green ambient glow shared by the Earn screens.
 *
 * `pointerEvents="none"` because the gradient's box is far larger than its
 * visible falloff and would otherwise swallow taps on whatever it overlaps.
 */
export const EarnGlow: React.FC<EarnGlowProps> = ({ centerY, opacity = 1 }) => (
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
              stopOpacity={stopOpacity * opacity}
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
