/* eslint-disable react/prop-types */
/* eslint-disable react/jsx-props-no-spreading */
import { THEME } from "config/theme";
import { fs } from "helpers/dimensions";
import React from "react";
import {
  Text as RNText,
  Platform,
  Linking,
  StyleProp,
  TextStyle,
} from "react-native";
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

/**
 * Base props for Typography components (Display and Text)
 *
 * @prop {string} [color] - Explicit color value (e.g. THEME.colors.text.primary)
 * @prop {TextSize} [size] - Explicit size value (xs, sm, md, lg, xl)
 * @prop {FontWeight} [weight] - Explicit weight value (light, regular, medium, semiBold, bold)
 *
 * Size shorthands (alternative to size prop):
 * - xs - Extra small text
 * - sm - Small text
 * - md - Medium text (default for Text)
 * - lg - Large text
 * - xl - Extra large text
 *
 * Weight shorthands (alternative to weight prop):
 * - light - 300
 * - regular - 400 (default)
 * - medium - 500
 * - semiBold - 600
 * - bold - 700
 *
 * Color shorthands (alternative to color prop):
 * - primary - THEME.colors.text.primary (default)
 * - secondary - THEME.colors.text.secondary
 *
 * Examples:
 * ```tsx
 * // Using explicit props
 * <Text
 *   size="md"
 *   weight="semiBold"
 *   color={THEME.colors.text.primary}
 * >
 *   Hello World
 * </Text>
 *
 * // Using shorthands
 * <Text md semiBold primary>Hello World</Text>
 *
 * // Mixing styles
 * <Text size="lg" bold secondary>Hello World</Text>
 * ```
 */
interface TypographyBaseProps extends SizeProps, WeightProps, ColorProps {
  color?: string;
  children: React.ReactNode;
  size?: TextSize;
  weight?: FontWeight;
  testID?: string;
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

// Add color shorthands
type ColorProps = {
  primary?: boolean;
  secondary?: boolean;
};

// Get size from props, with priority to explicit prop
const getSize = <T extends string>(
  props: { size?: T } & SizeProps,
  defaultSize: T,
): T => {
  if (props.size) return props.size;
  if (props.xl) return "xl" as T;
  if (props.lg) return "lg" as T;
  if (props.md) return "md" as T;
  if (props.sm) return "sm" as T;
  if (props.xs) return "xs" as T;
  return defaultSize;
};

// Get weight from props, with priority to explicit prop
const getWeight = (
  props: { weight?: FontWeight } & WeightProps,
  defaultWeight: FontWeight,
): FontWeight => {
  if (props.weight) return props.weight;
  if (props.bold) return "bold";
  if (props.semiBold) return "semiBold";
  if (props.medium) return "medium";
  if (props.regular) return "regular";
  if (props.light) return "light";
  return defaultWeight;
};

// Get color from props, with priority to explicit prop
const getColor = (
  props: { color?: string } & ColorProps,
  defaultColor: string,
): string => {
  if (props.color) return props.color;
  if (props.secondary) return THEME.colors.text.secondary;
  if (props.primary) return THEME.colors.text.primary;
  return defaultColor;
};

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

export interface DisplayProps extends TypographyBaseProps {
  size?: TextSize;
  style?: StyleProp<TextStyle>;
}

const StyledDisplay = styled(BaseText)<{ $size: DisplaySize }>`
  font-size: ${({ $size }: { $size: DisplaySize }) =>
    fs(DISPLAY_SIZES[$size].fontSize)};
  line-height: ${({ $size }: { $size: DisplaySize }) =>
    fs(DISPLAY_SIZES[$size].lineHeight)};
`;

/**
 * Display component for large, prominent text elements
 *
 * Sizes (fontSize/lineHeight):
 * - xl: 56px/64px - Main headlines
 * - lg: 48px/56px - Secondary headlines
 * - md: 40px/48px - Section headers
 * - sm: 32px/40px - Subsection headers (default)
 * - xs: 24px/32px - Smallest display text
 *
 * @example
 * ```tsx
 * // Extra large bold display text
 * <Display xl bold>Welcome</Display>
 *
 * // Medium display with secondary color
 * <Display md secondary>Section Title</Display>
 *
 * // Explicit props with custom color
 * <Display
 *   size="lg"
 *   weight="semiBold"
 *   color={PALETTE.dark.green["09"]}
 * >
 *   Custom Display
 * </Display>
 * ```
 */
export const Display: React.FC<DisplayProps> = ({
  size,
  weight,
  color,
  children,
  ...props
}) => (
  <StyledDisplay
    $size={getSize({ size, ...props }, "sm")}
    $weight={getWeight({ weight, ...props }, "regular")}
    $color={getColor({ color, ...props }, THEME.colors.text.primary)}
    {...props}
  >
    {children}
  </StyledDisplay>
);

// =============================================================================
// Text
// =============================================================================

export interface TextProps extends TypographyBaseProps {
  size?: TextSize;
  isVerticallyCentered?: boolean;
  url?: string;
  style?: StyleProp<TextStyle>;
}

const StyledText = styled(BaseText)<{
  $size: TextSize;
  $isVerticallyCentered?: boolean;
}>`
  font-size: ${({ $size }: { $size: TextSize }) =>
    fs(TEXT_SIZES[$size].fontSize)};
  line-height: ${({ $size }: { $size: TextSize }) =>
    fs(TEXT_SIZES[$size].lineHeight)};
  text-decoration: none;
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

/**
 * Text component for general purpose text content
 *
 * Sizes (fontSize/lineHeight):
 * - xl: 20px/28px - Emphasized body text
 * - lg: 18px/26px - Large body text
 * - md: 16px/24px - Default body text
 * - sm: 14px/22px - Secondary text, captions
 * - xs: 12px/20px - Small labels, footnotes
 *
 * Additional props:
 * @prop {boolean} [isVerticallyCentered] - Centers text vertically (useful for button titles)
 *
 * @example
 * ```tsx
 * // Basic body text
 * <Text md>Regular body text</Text>
 *
 * // Small secondary color text
 * <Text sm secondary>Caption text</Text>
 *
 * // Explicit props with custom color
 * <Text
 *   size="lg"
 *   weight="bold"
 *   color={PALETTE.dark.amber["09"]}
 * >
 *   Custom Text
 * </Text>
 * ```
 */
export const Text: React.FC<TextProps> = ({
  size,
  weight,
  color,
  children,
  isVerticallyCentered = false,
  url,
  ...props
}) => {
  const handlePress = () => {
    if (url) {
      Linking.canOpenURL(url).then((supported) => {
        if (supported) {
          Linking.openURL(url);
        }
      });
    }
  };

  return (
    <StyledText
      $size={getSize({ size, ...props }, "md")}
      $weight={getWeight({ weight, ...props }, "regular")}
      $color={getColor({ color, ...props }, THEME.colors.text.primary)}
      $isVerticallyCentered={isVerticallyCentered}
      {...(url && { onPress: () => handlePress() })}
      {...props}
    >
      {children}
    </StyledText>
  );
};
