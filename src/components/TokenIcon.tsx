import { logos } from "assets/logos";
import SorobanTokenIcon from "assets/logos/icon-soroban.svg";
import { Token as TokenComponent, TokenSize } from "components/sds/Token";
import { Text } from "components/sds/Typography";
import { TokenTypeWithCustomToken, Balance, Token } from "config/types";
import { useTokenIconsStore } from "ducks/tokenIcons";
import { getTokenIdentifier, isLiquidityPool } from "helpers/balances";
import React from "react";
import { useTranslation } from "react-i18next";

/**
 * Props for the TokenIcon component
 * @property {Token | Balance} token - The token or balance to display an icon for
 * @property {Size} [size="lg"] - Size variant for the icon ("sm" | "md" | "lg")
 * @property {string} [backgroundColor] - Optional custom background color for the icon
 */
interface TokenIconProps {
  /** The token to display */
  token: Token | Balance;
  /** Optional size variant (defaults to "lg") */
  size?: TokenSize;
  /** Optional custom background color */
  backgroundColor?: string;
  /** Optional icon URL, takes precedence over cache */
  iconUrl?: string;
}

/**
 * TokenIcon Component
 *
 * A wrapper around the SDS Token component that handles token-specific icon display.
 * Provides consistent icon rendering for different token types in the Stellar ecosystem.
 *
 * Features:
 * - For native XLM tokens, displays the Stellar logo
 * - For liquidity pool tokens, displays "LP" text
 * - For other tokens, fetches and displays their icon from the token icons store
 * - Falls back to token initials if no image is available
 *
 * @example
 * // Native XLM token
 * <TokenIcon token={{ type: "native", code: "XLM" }} />
 *
 * // Custom token with background
 * <TokenIcon
 *   token={{ code: "USDC", issuer: { key: "..." } }}
 *   backgroundColor="#f0f0f0"
 * />
 *
 * @param {TokenIconProps} props - Component props
 * @returns {JSX.Element} The rendered token icon
 */
export const TokenIcon: React.FC<TokenIconProps> = ({
  token: tokenProp,
  size = "lg",
  backgroundColor,
  iconUrl,
}) => {
  const { t } = useTranslation();

  const getFallbackTextSize = (tokenSize: TokenSize) => {
    switch (tokenSize) {
      case "sm":
        return "xs";
      case "md":
        return "sm";
      case "lg":
        return "md";
      default:
        return "md";
    }
  };

  // Memoize fallback text size since it only depends on size prop
  const fallbackTextSize = React.useMemo(
    () => getFallbackTextSize(size),
    [size],
  );

  // Normalize token prop early so hooks can depend on it
  const token: Token = React.useMemo(() => {
    if ("contractId" in tokenProp) {
      return {
        ...tokenProp,
        type: TokenTypeWithCustomToken.CUSTOM_TOKEN,
        code: tokenProp.symbol,
        issuer: {
          key: tokenProp.contractId,
        },
      };
    }
    if ("token" in tokenProp) {
      return tokenProp.token;
    }
    return tokenProp as Token;
  }, [tokenProp]);

  // Compute identifier
  const tokenIdentifier = React.useMemo(() => {
    // Basic check for LP first (though isLiquidityPool check happens later for rendering,
    // we need an identifier for the hook)
    if (isLiquidityPool(tokenProp)) return "LP";

    if (token.type === TokenTypeWithCustomToken.NATIVE) return "native";
    return getTokenIdentifier(token);
  }, [tokenProp, token]);

  // Optimize store subscription: Select only the needed icon
  // Note: We use useTokenIconsStore with a selector to avoid re-renders on every store update
  const icon = useTokenIconsStore(
    React.useCallback(
      (state) => state.icons[tokenIdentifier],
      [tokenIdentifier],
    ),
  );

  // Select validate action (stable reference)
  const validateIconOnAccess = useTokenIconsStore(
    (state) => state.validateIconOnAccess,
  );

  const isLoading = !iconUrl && icon && !icon.isValidated && !!icon.imageUrl;

  React.useEffect(() => {
    if (!iconUrl && icon && icon.isValidated === false) {
      validateIconOnAccess(tokenIdentifier);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    iconUrl,
    icon?.isValidated,
    icon?.imageUrl,
    tokenIdentifier,
    validateIconOnAccess,
  ]);

  // Render callbacks
  const renderLPContent = React.useCallback(
    () => (
      <Text size={fallbackTextSize} bold secondary isVerticallyCentered>
        LP
      </Text>
    ),
    [fallbackTextSize],
  );

  const renderSorobanContent = React.useCallback(
    () => <SorobanTokenIcon />,
    [],
  );

  const renderInitialsContent = React.useCallback(
    () => (
      <Text size={fallbackTextSize} bold secondary isVerticallyCentered>
        {token.code?.slice(0, size === "sm" ? 1 : 2) || ""}
      </Text>
    ),
    [fallbackTextSize, token.code, size],
  );

  // Liquidity pool: show "LP" text
  if (isLiquidityPool(tokenProp)) {
    return (
      <TokenComponent
        variant="single"
        size={size}
        sourceOne={{
          altText: t("tokenIconAlt", { code: "LP" }),
          backgroundColor,
          renderContent: renderLPContent,
        }}
      />
    );
  }

  // Native XLM: show Stellar logo
  if (token.type === TokenTypeWithCustomToken.NATIVE) {
    return (
      <TokenComponent
        variant="single"
        size={size}
        sourceOne={{
          altText: t("tokenIconAlt", { code: "XLM" }),
          backgroundColor,
          image: logos.stellar,
        }}
      />
    );
  }

  const finalImageUrl = iconUrl || (icon?.isValid ? icon.imageUrl : undefined);
  const skipImageLoader = !iconUrl && !!icon?.isValidated;

  // Soroban custom tokens: show icon if available, otherwise SorobanTokenIcon
  if (token.type === TokenTypeWithCustomToken.CUSTOM_TOKEN) {
    return (
      <TokenComponent
        variant="single"
        size={size}
        sourceOne={{
          altText: t("tokenIconAlt", { code: token.code }),
          backgroundColor,
          image: finalImageUrl,
          isLoading,
          skipImageLoader,
          // Fallback: show SorobanTokenIcon for Soroban custom tokens
          // in case the specific icon is not available
          renderContent: renderSorobanContent,
        }}
      />
    );
  }

  return (
    <TokenComponent
      variant="single"
      size={size}
      sourceOne={{
        altText: t("tokenIconAlt", { code: token.code }),
        backgroundColor,
        image: finalImageUrl,
        isLoading,
        skipImageLoader,
        // Fallback: show token initials if the icon is not available
        renderContent: renderInitialsContent,
      }}
    />
  );
};
