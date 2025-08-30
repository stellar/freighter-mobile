/*
 * This file is used to define the theme for the Button component.
 * It is used to define the height, font size, padding, border radius, and colors for the button.
 *
 * The values on this file have been ported from the Stellar Design System.
 * https://github.com/stellar/stellar-design-system/blob/main/%40stellar/design-system/src/components/Button/styles.scss
 */
import { THEME, PALETTE } from "config/theme";

interface ButtonColorConfig {
  background: string;
  text: string;
  border?: string;
}

export const BUTTON_THEME = {
  height: {
    sm: 26,
    md: 32,
    lg: 40,
    xl: 50,
  },
  padding: {
    sm: {
      vertical: 4,
      horizontal: 8,
    },
    md: {
      vertical: 6,
      horizontal: 10,
    },
    lg: {
      vertical: 8,
      horizontal: 12,
    },
    xl: {
      vertical: 12,
      horizontal: 16,
    },
  },
  borderRadius: {
    sm: 4,
    md: 6,
    lg: 8,
    xl: 8,
  },
  fontSize: {
    sm: "xs",
    md: "sm",
    lg: "md",
    xl: "lg",
  },
  colors: {
    primary: {
      background: THEME.colors.primary,
      text: THEME.colors.text.primary,
    } as ButtonColorConfig,
    secondary: {
      background: PALETTE.light.gray["12"],
      text: THEME.colors.text.primary,
      border: THEME.colors.border.default,
    } as ButtonColorConfig,
    tertiary: {
      background: PALETTE.light.gray["01"],
      text: PALETTE.light.gray["12"],
      border: PALETTE.light.gray["06"],
    } as ButtonColorConfig,
    error: {
      background: PALETTE.dark.red["01"],
      text: PALETTE.dark.red["11"],
      border: PALETTE.dark.red["06"],
    } as ButtonColorConfig,
    destructive: {
      background: PALETTE.light.red["09"],
      text: PALETTE.light.base["00"],
    } as ButtonColorConfig,
    minimal: {
      background: "transparent",
      text: THEME.colors.text.primary,
      border: "transparent",
    } as ButtonColorConfig,
    disabled: {
      background: THEME.colors.background.tertiary,
      text: PALETTE.light.gray["09"],
      border: THEME.colors.border.default,
    } as ButtonColorConfig,
  },
  icon: {
    spacing: 8,
  },
} as const;
