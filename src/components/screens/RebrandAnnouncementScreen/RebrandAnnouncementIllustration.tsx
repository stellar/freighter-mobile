import { Canvas, Group, Rect, Shader, Skia } from "@shopify/react-native-skia";
import Sparkles from "assets/images/rebrand-announcement-sparkles.svg";
import Tile from "assets/images/rebrand-announcement-tile.svg";
import useColors from "hooks/useColors";
import useIsReduceMotionEnabled from "hooks/useIsReduceMotionEnabled";
import useTheme from "hooks/useTheme";
import React, { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/**
 * Design canvas of the Figma illustration (in design units). The layout box
 * is the glow disc itself, as the Illustration frame is in Figma, so the
 * heading's spacing matches the frame; the glow's blur tail and the sparkles
 * bleed 100 units above and below that box.
 */
const CANVAS = { width: 402, height: 452 } as const;
const GLOW_BLEED = 100;
const LAYOUT = { width: CANVAS.width, height: CANVAS.height - 2 * GLOW_BLEED };
const GLOW_BLEED_OFFSET = `${(-GLOW_BLEED / LAYOUT.height) * 100}%` as const;

/**
 * The glow, measured from Figma's render: a disc with a progressive blur,
 * hard-edged above its centre line and blurring toward the bottom. Neither
 * SVG nor a plain Skia blur can express that, so a shader evaluates the
 * blurred-disc profile per pixel with the blur width varying along y.
 */
const GLOW = {
  cx: 201,
  cy: 226,
  r: 126,
  opacity: 0.9,
  blurTop: 4,
  blurBottom: 34,
  /** Blur ramps from blurTop at the centre line to blurBottom here. */
  fadeEnd: 226 + 64,
} as const;

// A disc of `radius` blurred by a Gaussian of `sigma` has edge profile
// 0.5 * (1 - erf((d - radius) / (sigma * sqrt2))). erf via Abramowitz &
// Stegun 7.1.26 (max error 1.5e-7).
const GLOW_SHADER = `
uniform float2 center;
uniform float radius;
uniform float blurTop;
uniform float blurBottom;
uniform float fadeStart;
uniform float fadeEnd;
uniform float opacity;
uniform float3 color;

float erfApprox(float x) {
  float s = sign(x);
  x = abs(x);
  float t = 1.0 / (1.0 + 0.3275911 * x);
  float poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t;
  return s * (1.0 - poly * exp(-x * x));
}

half4 main(float2 p) {
  float d = distance(p, center);
  float k = clamp((p.y - fadeStart) / (fadeEnd - fadeStart), 0.0, 1.0);
  float sigma = mix(blurTop, blurBottom, k);
  float a = 0.5 * (1.0 - erfApprox((d - radius) / (sigma * 1.41421356)));
  a *= opacity;
  return half4(half3(color) * half(a), half(a));
}
`;

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    maxWidth: LAYOUT.width,
    aspectRatio: LAYOUT.width / LAYOUT.height,
  },
  bleed: {
    position: "absolute",
    left: 0,
    right: 0,
    top: GLOW_BLEED_OFFSET,
    bottom: GLOW_BLEED_OFFSET,
  },
});

/**
 * Tile motion, from the Figma keyframe export of the prototype: 2.5px down
 * from rest with a slight squash at the bottom, then back, on a 900ms loop.
 */
const BOUNCE = {
  distance: 2.5,
  squash: 0.008,
  down: { duration: 405, easing: Easing.bezier(0.4, 0, 0.7, 1) },
  up: { duration: 495, easing: Easing.bezier(0.2, 0, 0.4, 1) },
} as const;

const Glow = ({ color }: { color: string }) => {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width);
  const scale = width / CANVAS.width;

  // Compiled once per app run; null only where Skia cannot compile shaders
  // (the Jest mock), in which case the glow is simply absent.
  const effect = useMemo(() => {
    try {
      return Skia.RuntimeEffect.Make(GLOW_SHADER);
    } catch {
      return null;
    }
  }, []);

  const uniforms = useMemo(() => {
    const [r, g, b] = Skia.Color(color);

    return {
      center: [GLOW.cx, GLOW.cy],
      radius: GLOW.r,
      blurTop: GLOW.blurTop,
      blurBottom: GLOW.blurBottom,
      fadeStart: GLOW.cy,
      fadeEnd: GLOW.fadeEnd,
      opacity: GLOW.opacity,
      color: [r, g, b],
    };
  }, [color]);

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {width > 0 && effect && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={[{ scale }]}>
            <Rect x={0} y={0} width={CANVAS.width} height={CANVAS.height}>
              <Shader source={effect} uniforms={uniforms} />
            </Rect>
          </Group>
        </Canvas>
      )}
    </View>
  );
};

/**
 * Glow and sparkles behind, the Varial tile floating in front, per the
 * prototype. Reduce motion holds the tile at rest.
 */
export const RebrandAnnouncementIllustration = ({
  accessibilityLabel,
  testID,
}: {
  accessibilityLabel: string;
  testID?: string;
}) => {
  const theme = useTheme();
  const { themeColors } = useColors();
  const reduceMotion = useIsReduceMotionEnabled();
  // 0 at rest, 1 at the bottom of the dip.
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      progress.value = 0;

      return undefined;
    }

    progress.value = withRepeat(
      withSequence(withTiming(1, BOUNCE.down), withTiming(0, BOUNCE.up)),
      -1,
    );

    return () => cancelAnimation(progress);
  }, [reduceMotion, progress]);

  // The layer spans the canvas and the tile sits at its centre, so scaling
  // the layer squashes the tile about its own centre.
  const tileStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: BOUNCE.distance * progress.value },
      { scaleX: 1 + BOUNCE.squash * progress.value },
      { scaleY: 1 - BOUNCE.squash * progress.value },
    ],
  }));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={styles.frame}
    >
      <View style={styles.bleed} pointerEvents="none">
        <Glow color={themeColors.lilac[3]} />
        <Sparkles width="100%" height="100%" />
        <Animated.View style={[StyleSheet.absoluteFill, tileStyle]}>
          <Tile width="100%" height="100%" color={theme.colors.primary} />
        </Animated.View>
      </View>
    </View>
  );
};
