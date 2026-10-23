import { BlurView } from "@react-native-community/blur";
import {
  PillBlurView,
  isPillBlurSupported,
} from "components/FloatingTabBar/PillBlur";
import { ColorScheme, DEFAULT_COLOR_SCHEME, SHADOW_COLOR } from "config/theme";
import { androidApiLevel } from "helpers/device";
import useColors, { ThemeColors } from "hooks/useColors";
import React from "react";
import {
  Platform,
  PlatformOSType,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";

/**
 * What the floating tab bar's pill is made of:
 * - `blurred`: a background blur under a translucent fill.
 * - `translucent`: the translucent fill alone.
 */
export type PillMaterial = "blurred" | "translucent";

/**
 * The material for a platform. This is the one place that picks it, so
 * changing a platform's pill is a change here.
 *
 * - iOS gets the blur, as Figma draws it.
 * - Android 12+ blurs too, with our own view on Dimezis BlurView 3
 *   (`PillBlur`).
 * - Older Android gets the fill alone: the blur would snapshot in software
 *   there, which broke native-stack transitions with the old blur library.
 */
export const getPillMaterial = (
  os: PlatformOSType,
  apiLevel: number,
): PillMaterial =>
  os === "ios" || isPillBlurSupported(os, apiLevel) ? "blurred" : "translucent";

/**
 * The selection capsule's color. Light is Figma's selection layer, a
 * translucent gray that no palette step matches. Dark is Gray/4.
 */
export const getPillSelectionColor = (
  scheme: ColorScheme,
  colors: ThemeColors,
): string =>
  scheme === "light" ? "rgba(153, 153, 153, 0.15)" : colors.gray[4];

/**
 * `hex` (six digits, as the palette writes them) at `opacity`, in React
 * Native's eight-digit form.
 */
const withOpacity = (hex: string, opacity: number): string =>
  `${hex}${Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0")}`;

/**
 * Figma's 4pt background blur. iOS takes it as the classic `light` and `dark`
 * styles' radius (iOS 26's system-material styles ignore the radius, so they
 * can't be tuned), and Android as the blur's standard deviation in dp.
 */
const BLUR_AMOUNT = 4;

/**
 * The pill's translucent fill (Figma ?node-id=3675-56991). Light is Figma's
 * 86% white. Dark is Figma's 85% #3C3C3C under a color-burn and a darken
 * layer, which React Native can't blend, as the plain fill they come out to:
 * about 83% #212121, which is #1C1C1C over black.
 */
const PILL_FILL: Record<ColorScheme, string> = {
  light: "rgba(255, 255, 255, 0.86)",
  dark: "rgba(33, 33, 33, 0.83)",
};

/**
 * The fill over iOS's blur. The blur styles add a tint of their own, measured
 * on an iPhone SE simulator: `light` lets 70% of the backdrop through over a
 * 77 gray floor, `dark` 27% over a 20 floor. With `PILL_FILL` on top, far less
 * showed through than in Figma. These fills make the blur and the fill
 * together come out as `PILL_FILL` does over a plain blur.
 */
const BLURRED_PILL_FILL: Record<ColorScheme, string> = {
  light: "rgba(255, 255, 255, 0.8)",
  dark: "rgba(40, 40, 40, 0.38)",
};

/** Figma's pill shadow, 0 8 40 at 12% black, the same in both schemes. */
const PILL_SHADOW = [
  {
    offsetX: 0,
    offsetY: 8,
    blurRadius: 40,
    color: withOpacity(SHADOW_COLOR, 0.12),
  },
];

/**
 * React Native draws a `boxShadow` on Android only from 9 (API level 28).
 * Before that the pill casts a stock elevation shadow instead. It isn't
 * Figma's soft 0 8 40, but it keeps the pill from blending into a page of the
 * same color. An elevation shadow shows through a translucent fill, so the
 * pill is solid there. From 28 on the elevation stays off, or the pill would
 * cast two shadows.
 */
const BOX_SHADOW_MIN_ANDROID_API_LEVEL = 28;
const FALLBACK_ELEVATION = 8;

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  elevated: { elevation: FALLBACK_ELEVATION },
});

interface PillBackgroundProps {
  width: number;
  height: number;
  /** Defaults to the platform's material. */
  material?: PillMaterial;
  /** Drawn inside the pill, over its material. */
  children?: React.ReactNode;
}

/**
 * The floating tab bar's pill: its material, sized and fully rounded. It holds
 * the tabs as children and lays nothing out itself.
 *
 * Design: Tab Bar Buttons ?node-id=3675-56991.
 */
export const PillBackground: React.FC<PillBackgroundProps> = ({
  width,
  height,
  material = getPillMaterial(Platform.OS, androidApiLevel),
  children,
}) => {
  const scheme = useColorScheme() ?? DEFAULT_COLOR_SCHEME;
  const { themeColors } = useColors();
  const shape = { width, height, borderRadius: height / 2 };
  // The solid stand-in where there's no transparency: Gray/1 in light,
  // Gray/2 in dark, what the fill looks like over a plain page.
  const surface =
    scheme === "light" ? themeColors.gray[1] : themeColors.gray[2];

  if (material === "blurred") {
    // On iOS a BlurView's own radius doesn't clip the native blur, so the
    // clip is its parent's job. A shadow on that parent would be clipped
    // with the blur, so the shadow sits on the view around it.
    return (
      <View testID="pill-blurred" style={[shape, { boxShadow: PILL_SHADOW }]}>
        <View testID="pill-blurred-clip" style={[shape, styles.clip]}>
          {Platform.OS === "android" ? (
            <PillBlurView
              testID="blur-view"
              blurRadius={BLUR_AMOUNT}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <BlurView
              blurType={scheme}
              blurAmount={BLUR_AMOUNT}
              reducedTransparencyFallbackColor={surface}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View
            testID="pill-blurred-fill"
            style={[
              StyleSheet.absoluteFill,
              {
                // Android's blur adds no tint, so Figma's fill goes over it as
                // it is. iOS's blur styles tint, which its fill makes up for.
                backgroundColor:
                  Platform.OS === "android"
                    ? PILL_FILL[scheme]
                    : BLURRED_PILL_FILL[scheme],
              },
            ]}
          />
          {children}
        </View>
      </View>
    );
  }

  // `androidApiLevel` reads 0 off Android, which is below 28 too.
  const needsElevation =
    Platform.OS === "android" &&
    androidApiLevel < BOX_SHADOW_MIN_ANDROID_API_LEVEL;

  return (
    <View
      testID="pill-translucent"
      style={[
        shape,
        {
          backgroundColor: needsElevation ? surface : PILL_FILL[scheme],
          boxShadow: PILL_SHADOW,
        },
        needsElevation && styles.elevated,
      ]}
    >
      {children}
    </View>
  );
};
