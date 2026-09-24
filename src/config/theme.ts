/*
 * This file is used to define the theme for the app.
 * It is used to define the colors, typography, spacing, and border radius.
 * It is also used to define the opacity for the disabled state.
 *
 * The values on this file have been ported from the Stellar Design System.
 * https://github.com/stellar/stellar-design-system/blob/main/%40stellar/design-system/src/theme.scss
 */

// Base color palettes
export const PALETTE = {
  dark: {
    gray: {
      "01": "#161616",
      "02": "#1c1c1c",
      "03": "#232323",
      "04": "#282828",
      "05": "#2e2e2e",
      "06": "#343434",
      "07": "#3e3e3e",
      "08": "#505050",
      "09": "#707070",
      10: "#7e7e7e",
      11: "#a0a0a0",
      12: "#ededed",
    },
    lilac: {
      "01": "#0e1623",
      "02": "#101a29",
      "03": "#0d264d",
      "04": "#092f69",
      "05": "#0f3b7c",
      "06": "#19478d",
      "07": "#2255a3",
      "08": "#2865c1",
      "09": "#1677ff",
      10: "#0069f0",
      11: "#7eb6ff",
      12: "#cde3ff",
    },
    base: {
      "00": "#000000",
      "01": "#ffffff",
    },
    green: {
      "01": "#0d1912",
      "02": "#0c1f17",
      "03": "#0f291e",
      "09": "#30a46c",
      11: "#4cc38a",
    },
    red: {
      "01": "#1f1315",
      "02": "#291415",
      "06": "#671e22",
      "09": "#e5484d",
      11: "#ff6369",
    },
    amber: {
      "01": "#1f1300",
      "02": "#271700",
      "03": "#341c00",
      "09": "#ffb224",
      11: "#f1a10d",
    },
  },
  // Both schemes must expose the same shades: the theme factories below index
  // the palette with a scheme that is only known at runtime, so a shade missing
  // from one scheme is a type error and a crash the first time it is selected.
  light: {
    gray: {
      "01": "#fcfcfc",
      "02": "#f8f8f8",
      "03": "#f3f3f3",
      "04": "#ededed",
      "05": "#e8e8e8",
      "06": "#e2e2e2",
      "07": "#dbdbdb",
      "08": "#c7c7c7",
      "09": "#8f8f8f",
      10: "#858585",
      11: "#6f6f6f",
      12: "#171717",
    },
    lilac: {
      "01": "#fcfdff",
      "02": "#f5faff",
      "03": "#eef4ff",
      "04": "#daeaff",
      "05": "#c8e0ff",
      "06": "#a8c6ff",
      "07": "#98bfff",
      "08": "#73a5ff",
      "09": "#0050ff",
      10: "#0246df",
      11: "#0f53ec",
      12: "#0e2b6c",
    },
    base: {
      "00": "#ffffff",
      "01": "#000000",
    },
    green: {
      "01": "#fbfefc",
      "02": "#f2fcf5",
      "03": "#e9f9ee",
      "09": "#30a46c",
      11: "#18794e",
    },
    red: {
      "01": "#fffcfc",
      "02": "#fff8f8",
      "06": "#f9c6c6",
      "09": "#e5484d",
      11: "#cd2b31",
    },
    amber: {
      "01": "#fefdfb",
      "02": "#fff9ed",
      "03": "#fff4d5",
      "09": "#ffb224",
      11: "#ad5700",
    },
  },
} as const;

/** The color schemes the palette supports. */
export type ColorScheme = keyof typeof PALETTE;

/**
 * Scheme used when the device reports none. Shared with `useColors` so that
 * both theme systems always resolve the same palette -- if they disagreed, a
 * device reporting no scheme would render part of a screen light and part dark.
 */
export const DEFAULT_COLOR_SCHEME: ColorScheme = "light";

/**
 * Colors that deliberately do not follow the scheme.
 *
 * A backdrop dims the page behind a sheet or a modal, and a shadow is one
 * surface falling on another: both are black whichever scheme is active. The
 * `overlay` ramp is not a substitute -- it inverts to white on dark, which
 * washes a page out rather than dimming it, and turns a shadow into a glow.
 *
 * Backdrop opacity read from the Varial account sheet in Figma:
 * https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=694-19010
 */
export const BACKDROP_OPACITY = 0.6;
export const BACKDROP_COLOR = `rgba(0, 0, 0, ${BACKDROP_OPACITY})`;
export const SHADOW_COLOR = "#000000";

/**
 * Builds the semantic theme for a color scheme.
 *
 * Prefer the `useTheme` hook in components so the theme follows the device.
 * Call this directly only where a hook cannot run, such as module-level
 * constants built from a scheme resolved by their caller.
 */
export const getTheme = (scheme: ColorScheme) => ({
  colors: {
    primary: PALETTE[scheme].lilac["09"],
    secondary: PALETTE[scheme].gray["12"],
    background: {
      default: PALETTE[scheme].gray["01"],
      secondary: PALETTE[scheme].gray["02"],
      tertiary: PALETTE[scheme].gray["03"],
    },
    // Not a monotonic walk down the ramp: `secondary` is gray 10 to match the
    // token of the same name in config/colors.ts, which the app reads far more
    // often. Gray 08 here made one token render as two shades depending on
    // which theme system a component happened to use.
    foreground: {
      primary: PALETTE[scheme].gray["09"],
      secondary: PALETTE[scheme].gray["10"],
      tertiary: PALETTE[scheme].gray["07"],
    },
    text: {
      primary: PALETTE[scheme].gray["12"],
      secondary: PALETTE[scheme].gray["11"],
    },
    status: {
      success: PALETTE[scheme].green["09"],
      error: PALETTE[scheme].red["09"],
      warning: PALETTE[scheme].amber["09"],
    },
    border: {
      default: PALETTE[scheme].gray["06"],
      error: PALETTE[scheme].red["06"],
    },
    tab: {
      active: PALETTE[scheme].gray["12"],
      inactive: PALETTE[scheme].gray["11"],
      activeBackground: PALETTE[scheme].gray["04"],
      inactiveBackground: "transparent",
    },
    base: {
      primary: PALETTE[scheme].base["00"],
      secondary: PALETTE[scheme].base["01"],
    },
    list: {
      destructive: PALETTE[scheme].red["11"],
      disabled: PALETTE[scheme].gray["09"],
    },
  },
  opacity: {
    disabled: 0.6,
  },
});

export type Theme = ReturnType<typeof getTheme>;

/**
 * Builds the notification variant colors for a color scheme.
 *
 * Prefer the `useNotificationVariants` hook in components.
 */
export const getNotificationVariants = (scheme: ColorScheme) => ({
  success: {
    iconColor: PALETTE[scheme].green["09"],
    backgroundColor: PALETTE[scheme].green["03"],
  },
  error: {
    iconColor: PALETTE[scheme].red["09"],
    backgroundColor: PALETTE[scheme].red["02"],
  },
  warning: {
    iconColor: PALETTE[scheme].amber["09"],
    backgroundColor: PALETTE[scheme].amber["03"],
  },
  secondary: {
    iconColor: PALETTE[scheme].gray["11"],
    backgroundColor: PALETTE[scheme].gray["03"],
  },
  primary: {
    iconColor: PALETTE[scheme].lilac["09"],
    backgroundColor: PALETTE[scheme].gray["01"],
  },
});

export type NotificationVariants = ReturnType<typeof getNotificationVariants>;
