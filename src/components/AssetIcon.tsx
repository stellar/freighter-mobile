import { logos } from "assets/logos";
import { Asset, AssetSize } from "components/sds/Asset";
import { Text } from "components/sds/Typography";
import {
  AssetToken,
  AssetTypeWithCustomToken,
  Balance,
  NativeToken,
} from "config/types";
import { useAssetIconsStore } from "ducks/assetIcons";
import { getTokenIdentifier, isLiquidityPool } from "helpers/balances";
import React from "react";

/**
 * Union type representing a native XLM token, a non-native Stellar asset, or a Soroban token
 */
type Token = AssetToken | NativeToken;

/**
 * Props for the AssetIcon component
 * @property {Token | Balance} token - The token or balance to display an icon for
 * @property {AssetSize} [size="lg"] - Size variant for the icon ("sm" | "md" | "lg")
 * @property {string} [backgroundColor] - Optional custom background color for the icon
 */
interface AssetIconProps {
  /** The token to display */
  token: Token | Balance;
  /** Optional size variant (defaults to "lg") */
  size?: AssetSize;
  /** Optional custom background color */
  backgroundColor?: string;
}

/**
 * AssetIcon Component
 *
 * A wrapper around the SDS Asset component that handles token-specific icon display.
 * Provides consistent icon rendering for different token types in the Stellar ecosystem.
 *
 * Features:
 * - For native XLM tokens, displays the Stellar logo
 * - For liquidity pool tokens, displays "LP" text
 * - For other tokens, fetches and displays their icon from the asset icons store
 * - Falls back to token initials if no image is available
 *
 * @example
 * // Native XLM token
 * <AssetIcon token={{ type: "native", code: "XLM" }} />
 *
 * // Custom asset with background
 * <AssetIcon
 *   token={{ code: "USDC", issuer: { key: "..." } }}
 *   backgroundColor="#f0f0f0"
 * />
 *
 * @param {AssetIconProps} props - Component props
 * @returns {JSX.Element} The rendered asset icon
 */
export const AssetIcon: React.FC<AssetIconProps> = ({
  token: tokenProp,
  size = "lg",
  backgroundColor,
}) => {
  const icons = useAssetIconsStore((state) => state.icons);

  // For liquidity pool tokens, display "LP" text
  if (isLiquidityPool(tokenProp as Balance)) {
    return (
      <Asset
        variant="single"
        size={size}
        sourceOne={{
          image: "",
          altText: "Liquidity Pool icon",
          backgroundColor,
          renderContent: () => (
            <Text sm bold secondary>
              LP
            </Text>
          ),
        }}
      />
    );
  }

  let token: Token;

  if ("contractId" in tokenProp) {
    token = {
      ...tokenProp,
      type: AssetTypeWithCustomToken.CUSTOM_TOKEN,
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

  // For native XLM token, use the Stellar logo
  if (token.type === AssetTypeWithCustomToken.NATIVE) {
    return (
      <Asset
        variant="single"
        size={size}
        sourceOne={{
          image: logos.stellar,
          altText: "XLM token icon",
          backgroundColor,
        }}
      />
    );
  }

  // For Soroban custom tokens, use the Soroban logo
  if (token.type === AssetTypeWithCustomToken.CUSTOM_TOKEN) {
    const tokenIdentifier = getTokenIdentifier(token);
    let icon = icons[tokenIdentifier];
    let imageUrl = icon?.imageUrl || "";

    if (!imageUrl) {
      const matchingKey = Object.keys(icons).find((key) =>
        key.startsWith(`${token.code}:`),
      );
      if (matchingKey) {
        icon = icons[matchingKey];
        imageUrl = icon?.imageUrl || "";
      }
    }

    if (imageUrl) {
      return (
        <Asset
          variant="single"
          size={size}
          sourceOne={{
            image: imageUrl,
            altText: `${token.code} token icon`,
            backgroundColor,
          }}
        />
      );
    }

    // Fallback: mostrar as iniciais do token
    const tokenInitials = token.code.slice(0, 2);
    return (
      <Asset
        variant="single"
        size={size}
        sourceOne={{
          altText: `${token.code} token icon`,
          backgroundColor,
          renderContent: () => (
            <Text sm bold secondary>
              {tokenInitials}
            </Text>
          ),
        }}
      />
    );
  }

  // For other tokens, get the icon URL from the store
  const tokenIdentifier = getTokenIdentifier(token);
  const icon = icons[tokenIdentifier];
  const imageUrl = icon?.imageUrl || "";

  // Fallback to initials if no image is available
  const tokenInitials = token.code.slice(0, 2);
  const renderContent = !imageUrl
    ? () => (
        <Text sm bold secondary>
          {tokenInitials}
        </Text>
      )
    : undefined;

  return (
    <Asset
      variant="single"
      size={size}
      sourceOne={{
        image: imageUrl,
        altText: `${token.code} token icon`,
        backgroundColor,
        renderContent,
      }}
    />
  );
};
