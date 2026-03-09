import FastImage from "@d11/react-native-fast-image";
import { logos } from "assets/logos";
import { Text } from "components/sds/Typography";
import {
  CIRCLE_USDC_ISSUER,
  CIRCLE_USDC_CONTRACT,
  NATIVE_TOKEN_CODE,
  USDC_CODE,
} from "config/constants";
import { THEME } from "config/theme";
import { useTokenIconsStore } from "ducks/tokenIcons";
import { px } from "helpers/dimensions";
import { ICON_VALIDATION_TIMEOUT } from "helpers/validateIconUrl";
import React, { useEffect } from "react";
import { ImageSourcePropType, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
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

const TokenImage = styled(FastImage)`
  width: 100%;
  height: 100%;
`;

const TokenLoader: React.FC = () => {
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
          backgroundColor: THEME.colors.border.default,
        },
        style,
      ]}
    />
  );
};

// =============================================================================
// Component
// =============================================================================

// ---------------------------------------------------------------------------
// State machine for the image loading lifecycle.
//
//   idle     → No URL available.   Show: fallback only.
//   loading  → URL present, image fetching.  Show: fallback + loader overlay.
//   loaded   → onLoadEnd confirmed.  Show: image only.
//   fallback → Load failed / timed out.  Show: fallback only.
//              <TokenImage> is removed from the tree to prevent React Native
//              Image from retrying a failed URL autonomously.
//
// The same URL in loading/loaded state blocks re-dispatch, preventing flicker
// and redundant network hits.
// ---------------------------------------------------------------------------

enum IconPhase {
  IDLE = "idle",
  LOADING = "loading",
  LOADED = "loaded",
  FALLBACK = "fallback",
}

enum IconActionType {
  START_LOADING = "START_LOADING",
  LOADED = "LOADED",
  FAILED = "FAILED",
  TIMEOUT = "TIMEOUT",
  CLEAR = "CLEAR",
}

/** Sentinel URL used for Metro-bundled (local) assets that don't need fetching. */
const LOCAL_ASSET_URL = "__local__";

interface IconLoadState {
  phase: IconPhase;
  /** The URL string we most recently dispatched START_LOADING for. */
  activeUrl: string | undefined;
}

type IconLoadAction =
  | { type: IconActionType.START_LOADING; url: string }
  | { type: IconActionType.LOADED }
  | { type: IconActionType.FAILED }
  | { type: IconActionType.TIMEOUT }
  | { type: IconActionType.CLEAR };

function iconLoadReducer(
  state: IconLoadState,
  action: IconLoadAction,
): IconLoadState {
  switch (action.type) {
    case IconActionType.START_LOADING:
      return { phase: IconPhase.LOADING, activeUrl: action.url };
    case IconActionType.LOADED:
      // Guard: don't transition if there's nothing active (e.g. component
      // already cleared). The key=activeUrl prop on TokenImage forces a
      // remount whenever the URL changes, so stale onLoad callbacks from
      // an old source are discarded before they can reach this reducer.
      if (!state.activeUrl) return state;
      return { phase: IconPhase.LOADED, activeUrl: state.activeUrl };
    case IconActionType.FAILED:
    case IconActionType.TIMEOUT:
      // Guard: only transition to fallback while actively loading.
      if (state.phase !== IconPhase.LOADING) return state;
      return { phase: IconPhase.FALLBACK, activeUrl: state.activeUrl };
    case IconActionType.CLEAR:
      return { phase: IconPhase.IDLE, activeUrl: undefined };
    default:
      return state;
  }
}

// Shared style for hiding the image element while it loads (prevents a white
// flash before onLoadEnd fires, while keeping the element in the tree so that
// onLoadEnd / onError callbacks are active).
const hiddenImageStyle = StyleSheet.create({
  hidden: { opacity: 0 },
});

// Component to handle image loading with guaranteed fallback, load-once
// caching, and animated loader overlay.
const ImageWithFallback: React.FC<{
  source: TokenSource;
}> = ({ source }) => {
  // Metro-bundled assets are numbers (require() results), not strings.
  // Start in LOADED immediately to avoid a fallback flash on first render.
  const isInitiallyLocalAsset =
    source.image !== undefined && typeof source.image !== "string";

  const [state, dispatch] = React.useReducer(
    iconLoadReducer,
    undefined,
    (): IconLoadState =>
      isInitiallyLocalAsset
        ? { phase: IconPhase.LOADED, activeUrl: LOCAL_ASSET_URL }
        : { phase: IconPhase.IDLE, activeUrl: undefined },
  );

  // Ref so timeout callbacks always read the current phase without being
  // listed in the effect dependency array.
  const stateRef = React.useRef(state);
  stateRef.current = state;

  // -------------------------------------------------------------------------
  // Source.token path — used when Token is rendered standalone (not via
  // TokenIconWithStore, which manages validation externally).
  // -------------------------------------------------------------------------
  const tokenCode = source.token?.code;
  const tokenIssuer = source.token?.issuer;

  const icon = useTokenIconsStore(
    React.useCallback(
      (storeState) => {
        if (!tokenCode || !tokenIssuer) return null;
        if (tokenCode === NATIVE_TOKEN_CODE) return null;
        return storeState.icons[`${tokenCode}:${tokenIssuer}`];
      },
      [tokenCode, tokenIssuer],
    ),
  );

  const validateIconOnAccess = useTokenIconsStore(
    (storeState) => storeState.validateIconOnAccess,
  );

  useEffect(() => {
    if (!tokenCode || !tokenIssuer || icon === null) return;
    if (tokenCode === NATIVE_TOKEN_CODE) return;
    if (icon && icon.isValidated !== true && icon.isValid !== false) {
      validateIconOnAccess(`${tokenCode}:${tokenIssuer}`);
    }
  }, [tokenCode, tokenIssuer, icon, validateIconOnAccess]);
  // -------------------------------------------------------------------------
  // end source.token path
  // -------------------------------------------------------------------------

  // Resolve the final image URL from props or the store.
  const isNativeToken = tokenCode === NATIVE_TOKEN_CODE;
  const isUSDC =
    tokenCode === USDC_CODE &&
    (tokenIssuer === CIRCLE_USDC_ISSUER ||
      tokenIssuer === CIRCLE_USDC_CONTRACT);

  const resolvedIconUrl =
    icon?.isValid === false
      ? icon?.lastValidImageUrl
      : icon?.imageUrl || icon?.lastValidImageUrl;

  let finalImageUrl: ImageSourcePropType | string | undefined = source.image;
  if (isNativeToken) {
    finalImageUrl = source.image || logos.stellar;
  } else if (isUSDC) {
    // Treat USDC like native - always use bundled logo
    finalImageUrl = source.image || logos.usdc;
  } else if (source.token) {
    // Standalone path: store-resolved URL with source.image as ultimate fallback
    finalImageUrl = resolvedIconUrl || source.image;
  }
  // TokenIconWithStore path: finalImageUrl = source.image (resolved upstream)

  // Local (Metro-bundled) assets are numbers/objects, not strings.
  // They load from the bundle synchronously — no network, no timeout needed.
  const isLocalAsset =
    finalImageUrl !== undefined && typeof finalImageUrl !== "string";

  // String URL driving the state machine.  Trimmed-empty strings → undefined.
  const targetUrl: string | undefined =
    typeof finalImageUrl === "string" && finalImageUrl.trim()
      ? finalImageUrl
      : undefined;

  // Skip animation for cached images, last-valid-URL fallbacks, and bundled
  // assets — all load near-instantly with no spinner needed.
  const isUsingLastValidUrl =
    !!icon?.lastValidImageUrl &&
    typeof finalImageUrl === "string" &&
    finalImageUrl === icon.lastValidImageUrl &&
    icon?.isValid !== true;

  const skipAnimation =
    !!source.skipImageLoader || isUsingLastValidUrl || isNativeToken;

  // -------------------------------------------------------------------------
  // State machine effect — drives icon load/fail/timeout transitions.
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Local assets: always transition to loading so <TokenImage> renders;
    // onLoadEnd fires immediately and advances to loaded.
    if (isLocalAsset) {
      if (stateRef.current.phase !== IconPhase.LOADED) {
        dispatch({ type: IconActionType.START_LOADING, url: LOCAL_ASSET_URL });
      }
      return undefined;
    }

    // No URL available — show fallback immediately.
    if (!targetUrl) {
      dispatch({ type: IconActionType.CLEAR });
      return undefined;
    }

    const { phase, activeUrl } = stateRef.current;

    // Same URL already loading, loaded, or failed — no action needed.
    if (
      activeUrl === targetUrl &&
      (phase === IconPhase.LOADING || phase === IconPhase.LOADED)
    ) {
      return undefined;
    }

    if (activeUrl === targetUrl && phase === IconPhase.FALLBACK) {
      return undefined;
    }

    // New or changed URL: start loading.
    dispatch({ type: IconActionType.START_LOADING, url: targetUrl });

    // Cached or bundled images load near-instantly; onError handles failures.
    if (skipAnimation) {
      return undefined;
    }

    // Hard timeout: if onLoadEnd hasn't fired within the window, show fallback.
    const timeoutId = setTimeout(() => {
      if (stateRef.current.phase === IconPhase.LOADING) {
        dispatch({ type: IconActionType.TIMEOUT });
      }
    }, ICON_VALIDATION_TIMEOUT);

    return () => clearTimeout(timeoutId);
  }, [targetUrl, isLocalAsset, skipAnimation]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const { phase } = state;

  // Visible until the image confirms loaded; ensures something is always shown.
  const showFallback = phase !== IconPhase.LOADED;

  // Pulsing overlay shown while loading or while store validation is in-flight.
  // Suppressed for cached and bundled assets that appear near-instantly.
  const showLoader =
    phase !== IconPhase.LOADED &&
    !skipAnimation &&
    (!!source.isLoading || phase === IconPhase.LOADING);

  // Image element present only while loading or loaded; removed on fallback/idle
  // to prevent React Native Image from retrying a known-failed URL.
  const renderTokenImage =
    phase === IconPhase.LOADING || phase === IconPhase.LOADED;

  const fallbackText = source.token?.code?.slice(0, 2) || "?";

  const renderFallbackContent = () => {
    if (source.renderContent) {
      const customContent = source.renderContent();
      if (customContent) {
        return customContent;
      }
    }

    return (
      <Text xs secondary semiBold>
        {fallbackText}
      </Text>
    );
  };

  return (
    <View className="w-full h-full relative items-center justify-center">
      {/* Fallback content — always visible as background until image loads. */}
      {showFallback && (
        <View className="absolute inset-0 items-center justify-center">
          {renderFallbackContent()}
        </View>
      )}

      {/* Loader animation — pulsing overlay on the fallback while loading. */}
      {showLoader && <TokenLoader />}

      {/* Image — rendered only while loading / loaded (hidden while loading,
          removed from tree on fallback to prevent autonomous RN retries).
          key=activeUrl forces remount when the URL changes, which discards
          any stale onLoad/onError callbacks from the previous source. */}
      {renderTokenImage && (
        <TokenImage
          key={state.activeUrl}
          source={
            typeof finalImageUrl === "string"
              ? { uri: finalImageUrl }
              : (finalImageUrl as ImageSourcePropType)
          }
          accessibilityLabel={source.altText}
          onError={() => dispatch({ type: IconActionType.FAILED })}
          onLoad={() => dispatch({ type: IconActionType.LOADED })}
          style={
            phase === IconPhase.LOADED ? undefined : hiddenImageStyle.hidden
          }
        />
      )}
    </View>
  );
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
