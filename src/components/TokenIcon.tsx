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
  const icons = useTokenIconsStore((state) => state.icons);
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

  // Liquidity pool: show "LP" text
  if (isLiquidityPool(tokenProp)) {
    return (
      <TokenComponent
        variant="single"
        size={size}
        sourceOne={{
          image: "",
          altText: t("tokenIconAlt", { code: "LP" }),
          backgroundColor,
          renderContent: () => (
            <Text
              size={getFallbackTextSize(size)}
              bold
              secondary
              isVerticallyCentered
            >
              LP
            </Text>
          ),
        }}
      />
    );
  }

  let token: Token;

  // Normalize token prop
  if ("contractId" in tokenProp) {
    token = {
      ...tokenProp,
      type: TokenTypeWithCustomToken.CUSTOM_TOKEN,
      code: tokenProp.symbol,
      issuer: {
        key: tokenProp.contractId,
      },
    };
  } else if ("token" in tokenProp) {
    token = tokenProp.token;
  } else {
    token = tokenProp as Token;
  }

  // Native XLM: show Stellar logo
  if (token.type === TokenTypeWithCustomToken.NATIVE) {
    return (
      <TokenComponent
        variant="single"
        size={size}
        sourceOne={{
          image: logos.stellar,
          altText: t("tokenIconAlt", { code: "XLM" }),
          backgroundColor,
        }}
      />
    );
  }

  // Soroban custom tokens: show icon if available, otherwise SorobanTokenIcon
  if (token.type === TokenTypeWithCustomToken.CUSTOM_TOKEN) {
    const tokenIdentifier = getTokenIdentifier(token);
    const icon = icons[tokenIdentifier];
    const imageUrl = iconUrl || icon?.imageUrl;

    // If we have a specific icon, use it
    if (imageUrl) {
      return (
        <TokenComponent
          variant="single"
          size={size}
          sourceOne={{
            image: imageUrl,
            altText: t("tokenIconAlt", { code: token.code }),
            backgroundColor,
          }}
        />
      );
    }

    // Fallback: show SorobanTokenIcon for Soroban custom tokens
    return (
      <TokenComponent
        variant="single"
        size={size}
        sourceOne={{
          altText: t("tokenIconAlt", { code: token.code }),
          backgroundColor,
          renderContent: () => <SorobanTokenIcon />,
        }}
      />
    );
  }

  // Classic tokens (and SACs): show icon if available, otherwise show token initials
  const tokenIdentifier = getTokenIdentifier(token);
  const icon = icons[tokenIdentifier];
  const imageUrl = iconUrl || icon?.imageUrl;

  const maxLetters = size === "sm" ? 1 : 2;
  const tokenInitials = token.code?.slice(0, maxLetters) || "";

  const renderContent = !imageUrl
    ? () => (
        <Text
          size={getFallbackTextSize(size)}
          bold
          secondary
          isVerticallyCentered
        >
          {tokenInitials}
        </Text>
      )
    : undefined;

  return (
    <TokenComponent
      variant="single"
      size={size}
      sourceOne={{
        image: imageUrl,
        altText: t("tokenIconAlt", { code: token.code }),
        backgroundColor,
        renderContent,
      }}
    />
  );
};
