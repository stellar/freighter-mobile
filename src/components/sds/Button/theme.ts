/*
 * This file is used to define the theme for the Button component.
 * It is used to define the height, font size, padding, border radius, and colors for the button.
 *
 * The values on this file have been ported from the Stellar Design System.
 * https://github.com/stellar/stellar-design-system/blob/main/%40stellar/design-system/src/components/Button/styles.scss
 */
import { ColorScheme, PALETTE, getTheme } from "config/theme";

interface ButtonColorConfig {
  background: string;
  text: string;
  border?: string;
}

export const BUTTON_THEME = {
  // Varial heights: https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=1-2482
  height: {
    sm: 36,
    md: 40,
    lg: 48,
    xl: 52,
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
  icon: {
    spacing: 8,
  },
} as const;

/**
 * Builds the Button colors for a color scheme.
 *
 * `secondary` and `tertiary` follow the Varial welcome screen in Figma:
 * light https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=650-6360
 * dark  https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=760-37023
 *
 * Prefer the `useButtonColors` hook in components.
 */
export const getButtonColors = (scheme: ColorScheme) => {
  const { colors } = getTheme(scheme);

  return {
    // The brand color fills this one in both schemes, so the label is white in
    // both: text.primary would be near-black on a light device and base.primary
    // would be black on a dark one, and neither reads on blue.
    primary: {
      background: colors.primary,
      text: "#ffffff",
    } as ButtonColorConfig,

    // The filled call to action: the inverted surface, labelled in the page
    // color, and no border so the fill reads as one solid shape.
    secondary: {
      background: colors.text.primary,
      text: colors.base.primary,
    } as ButtonColorConfig,

    // The outlined call to action. No fill, so the page shows through.
    tertiary: {
      background: "transparent",
      text: colors.text.primary,
      border: colors.border.default,
    } as ButtonColorConfig,

    // Tinted warning action: the low end of the red ramp for the fill and
    // border, the high end for the label.
    error: {
      background: PALETTE[scheme].red["01"],
      text: PALETTE[scheme].red["11"],
      border: PALETTE[scheme].red["06"],
    } as ButtonColorConfig,

    // Solid warning action. The only variant that does not follow the scheme:
    // red 09 is the same value in both palettes, and Figma pins the label to
    // literal white rather than base 00, which would flip to black on dark and
    // disappear into the fill.
    destructive: {
      background: PALETTE[scheme].red["09"],
      text: "#ffffff",
    } as ButtonColorConfig,

    // Bare text action: no fill, and a transparent border so its height matches
    // the bordered variants.
    minimal: {
      background: "transparent",
      text: colors.text.primary,
      border: "transparent",
    } as ButtonColorConfig,

    disabled: {
      background: colors.background.tertiary,
      text: colors.foreground.primary,
      border: colors.border.default,
    } as ButtonColorConfig,
  };
};

export type ButtonColors = ReturnType<typeof getButtonColors>;
