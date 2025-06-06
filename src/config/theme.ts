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
      "01": "#17151f",
      "02": "#1c172b",
      "03": "#251e40",
      "04": "#2c2250",
      "05": "#32275f",
      "06": "#392c72",
      "07": "#443592",
      "08": "#5842c3",
      "09": "#6e56cf",
      10: "#7c66dc",
      11: "#9e8cfc",
      12: "#f1eefe",
    },
    base: {
      "00": "#000000",
      "01": "#ffffff",
    },
    green: {
      "01": "#0d1912",
      "02": "#0f2218",
      "03": "#1a3826",
      "09": "#30a46c",
      11: "#4cc38a",
    },
    red: {
      "01": "#1f1315",
      "02": "#2c1a1d",
      "06": "#671e22",
      "09": "#e5484d",
      11: "#ff6369",
    },
    amber: {
      "01": "#1f1300",
      "02": "#2c1a00",
      "03": "#382800",
      "09": "#ffb224",
      11: "#f1a10d",
    },
  },
  // Most of the time we'll be using the dark theme colors but
  // in a few cases (like Button theme) we'll be using the light
  // theme colors so we have them available here.
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
      "01": "#fdfcfe",
      "02": "#fbfaff",
      "03": "#f5f2ff",
      "04": "#ede9fe",
      "05": "#e4defc",
      "06": "#d7cff9",
      "07": "#c4b8f3",
      "08": "#aa99ec",
      "09": "#6e56cf",
      10: "#644fc1",
      11: "#5746af",
      12: "#20134b",
    },
    base: {
      "00": "#ffffff",
      "01": "#000000",
    },
    green: {
      "01": "#fbfefc",
      "09": "#30a46c",
      11: "#18794e",
    },
    red: {
      "01": "#fffcfc",
      "06": "#f9c6c6",
      "09": "#e5484d",
      11: "#cd2b31",
    },
    amber: {
      "01": "#fefdfb",
      "09": "#ffb224",
      11: "#ad5700",
    },
  },
} as const;

// Theme definitions
export const THEME = {
  colors: {
    primary: PALETTE.dark.lilac["09"],
    secondary: PALETTE.dark.gray["12"],
    background: {
      default: PALETTE.dark.gray["01"],
      secondary: PALETTE.dark.gray["02"],
      tertiary: PALETTE.dark.gray["03"],
    },
    foreground: {
      primary: PALETTE.dark.gray["09"],
      secondary: PALETTE.dark.gray["08"],
      tertiary: PALETTE.dark.gray["07"],
    },
    text: {
      primary: PALETTE.dark.gray["12"],
      secondary: PALETTE.dark.gray["11"],
    },
    status: {
      success: PALETTE.dark.green["09"],
      error: PALETTE.dark.red["09"],
      warning: PALETTE.dark.amber["09"],
    },
    border: {
      default: PALETTE.dark.gray["06"],
      error: PALETTE.dark.red["06"],
    },
    tab: {
      active: PALETTE.dark.gray["12"],
      inactive: PALETTE.dark.gray["11"],
      activeBackground: PALETTE.dark.gray["04"],
      inactiveBackground: "transparent",
    },
    base: {
      primary: PALETTE.dark.base["00"],
      secondary: PALETTE.dark.base["01"],
    },
    list: {
      destructive: PALETTE.dark.red["11"],
      disabled: PALETTE.dark.gray["09"],
    },
  },
  opacity: {
    disabled: 0.6,
  },
} as const;

export const NOTIFICATION_VARIANTS = {
  success: {
    iconColor: PALETTE.dark.green["09"],
    backgroundColor: PALETTE.dark.green["03"],
  },
  error: {
    iconColor: PALETTE.dark.red["09"],
    backgroundColor: PALETTE.dark.red["02"],
  },
  warning: {
    iconColor: PALETTE.dark.amber["09"],
    backgroundColor: PALETTE.dark.amber["03"],
  },
  secondary: {
    iconColor: PALETTE.dark.gray["11"],
    backgroundColor: PALETTE.dark.gray["03"],
  },
  primary: {
    iconColor: PALETTE.dark.lilac["09"],
    backgroundColor: PALETTE.dark.gray["01"],
  },
} as const;
