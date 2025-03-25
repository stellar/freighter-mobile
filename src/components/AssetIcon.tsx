import { logos } from "assets/logos";
import { Asset, AssetSize } from "components/sds/Asset";
import { Text } from "components/sds/Typography";
import { AssetToken, Balance, NativeToken } from "config/types";
import { useAssetIconsStore } from "ducks/assetIcons";
import { getTokenIdentifier, isLiquidityPool } from "helpers/balances";
import React from "react";

type Token = AssetToken | NativeToken;

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
 * - For native XLM tokens, displays the Stellar logo
 * - For liquidity pool tokens, displays "LP" text
 * - For other tokens, fetches and displays their icon from the asset icons store
 * - Fallback to token initials if no image is available
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
  if ("token" in tokenProp) {
    token = tokenProp.token;
  } else {
    token = tokenProp as Token;
  }

  // For native XLM token, use the Stellar logo
  if (token.type === "native") {
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
