/* eslint-disable react/prop-types */
/* eslint-disable react/jsx-props-no-spreading */
import { THEME } from "config/sds/theme";
import { fs } from "helpers/dimensions";
import React from "react";
import { Text as RNText, Platform } from "react-native";
import styled from "styled-components/native";

// =============================================================================
// Constants and types
// =============================================================================

const FONT_WEIGHTS = {
  light: "300",
  regular: "400",
  medium: "500",
  semiBold: "600",
  bold: "700",
} as const;

type FontWeightKey = keyof typeof FONT_WEIGHTS;

const ANDROID_FONT_WEIGHTS: Record<FontWeightKey, string> = {
  light: "Light",
  regular: "Regular",
  medium: "Medium",
  semiBold: "SemiBold",
  bold: "Bold",
} as const;

export type FontWeight = keyof typeof FONT_WEIGHTS;

interface TypographyBaseProps {
  weight?: FontWeight;
  color?: string;
  children: React.ReactNode;
}

const DISPLAY_SIZES = {
  xl: { fontSize: 56, lineHeight: 64 },
  lg: { fontSize: 48, lineHeight: 56 },
  md: { fontSize: 40, lineHeight: 48 },
  sm: { fontSize: 32, lineHeight: 40 },
  xs: { fontSize: 24, lineHeight: 32 },
} as const;

const TEXT_SIZES = {
  xl: { fontSize: 20, lineHeight: 28 },
  lg: { fontSize: 18, lineHeight: 26 },
  md: { fontSize: 16, lineHeight: 24 },
  sm: { fontSize: 14, lineHeight: 22 },
  xs: { fontSize: 12, lineHeight: 20 },
} as const;

export type DisplaySize = keyof typeof DISPLAY_SIZES;
export type TextSize = keyof typeof TEXT_SIZES;

type SizeShorthand = TextSize;
type WeightShorthand = FontWeight;

// Create union type of all size shorthands
type SizeProps = {
  [K in SizeShorthand as K]?: boolean;
};

// Create union type of all weight shorthands
type WeightProps = {
  [K in WeightShorthand as K]?: boolean;
};

interface TypographyBaseProps extends SizeProps, WeightProps {
  color?: string;
  children: React.ReactNode;
  // Although we have the shorthands, we can still use the explicit props
  size?: TextSize;
  weight?: FontWeight;
}

/* eslint-disable no-nested-ternary */
// Get size from props, with priority to explicit prop
const getSize = <T extends string>(
  props: { size?: T } & SizeProps,
  defaultSize: T,
): T =>
  props.size ||
  (props.xl
    ? ("xl" as T)
    : props.lg
      ? ("lg" as T)
      : props.md
        ? ("md" as T)
        : props.sm
          ? ("sm" as T)
          : props.xs
            ? ("xs" as T)
            : defaultSize);

// Get weight from props, with priority to explicit prop
const getWeight = (
  props: { weight?: FontWeight } & WeightProps,
  defaultWeight: FontWeight,
): FontWeight =>
  props.weight ||
  (props.bold
    ? "bold"
    : props.semiBold
      ? "semiBold"
      : props.medium
        ? "medium"
        : props.regular
          ? "regular"
          : props.light
            ? "light"
            : defaultWeight);
/* eslint-enable no-nested-ternary */

// =============================================================================
// Base styled components
// =============================================================================

const BaseText = styled(RNText)<{ $weight: FontWeight; $color: string }>`
  font-family: ${({ $weight }: { $weight: FontWeight }) =>
    Platform.select({
      ios: "Inter-Variable",
      android: `Inter-${ANDROID_FONT_WEIGHTS[$weight]}`,
    })};
  font-weight: ${({ $weight }: { $weight: FontWeight }) =>
    Platform.select({
      ios: FONT_WEIGHTS[$weight],
      android: "normal",
    })};
  color: ${({ $color }: { $color: string }) => $color};
`;

// =============================================================================
// Display
// =============================================================================

/**
 * Display component is used for large, prominent text elements like:
 * - Page headings
 * - Hero text
 * - Section headers
 * - Modal titles
 * - Feature introductions
 *
 * Available sizes:
 * - xl: 56px (largest, for main headlines)
 * - lg: 48px (secondary headlines)
 * - md: 40px (section headers)
 * - sm: 32px (subsection headers)
 * - xs: 24px (smallest display text)
 */
interface DisplayProps extends TypographyBaseProps {
  size?: DisplaySize;
}

const StyledDisplay = styled(BaseText)<{ $size: DisplaySize }>`
  font-size: ${({ $size }: { $size: DisplaySize }) =>
    fs(DISPLAY_SIZES[$size].fontSize)};
  line-height: ${({ $size }: { $size: DisplaySize }) =>
    fs(DISPLAY_SIZES[$size].lineHeight)};
`;

export const Display: React.FC<DisplayProps> = ({
  size,
  weight,
  color = THEME.colors.text.primary,
  children,
  ...props
}) => (
  <StyledDisplay
    $size={getSize({ size, ...props }, "sm")}
    $weight={getWeight({ weight, ...props }, "regular")}
    $color={color}
    {...props}
  >
    {children}
  </StyledDisplay>
);

// =============================================================================
// Text
// =============================================================================

/**
 * Text component is used for general purpose text content like:
 * - Body text
 * - Paragraphs
 * - Labels
 * - Navigation items
 * - Button text
 * - Form inputs
 *
 * Available sizes:
 * - xl: 20px (emphasized body text)
 * - lg: 18px (large body text)
 * - md: 16px (default body text)
 * - sm: 14px (secondary text, captions)
 * - xs: 12px (small labels, footnotes)
 */
interface TextProps extends TypographyBaseProps {
  size?: TextSize;
  isVerticallyCentered?: boolean;
}

const StyledText = styled(BaseText)<{
  $size: TextSize;
  $isVerticallyCentered?: boolean;
}>`
  font-size: ${({ $size }: { $size: TextSize }) =>
    fs(TEXT_SIZES[$size].fontSize)};
  line-height: ${({ $size }: { $size: TextSize }) =>
    fs(TEXT_SIZES[$size].lineHeight)};
  // This will make sure button titles are vertically centered,
  // but we should avoid using this for long copies since the fixed
  // height prevents line breaks
  ${({
    $isVerticallyCentered,
    $size,
  }: {
    $isVerticallyCentered?: boolean;
    $size: TextSize;
  }) =>
    $isVerticallyCentered
      ? `
  display: flex;
  align-items: center;
  height: ${fs(TEXT_SIZES[$size].lineHeight)};
      `
      : ""};
`;

export const Text: React.FC<TextProps> = ({
  size,
  weight,
  color = THEME.colors.text.primary,
  children,
  isVerticallyCentered = false,
  ...props
}) => (
  <StyledText
    $size={getSize({ size, ...props }, "md")}
    $weight={getWeight({ weight, ...props }, "regular")}
    $color={color}
    $isVerticallyCentered={isVerticallyCentered}
    {...props}
  >
    {children}
  </StyledText>
);
