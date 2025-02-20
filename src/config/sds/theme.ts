/*
 * This file is used to define the theme for the app.
 * It is used to define the colors, typography, spacing, and border radius.
 * It is also used to define the opacity for the disabled state.
 *
 * The values on this file have been ported from the Stellar Design System.
 * https://github.com/stellar/stellar-design-system/blob/main/%40stellar/design-system/src/theme.scss
 */

// Base color palette
export const PALETTE = {
  // Gray scale
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
  // Primary brand color
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
  // Semantic colors
  green: {
    "01": "#0d1912",
    "09": "#30a46c",
    11: "#4cc38a",
  },
  red: {
    "01": "#1f1315",
    "06": "#671e22",
    "09": "#e5484d",
    11: "#ff6369",
  },
  amber: {
    "01": "#1f1300",
    "09": "#ffb224",
    11: "#f1a10d",
  },
} as const;

export const THEME = {
  colors: {
    // Brand colors
    primary: PALETTE.lilac["09"],
    secondary: PALETTE.gray["12"],

    // Background colors
    background: {
      default: PALETTE.gray["03"], // #232323
      secondary: PALETTE.gray["04"],
      tertiary: PALETTE.gray["05"],
    },

    // Text colors
    text: {
      default: PALETTE.gray["12"], // #ededed
      secondary: PALETTE.gray["11"],
      disabled: PALETTE.gray["09"],
    },

    // Status colors
    status: {
      success: PALETTE.green["09"],
      error: PALETTE.red["09"],
      warning: PALETTE.amber["09"],
    },

    // Border colors
    border: {
      default: PALETTE.gray["06"],
      error: PALETTE.red["06"],
    },

    // Tab colors
    tab: {
      active: PALETTE.lilac["09"],
      inactive: PALETTE.gray["09"],
    },
  },

  // Typography
  typography: {
    fontSize: {
      primary: 16,
      secondary: 14,
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
    },
    fontWeight: {
      light: "300",
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },

  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },

  // Border radius
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    pill: 999,
  },

  // Opacity
  opacity: {
    disabled: 0.6,
  },
} as const;
