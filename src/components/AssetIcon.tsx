import { logos } from "assets/logos";
import SorobanAssetIcon from "assets/logos/icon-soroban.svg";
import { Asset, AssetSize } from "components/sds/Asset";
import { Text } from "components/sds/Typography";
import { AssetTypeWithCustomToken, Balance, Token } from "config/types";
import { useAssetIconsStore } from "ducks/assetIcons";
import { getTokenIdentifier, isLiquidityPool } from "helpers/balances";
import React from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

  // Liquidity pool: show "LP" text
  if (isLiquidityPool(tokenProp)) {
    return (
      <Asset
        variant="single"
        size={size}
        sourceOne={{
          image: "",
          altText: t("tokenIconAlt", { code: "LP" }),
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

  // Normalize token prop
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

  // Native XLM: show Stellar logo
  if (token.type === AssetTypeWithCustomToken.NATIVE) {
    return (
      <Asset
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

  // Soroban custom tokens: show icon if available, otherwise SorobanAssetIcon
  if (token.type === AssetTypeWithCustomToken.CUSTOM_TOKEN) {
    const tokenIdentifier = getTokenIdentifier(token);
    const icon = icons[tokenIdentifier];
    const imageUrl = icon?.imageUrl || "";

    // If we have a specific icon, use it
    if (imageUrl) {
      return (
        <Asset
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

    // Fallback: show SorobanAssetIcon for Soroban custom tokens
    return (
      <Asset
        variant="single"
        size={size}
        sourceOne={{
          altText: t("tokenIconAlt", { code: token.code }),
          backgroundColor,
          renderContent: () => <SorobanAssetIcon />,
        }}
      />
    );
  }

  // Classic assets (and SACs): show icon if available, otherwise show token initials
  const tokenIdentifier = getTokenIdentifier(token);
  const icon = icons[tokenIdentifier];
  const imageUrl = icon?.imageUrl || "";

  const tokenInitials = token.code?.slice(0, 2) || "";
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
        altText: t("tokenIconAlt", { code: token.code }),
        backgroundColor,
        renderContent,
      }}
    />
  );
};
