import { THEME } from "config/theme";
import { px } from "helpers/dimensions";
import React from "react";
import { ImageSourcePropType } from "react-native";
import styled from "styled-components/native";

// =============================================================================
// Constants and types
// =============================================================================

/**
 * Size configurations for the Asset component
 *
 * Defines the dimensions and spacing for different size variants and display modes.
 * All measurements are in pixels before scaling.
 *
 * Each size variant ("sm", "md", "lg") contains:
 * - `single`: Dimension for single asset display
 * - `swap`: Settings for the swap variant (two assets with second overlapping)
 * - `pair`: Settings for the pair variant (two assets side by side)
 * - `platform`: Settings for the platform variant (main asset with smaller platform logo)
 *
 * Each variant configuration includes:
 * - `size`: The dimension of the individual asset
 * - `containerWidth`: Total width of the component
 * - `containerHeight`: Total height of the component
 */
const ASSET_SIZES = {
  sm: {
    single: 16,
    swap: {
      size: 12,
      containerWidth: 16,
      containerHeight: 16,
    },
    pair: {
      size: 12,
      containerWidth: 20,
      containerHeight: 12,
    },
    platform: {
      size: 16,
      containerWidth: 16,
      containerHeight: 16,
    },
  },
  md: {
    single: 24,
    swap: {
      size: 18,
      containerWidth: 24,
      containerHeight: 24,
    },
    pair: {
      size: 18,
      containerWidth: 28,
      containerHeight: 18,
    },
    platform: {
      size: 24,
      containerWidth: 24,
      containerHeight: 24,
    },
  },
  lg: {
    single: 40,
    swap: {
      size: 30,
      containerWidth: 40,
      containerHeight: 40,
    },
    pair: {
      size: 26,
      containerWidth: 40,
      containerHeight: 26,
    },
    platform: {
      size: 40,
      containerWidth: 40,
      containerHeight: 40,
    },
  },
} as const;

/** Size variants for the Asset component: "sm", "md", or "lg" */
export type AssetSize = keyof typeof ASSET_SIZES;

/** Display variants for asset presentation: single asset, swap, pair, or platform */
type AssetVariant = "single" | "swap" | "pair" | "platform";

/**
 * Asset source configuration
 *
 * Defines the properties needed to display an asset image.
 *
 * @property {ImageSourcePropType | string} image - The image source - can be either:
 *   - An imported image (e.g., `logos.stellar`)
 *   - A remote URL as string (e.g., "https://example.com/logo.png")
 * @property {string} altText - Accessible description of the image for screen readers
 * @property {string} [backgroundColor] - Optional custom background color for the asset
 *   (defaults to the theme's background color if not provided)
 * @property {() => React.ReactNode} [renderContent] - Optional function to render custom content
 *   instead of an image (e.g., for displaying text or other components)
 */
export type AssetSource = {
  /** Image URL */
  image?: ImageSourcePropType | string;
  /** Image alt text (for accessibility) */
  altText: string;
  /** Custom background color */
  backgroundColor?: string;
  /** Custom content renderer */
  renderContent?: () => React.ReactNode;
};

/**
 * Base props for the Asset component
 *
 * @property {AssetSize} [size] - Size variant for the component ("sm", "md", or "lg").
 *   Defaults to "lg" if not specified.
 * @property {AssetSource} sourceOne - Primary asset source configuration
 * @property {string} [testID] - Optional test identifier for testing purposes
 */
export type AssetBaseProps = {
  /** Asset size (defaults to "lg" if not specified) */
  size?: AssetSize;
  /** First asset source */
  sourceOne: AssetSource;
  /** Test identifier */
  testID?: string;
};

/**
 * Props for a single asset display
 *
 * Used when displaying a standalone token/asset image.
 */
export type SingleAssetProps = {
  /** Asset or asset pair variant */
  variant: "single";
  sourceTwo?: undefined;
};

/**
 * Props for multi-asset display variants
 *
 * Used for "swap", "pair", and "platform" variants where two assets
 * are displayed together with different positioning.
 *
 * @property {AssetSource} sourceTwo - Secondary asset source configuration,
 *   displayed with positioning based on the selected variant
 */
export type MultiAssetProps = {
  /** Asset or asset pair variant */
  variant: "swap" | "pair" | "platform";
  /** Second asset source */
  sourceTwo: AssetSource;
};

/**
 * Combined props for the Asset component
 *
 * Allows the component to accept different prop combinations based on
 * the selected variant, ensuring type safety and proper prop validation.
 */
export type AssetProps = (SingleAssetProps | MultiAssetProps) & AssetBaseProps;

// =============================================================================
// Helper functions
// =============================================================================

// Helper to get container width based on size and variant
const getContainerWidth = ($size: AssetSize, $variant: AssetVariant) => {
  if ($variant === "single") {
    return px(ASSET_SIZES[$size].single);
  }
  return px(ASSET_SIZES[$size][$variant].containerWidth);
};

// Helper to get container height based on size and variant
const getContainerHeight = ($size: AssetSize, $variant: AssetVariant) => {
  if ($variant === "single") {
    return px(ASSET_SIZES[$size].single);
  }
  return px(ASSET_SIZES[$size][$variant].containerHeight);
};

// Helper to get asset width
const getAssetWidth = (
  $size: AssetSize,
  $variant: AssetVariant,
  $isSecond?: boolean,
) => {
  if ($variant === "single") {
    return px(ASSET_SIZES[$size].single);
  }

  if ($variant === "platform" && $isSecond) {
    return px(ASSET_SIZES[$size][$variant].size / 2);
  }

  return px(ASSET_SIZES[$size][$variant].size);
};

// Helper to get asset height
const getAssetHeight = (
  $size: AssetSize,
  $variant: AssetVariant,
  $isSecond?: boolean,
) => {
  if ($variant === "single") {
    return px(ASSET_SIZES[$size].single);
  }

  if ($variant === "platform" && $isSecond) {
    return px(ASSET_SIZES[$size][$variant].size / 2);
  }

  return px(ASSET_SIZES[$size][$variant].size);
};

// Helper to get border radius
const getBorderRadius = (
  $size: AssetSize,
  $variant: AssetVariant,
  $isSecond?: boolean,
) => {
  if ($variant === "single") {
    return px(ASSET_SIZES[$size].single / 2);
  }

  if ($variant === "platform" && $isSecond) {
    return px(ASSET_SIZES[$size][$variant].size / 4);
  }

  return px(ASSET_SIZES[$size][$variant].size / 2);
};

// Helper to get position styles for second asset
const getAssetPositionStyle = ($variant: AssetVariant, $isSecond?: boolean) => {
  if (!$isSecond) {
    return `
      position: absolute;
      z-index: 1;
      left: 0;
      top: 0;
    `;
  }

  if ($variant === "swap") {
    return `
      position: absolute;
      z-index: 1;
      right: 0;
      bottom: 0;
    `;
  }

  if ($variant === "pair") {
    return `
      position: absolute;
      z-index: 1;
      right: 0;
      top: 0;
    `;
  }

  if ($variant === "platform") {
    return `
      position: absolute;
      z-index: 1;
      left: 0;
      bottom: ${px(1)};
    `;
  }

  return "";
};

// =============================================================================
// Styled components
// =============================================================================

interface StyledAssetContainerProps {
  $size: AssetSize;
  $variant: AssetVariant;
}

const AssetContainer = styled.View<StyledAssetContainerProps>`
  display: flex;
  flex-direction: row;
  align-items: center;
  position: relative;
  width: ${(props: StyledAssetContainerProps) =>
    getContainerWidth(props.$size, props.$variant)};
  height: ${(props: StyledAssetContainerProps) =>
    getContainerHeight(props.$size, props.$variant)};
`;

interface AssetImageContainerProps {
  $size: AssetSize;
  $variant: AssetVariant;
  $isSecond?: boolean;
  $backgroundColor?: string;
  testID?: string;
}

const AssetImageContainer = styled.View<AssetImageContainerProps>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${(props: AssetImageContainerProps) =>
    getAssetWidth(props.$size, props.$variant, props.$isSecond)};
  height: ${(props: AssetImageContainerProps) =>
    getAssetHeight(props.$size, props.$variant, props.$isSecond)};
  border-radius: ${(props: AssetImageContainerProps) =>
    getBorderRadius(props.$size, props.$variant, props.$isSecond)};
  background-color: ${({ $backgroundColor }: AssetImageContainerProps) =>
    $backgroundColor || THEME.colors.background.default};
  border-width: ${px(1)};
  border-color: ${THEME.colors.border.default};
  overflow: hidden;

  ${(props: AssetImageContainerProps) =>
    getAssetPositionStyle(props.$variant, props.$isSecond)}
`;

const AssetImage = styled.Image`
  width: 100%;
  height: 100%;
`;

// =============================================================================
// Component
// =============================================================================

/**
 * Asset Component
 *
 * A flexible component for displaying asset images (tokens, cryptocurrencies, etc.)
 * in a consistent circular format with various presentation options.
 *
 * Features:
 * - Multiple size variants: "sm", "md", and "lg" to fit different UI contexts
 * - Four display variants:
 *   - "single": displays a single asset (for individual tokens)
 *   - "swap": displays two assets with the second overlapping in bottom-right (for token swaps)
 *   - "pair": displays two assets side by side (for trading pairs)
 *   - "platform": displays two assets with a platform logo overlaid (for protocol assets)
 * - Supports both local assets (imported from the asset system) and remote images (URLs)
 * - Supports custom content rendering (e.g., text or other components)
 * - Consistent styling with border and background
 * - Customizable background colors for specific assets
 *
 * The component handles proper positioning and sizing internally, adapting to the
 * selected variant and ensuring assets are displayed with the correct visual hierarchy.
 *
 * @param {AssetProps} props - The component props
 * @param {AssetVariant} props.variant - Display variant: "single", "swap", "pair", or "platform"
 * @param {AssetSize} [props.size] - Size variant: "sm", "md", or "lg". Defaults to "lg" if not specified.
 * @param {AssetSource} props.sourceOne - Primary asset source properties
 * @param {AssetSource} [props.sourceTwo] - Secondary asset source (required for multi-asset variants)
 * @param {string} [props.testID] - Optional test identifier for testing purposes
 * @returns {JSX.Element} The rendered Asset component
 *
 * @example
 * // Single asset with local image (using default size "lg")
 * import { logos } from "assets/logos";
 *
 * <Asset
 *   variant="single"
 *   sourceOne={{
 *     image: logos.stellar,
 *     altText: "Stellar Logo",
 *     backgroundColor: "#041A40" // Optional background color
 *   }}
 * />
 *
 * @example
 * // Token swap representation with explicitly set size
 * <Asset
 *   variant="swap"
 *   size="md"
 *   sourceOne={{
 *     image: logos.stellar,
 *     altText: "Stellar Logo"
 *   }}
 *   sourceTwo={{
 *     image: "https://example.com/usdc-logo.png",
 *     altText: "USDC Logo"
 *   }}
 * />
 *
 * @example
 * // Trading pair representation
 * <Asset
 *   variant="pair"
 *   size="lg"
 *   sourceOne={{
 *     image: logos.stellar,
 *     altText: "Stellar Logo"
 *   }}
 *   sourceTwo={{
 *     image: "https://example.com/usdc-logo.png",
 *     altText: "USDC Logo"
 *   }}
 * />
 *
 * @example
 * // Platform asset representation
 * <Asset
 *   variant="platform"
 *   size="lg"
 *   sourceOne={{
 *     image: "https://example.com/token-logo.png",
 *     altText: "Token Logo"
 *   }}
 *   sourceTwo={{
 *     image: logos.stellar,
 *     altText: "Stellar Platform Logo"
 *   }}
 * />
 */
export const Asset: React.FC<AssetProps> = ({
  variant,
  size = "lg",
  sourceOne,
  sourceTwo,
  testID = "asset",
}: AssetProps) => {
  const renderImage = (source: AssetSource, isSecond = false) => (
    <AssetImageContainer
      $size={size}
      $variant={variant}
      $isSecond={isSecond}
      $backgroundColor={source.backgroundColor}
      testID={`${testID}-image-${isSecond ? "two" : "one"}`}
    >
      {source.renderContent ? (
        source.renderContent()
      ) : (
        <AssetImage
          // This will allow handling both local and remote images
          source={
            typeof source.image === "string"
              ? { uri: source.image }
              : source.image
          }
          accessibilityLabel={source.altText}
        />
      )}
    </AssetImageContainer>
  );

  return (
    <AssetContainer $size={size} $variant={variant} testID={testID}>
      {renderImage(sourceOne)}
      {sourceTwo && renderImage(sourceTwo, true)}
    </AssetContainer>
  );
};
