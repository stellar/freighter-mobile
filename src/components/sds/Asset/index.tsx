import { THEME } from "config/theme";
import { px } from "helpers/dimensions";
import React from "react";
import { ImageSourcePropType } from "react-native";
import styled from "styled-components/native";

// =============================================================================
// Constants and types
// =============================================================================

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
    single: 32,
    swap: {
      size: 24,
      containerWidth: 32,
      containerHeight: 32,
    },
    pair: {
      size: 24,
      containerWidth: 36,
      containerHeight: 24,
    },
    platform: {
      size: 32,
      containerWidth: 32,
      containerHeight: 32,
    },
  },
} as const;

type AssetSize = keyof typeof ASSET_SIZES;
type AssetVariant = "single" | "swap" | "pair" | "platform";

/** */
export type AssetSource = {
  /** Image URL */
  image: ImageSourcePropType | string;
  /** Image alt text (for accessibility) */
  altText: string;
  /** Custom background color */
  backgroundColor?: string;
};

/** */
export type AssetBaseProps = {
  /** Asset size */
  size: AssetSize;
  /** First asset source */
  sourceOne: AssetSource;
};

/** */
export type SingleAssetProps = {
  /** Asset or asset pair variant */
  variant: "single";
  sourceTwo?: undefined;
};

/** */
export type MultiAssetProps = {
  /** Asset or asset pair variant */
  variant: "swap" | "pair" | "platform";
  /** Second asset source */
  sourceTwo: AssetSource;
};

/** */
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
const getSecondAssetPositionStyles = (
  $variant: AssetVariant,
  $isSecond?: boolean,
) => {
  if (!$isSecond) {
    return "";
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
    getSecondAssetPositionStyles(props.$variant, props.$isSecond)}
`;

const AssetImage = styled.Image`
  width: 100%;
  height: 100%;
`;

// =============================================================================
// Component
// =============================================================================

/**
 * An asset image displayed in a circle from a URL source. The component can accept multiple sources to show a currency pair, for example.
 */
export const Asset: React.FC<AssetProps> = ({
  variant,
  size,
  sourceOne,
  sourceTwo,
}: AssetProps) => {
  const renderImage = (source: AssetSource, isSecond = false) => (
    <AssetImageContainer
      $size={size}
      $variant={variant}
      $isSecond={isSecond}
      $backgroundColor={source.backgroundColor}
    >
      <AssetImage
        // This will allow handling both local and remote images
        source={
          typeof source.image === "string"
            ? { uri: source.image }
            : source.image
        }
        accessibilityLabel={source.altText}
      />
    </AssetImageContainer>
  );

  return (
    <AssetContainer $size={size} $variant={variant}>
      {renderImage(sourceOne)}
      {sourceTwo ? renderImage(sourceTwo, true) : null}
    </AssetContainer>
  );
};
