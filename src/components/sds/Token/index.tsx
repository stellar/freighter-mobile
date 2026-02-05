import { NATIVE_TOKEN_CODE } from "config/constants";
import { THEME } from "config/theme";
import { useTokenIconsStore } from "ducks/tokenIcons";
import { px } from "helpers/dimensions";
import React, { useState, useEffect } from "react";
import { ImageSourcePropType, View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import styled from "styled-components/native";

// =============================================================================
// Constants and types
// =============================================================================

/**
 * Size configurations for the Token component
 *
 * Defines the dimensions and spacing for different size variants and display modes.
 * All measurements are in pixels before scaling.
 *
 * Each size variant ("sm", "md", "lg") contains:
 * - `single`: Dimension for single token display
 * - `swap`: Settings for the swap variant (two tokens with second overlapping)
 * - `pair`: Settings for the pair variant (two tokens side by side)
 * - `platform`: Settings for the platform variant (main token with smaller platform logo)
 *
 * Each variant configuration includes:
 * - `size`: The dimension of the individual token
 * - `containerWidth`: Total width of the component
 * - `containerHeight`: Total height of the component
 */
const TOKEN_SIZES = {
  sm: {
    single: 16,
    swap: {
      size: 15,
      containerWidth: 16,
      containerHeight: 16,
    },
    pair: {
      size: 15,
      containerWidth: 20,
      containerHeight: 15,
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

/** Size variants for the Token component: "sm", "md", or "lg" */
export type TokenSize = keyof typeof TOKEN_SIZES;

/** Display variants for token presentation: single token, swap, pair, or platform */
type TokenVariant = "single" | "swap" | "pair" | "platform";

/**
 * Token source configuration
 *
 * Defines the properties needed to display a token image.
 *
 * @property {ImageSourcePropType | string} [image] - The image source - can be either:
 *   - An imported image (e.g., `logos.stellar`)
 *   - A remote URL as string (e.g., "https://example.com/logo.png")
 *   - If provided and valid, this takes priority over `renderContent`
 * @property {string} altText - Accessible description of the image for screen readers
 * @property {string} [backgroundColor] - Optional custom background color for the token
 *   (defaults to the theme's background color if not provided)
 * @property {() => React.ReactNode} [renderContent] - Optional function to render custom content
 *   as a fallback when `image` is not provided or invalid (e.g., for displaying text or other components).
 *   Only rendered if `image` is not available or invalid.
 * @property {object} [token] - Optional token data for lazy validation
 *   When provided, the image will be validated and cached using the token icon store
 *   (similar to TokenIcon behavior). The token code will be used for fallback text.
 * @property {string} [token.code] - Token code (e.g., "XLM", "ARST")
 * @property {string} [token.issuer] - Token issuer key
 */
export type TokenSource = {
  /** Image URL */
  image?: ImageSourcePropType | string;
  /** Image alt text (for accessibility) */
  altText: string;
  /** Custom background color */
  backgroundColor?: string;
  /** Custom content renderer */
  renderContent?: () => React.ReactNode;
  /** Explicit loading state */
  isLoading?: boolean;
  /** Whether to skip the internal image loading state (e.g. if pre-fetched) */
  skipImageLoader?: boolean;
  /** Optional token data for lazy validation and caching */
  token?: {
    code: string;
    issuer: string;
  };
};

/**
 * Base props for the Token component
 *
 * @property {TokenSize} [size] - Size variant for the component ("sm", "md", or "lg").
 *   Defaults to "lg" if not specified.
 * @property {TokenSource} sourceOne - Primary token source configuration
 * @property {string} [testID] - Optional test identifier for testing purposes
 */
export type TokenBaseProps = {
  /** Token size (defaults to "lg" if not specified) */
  size?: TokenSize;
  /** First token source */
  sourceOne: TokenSource;
  /** Test identifier */
  testID?: string;
};

/**
 * Props for a single token display
 *
 * Used when displaying a standalone token/token image.
 */
export type SingleTokenProps = {
  /** Token or token pair variant */
  variant: "single";
  sourceTwo?: undefined;
};

/**
 * Props for multi-token display variants
 *
 * Used for "swap", "pair", and "platform" variants where two tokens
 * are displayed together with different positioning.
 *
 * @property {TokenSource} sourceTwo - Secondary token source configuration,
 *   displayed with positioning based on the selected variant
 */
export type MultiTokenProps = {
  /** Token or token pair variant */
  variant: "swap" | "pair" | "platform";
  /** Second token source */
  sourceTwo: TokenSource;
};

/**
 * Combined props for the Token component
 *
 * Allows the component to accept different prop combinations based on
 * the selected variant, ensuring type safety and proper prop validation.
 */
export type TokenProps = (SingleTokenProps | MultiTokenProps) & TokenBaseProps;

// =============================================================================
// Helper functions
// =============================================================================

// Helper to get container width based on size and variant
const getContainerWidth = ($size: TokenSize, $variant: TokenVariant) => {
  if ($variant === "single") {
    return px(TOKEN_SIZES[$size].single);
  }
  return px(TOKEN_SIZES[$size][$variant].containerWidth);
};

// Helper to get container height based on size and variant
const getContainerHeight = ($size: TokenSize, $variant: TokenVariant) => {
  if ($variant === "single") {
    return px(TOKEN_SIZES[$size].single);
  }
  return px(TOKEN_SIZES[$size][$variant].containerHeight);
};

// Helper to get token width
const getTokenWidth = (
  $size: TokenSize,
  $variant: TokenVariant,
  $isSecond?: boolean,
) => {
  if ($variant === "single") {
    return px(TOKEN_SIZES[$size].single);
  }

  if ($variant === "platform" && $isSecond) {
    return px(TOKEN_SIZES[$size][$variant].size / 2);
  }

  return px(TOKEN_SIZES[$size][$variant].size);
};

// Helper to get token height
const getTokenHeight = (
  $size: TokenSize,
  $variant: TokenVariant,
  $isSecond?: boolean,
) => {
  if ($variant === "single") {
    return px(TOKEN_SIZES[$size].single);
  }

  if ($variant === "platform" && $isSecond) {
    return px(TOKEN_SIZES[$size][$variant].size / 2);
  }

  return px(TOKEN_SIZES[$size][$variant].size);
};

// Helper to get border radius
const getBorderRadius = (
  $size: TokenSize,
  $variant: TokenVariant,
  $isSecond?: boolean,
) => {
  if ($variant === "single") {
    return px(TOKEN_SIZES[$size].single / 2);
  }

  if ($variant === "platform" && $isSecond) {
    return px(TOKEN_SIZES[$size][$variant].size / 4);
  }

  return px(TOKEN_SIZES[$size][$variant].size / 2);
};

// Helper to get position styles for second token
const getTokenPositionStyle = ($variant: TokenVariant, $isSecond?: boolean) => {
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

interface StyledTokenContainerProps {
  $size: TokenSize;
  $variant: TokenVariant;
}

const TokenContainer = styled.View<StyledTokenContainerProps>`
  display: flex;
  flex-direction: row;
  align-items: center;
  position: relative;
  width: ${(props: StyledTokenContainerProps) =>
    getContainerWidth(props.$size, props.$variant)};
  height: ${(props: StyledTokenContainerProps) =>
    getContainerHeight(props.$size, props.$variant)};
`;

interface TokenImageContainerProps {
  $size: TokenSize;
  $variant: TokenVariant;
  $isSecond?: boolean;
  $backgroundColor?: string;
  testID?: string;
}

const TokenImageContainer = styled.View<TokenImageContainerProps>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${(props: TokenImageContainerProps) =>
    getTokenWidth(props.$size, props.$variant, props.$isSecond)};
  height: ${(props: TokenImageContainerProps) =>
    getTokenHeight(props.$size, props.$variant, props.$isSecond)};
  border-radius: ${(props: TokenImageContainerProps) =>
    getBorderRadius(props.$size, props.$variant, props.$isSecond)};
  background-color: ${({ $backgroundColor }: TokenImageContainerProps) =>
    $backgroundColor || THEME.colors.background.default};
  border-width: ${px(1)};
  border-color: ${THEME.colors.border.default};
  overflow: hidden;

  ${(props: TokenImageContainerProps) =>
    getTokenPositionStyle(props.$variant, props.$isSecond)}
`;

const TokenImage = styled.Image`
  width: 100%;
  height: 100%;
`;

const TokenLoader = () => {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.4, { duration: 1000 }),
      ),
      -1,
      true,
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: THEME.colors.border.default, // Using border color as a neutral placeholder
        },
        style,
      ]}
    />
  );
};

// =============================================================================
// Component
// =============================================================================

// Component to handle image loading with simple fallback on error
const ImageWithFallback: React.FC<{
  source: TokenSource;
}> = ({ source }) => {
  const [hasError, setHasError] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(
    !source.skipImageLoader &&
      !!(source.image && typeof source.image === "string"),
  );

  // Get validated icon from store if token data is provided
  // For native XLM, we'll use the Stellar logo directly
  const icon = useTokenIconsStore(
    React.useCallback(
      (state) => {
        if (!source.token) return null;

        // For native tokens, we don't need to look in store - they use logos.stellar
        if (source.token.code === NATIVE_TOKEN_CODE) {
          return null;
        }

        // Construct identifier the same way as getTokenIdentifier does
        // For non-native tokens: code:issuer
        const identifier = `${source.token.code}:${source.token.issuer}`;
        return state.icons[identifier];
      },
      [source.token],
    ),
  );

  // Get validate action for token icon lazy validation
  const validateIconOnAccess = useTokenIconsStore(
    (state) => state.validateIconOnAccess,
  );

  // Trigger validation when token data is provided and icon needs validation
  React.useEffect(() => {
    if (!source.token || icon === null) return;

    // Skip native tokens - they use logos.stellar directly
    if (source.token.code === NATIVE_TOKEN_CODE) return;

    // Only validate non-native tokens that need it
    if (icon && icon.isValidated === false && icon.isValid !== false) {
      const identifier = `${source.token.code}:${source.token.issuer}`;
      validateIconOnAccess(identifier);
    }
  }, [source.token, icon, validateIconOnAccess]);

  // Determine the final image URL
  // If token data is provided and we have a validated icon, use its imageUrl
  // For native tokens (XLM), return undefined to use fallback (which gets Stellar logo from source.image)
  // Otherwise fall back to the direct image prop
  const finalImageUrl =
    source.token &&
    source.token.code !== NATIVE_TOKEN_CODE &&
    icon?.isValid === true
      ? icon.imageUrl
      : source.image;

  // Check if image is valid (non-empty string or valid ImageSourcePropType)
  const hasValidImage =
    finalImageUrl &&
    (typeof finalImageUrl === "string"
      ? finalImageUrl.trim().length > 0
      : !!finalImageUrl);

  // Reset error state if image source changes
  useEffect(() => {
    setHasError(false);
    setIsImageLoading(
      !source.skipImageLoader &&
        !!(finalImageUrl && typeof finalImageUrl === "string"),
    );

    // If image is loading, timeout after 3 seconds to prevent infinite loading state
    let timeoutId: NodeJS.Timeout | null = null;
    if (
      !source.skipImageLoader &&
      !!(finalImageUrl && typeof finalImageUrl === "string")
    ) {
      timeoutId = setTimeout(() => {
        setIsImageLoading(false);
      }, 3000);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [finalImageUrl, source.skipImageLoader]);

  if (source.isLoading) {
    return <TokenLoader />;
  }

  if (hasValidImage && !hasError) {
    return (
      <View className="w-full h-full relative">
        {/* TokenLoader shown while loading, hidden when image loads */}
        {isImageLoading && <TokenLoader />}
        <TokenImage
          // This will allow handling both local and remote images
          source={
            typeof finalImageUrl === "string"
              ? { uri: finalImageUrl }
              : finalImageUrl
          }
          accessibilityLabel={source.altText}
          onError={() => {
            setHasError(true);
            setIsImageLoading(false);
          }}
          onLoadEnd={() => setIsImageLoading(false)}
          style={isImageLoading ? { opacity: 0 } : undefined}
        />
      </View>
    );
  }

  // Fallback
  return source.renderContent ? <>{source.renderContent()}</> : null;
};

/**
 * Token Component
 *
 * A flexible component for displaying token images (tokens, cryptocurrencies, etc.)
 * in a consistent circular format with various presentation options.
 *
 * Features:
 * - Multiple size variants: "sm", "md", and "lg" to fit different UI contexts
 * - Four display variants:
 *   - "single": displays a single token (for individual tokens)
 *   - "swap": displays two tokens with the second overlapping in bottom-right (for token swaps)
 *   - "pair": displays two tokens side by side (for trading pairs)
 *   - "platform": displays two tokens with a platform logo overlaid (for protocol tokens)
 * - Supports both local tokens (imported from the token system) and remote images (URLs)
 * - Rendering priority: `image` takes priority over `renderContent`. If a valid `image` is provided,
 *   it will be rendered. `renderContent` is only used as a fallback when `image` is not available or invalid.
 * - Supports custom content rendering (e.g., text or other components) as fallback
 * - Consistent styling with border and background
 * - Customizable background colors for specific tokens
 *
 * The component handles proper positioning and sizing internally, adapting to the
 * selected variant and ensuring tokens are displayed with the correct visual hierarchy.
 *
 * @param {TokenProps} props - The component props
 * @param {TokenVariant} props.variant - Display variant: "single", "swap", "pair", or "platform"
 * @param {TokenSize} [props.size] - Size variant: "sm", "md", or "lg". Defaults to "lg" if not specified.
 * @param {TokenSource} props.sourceOne - Primary token source properties
 * @param {TokenSource} [props.sourceTwo] - Secondary token source (required for multi-token variants)
 * @param {string} [props.testID] - Optional test identifier for testing purposes
 * @returns {JSX.Element} The rendered Token component
 *
 * @example
 * // Single token with local image (using default size "lg")
 * import { logos } from "tokens/logos";
 *
 * <Token
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
 * <Token
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
 * <Token
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
 * // Platform token representation
 * <Token
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
 *
 * @example
 * // Token with fallback content (renderContent only used if image is not available)
 * <Token
 *   variant="single"
 *   sourceOne={{
 *     image: "https://example.com/token-logo.png", // This takes priority
 *     altText: "Token Logo",
 *     renderContent: () => <Text>Token</Text> // Fallback if image fails or is invalid
 *   }}
 * />
 */
export const Token: React.FC<TokenProps> = React.memo(
  ({
    variant,
    size = "lg",
    sourceOne,
    sourceTwo,
    testID = "token",
  }: TokenProps) => {
    const renderImage = (source: TokenSource, isSecond = false) => (
      <TokenImageContainer
        $size={size}
        $variant={variant}
        $isSecond={isSecond}
        $backgroundColor={source.backgroundColor}
        testID={`${testID}-image-${isSecond ? "two" : "one"}`}
      >
        <ImageWithFallback source={source} />
      </TokenImageContainer>
    );

    return (
      <TokenContainer $size={size} $variant={variant} testID={testID}>
        {renderImage(sourceOne)}
        {sourceTwo && renderImage(sourceTwo, true)}
      </TokenContainer>
    );
  },
);
