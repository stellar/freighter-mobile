/*
 * This file is used to define the theme for the Button component.
 * It is used to define the height, font size, padding, border radius, and colors for the button.
 *
 * The values on this file have been ported from the Stellar Design System.
 * https://github.com/stellar/stellar-design-system/blob/main/%40stellar/design-system/src/components/Button/styles.scss
 */
import { THEME, PALETTE } from "config/sds/theme";

export const BUTTON_THEME = {
  height: {
    sm: 26,
    md: 32,
    lg: 40,
  },
  fontSize: {
    sm: THEME.typography.fontSize.xs,
    md: THEME.typography.fontSize.sm,
    lg: THEME.typography.fontSize.md,
  },
  padding: {
    sm: {
      vertical: THEME.spacing.xs,
      horizontal: THEME.spacing.sm,
    },
    md: {
      vertical: THEME.spacing.sm - 2,
      horizontal: THEME.spacing.sm + 2,
    },
    lg: {
      vertical: THEME.spacing.sm,
      horizontal: THEME.spacing.md - 4,
    },
  },
  borderRadius: {
    sm: THEME.borderRadius.sm,
    md: THEME.borderRadius.md,
    lg: THEME.borderRadius.lg,
  },
  colors: {
    primary: {
      background: THEME.colors.primary,
      text: PALETTE.gray["12"],
    },
    secondary: {
      background: PALETTE.gray["03"],
      text: PALETTE.gray["12"],
    },
    tertiary: {
      background: PALETTE.gray["01"],
      text: PALETTE.gray["12"],
      border: PALETTE.gray["06"],
    },
    error: {
      background: PALETTE.red["01"],
      text: PALETTE.red["11"],
      border: PALETTE.red["06"],
    },
    destructive: {
      background: PALETTE.red["09"],
      text: PALETTE.gray["12"],
    },
    disabled: {
      background: PALETTE.gray["06"],
      text: PALETTE.gray["09"],
    },
  },
  icon: {
    spacing: THEME.spacing.sm,
  },
} as const;
