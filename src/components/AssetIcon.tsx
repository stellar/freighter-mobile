import { logos } from "assets/logos";
import { Asset, AssetSize } from "components/sds/Asset";
import { AssetToken, NativeToken } from "config/types";
import { useAssetIconsStore } from "ducks/assetIcons";
import { getTokenIdentifier } from "helpers/balances";
import React from "react";

type Token = AssetToken | NativeToken;

interface AssetIconProps {
  /** The token to display */
  token: Token;
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
 * - For other tokens, fetches and displays their icon from the asset icons store
 * - Handles loading states and fallbacks
 *
 * @param {AssetIconProps} props - Component props
 * @returns {JSX.Element} The rendered asset icon
 */
export const AssetIcon: React.FC<AssetIconProps> = ({
  token,
  size = "lg",
  backgroundColor,
}) => {
  const icons = useAssetIconsStore((state) => state.icons);

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
  const icon = icons[getTokenIdentifier(token)];
  const imageUrl = icon?.imageUrl;

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
};
