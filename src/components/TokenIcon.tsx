import { logos } from "assets/logos";
import SorobanTokenIcon from "assets/logos/icon-soroban.svg";
import { Token as TokenComponent, TokenSize } from "components/sds/Token";
import { Text } from "components/sds/Typography";
import {
  TokenTypeWithCustomToken,
  Balance,
  Token,
  NonNativeToken,
} from "config/types";
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

const normalizeToken = (tokenProp: Token | Balance): Token => {
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
};

const LiquidityPoolTokenIcon: React.FC<
  Pick<TokenIconProps, "size" | "backgroundColor">
> = ({ size = "lg", backgroundColor }) => {
  const { t } = useTranslation();
  const fallbackTextSize = React.useMemo(
    () => getFallbackTextSize(size),
    [size],
  );

  const renderLPContent = React.useCallback(
    () => (
      <Text size={fallbackTextSize} bold secondary isVerticallyCentered>
        LP
      </Text>
    ),
    [fallbackTextSize],
  );

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
};

const NativeTokenIcon: React.FC<
  Pick<TokenIconProps, "size" | "backgroundColor">
> = ({ size = "lg", backgroundColor }) => {
  const { t } = useTranslation();

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
};

const TokenIconWithStore: React.FC<{
  token: NonNativeToken;
  size?: TokenSize;
  backgroundColor?: string;
  iconUrl?: string;
  renderContent: () => React.ReactNode;
}> = ({ token, size = "lg", backgroundColor, iconUrl, renderContent }) => {
  const { t } = useTranslation();

  const tokenIdentifier = React.useMemo(
    () => getTokenIdentifier(token),
    [token],
  );

  const icon = useTokenIconsStore(
    React.useCallback(
      (state) => state.icons[tokenIdentifier],
      [tokenIdentifier],
    ),
  );

  const validateIconOnAccess = useTokenIconsStore(
    (state) => state.validateIconOnAccess,
  );

  const failedTokenCodes = useTokenIconsStore(
    (state) => state.failedTokenCodes ?? {},
  );

  const tokenCode = React.useMemo(
    () => tokenIdentifier.split(":")[0],
    [tokenIdentifier],
  );

  const hasIconToValidate =
    !!icon &&
    icon.isValidated === false &&
    !!icon.imageUrl &&
    icon.isValid !== false;

  const shouldValidateIcon =
    !iconUrl && hasIconToValidate && !failedTokenCodes[tokenCode];

  const lastValidImageUrl = icon?.lastValidImageUrl;

  React.useEffect(() => {
    if (shouldValidateIcon) {
      validateIconOnAccess(tokenIdentifier);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    iconUrl,
    hasIconToValidate,
    shouldValidateIcon,
    tokenIdentifier,
    validateIconOnAccess,
    failedTokenCodes,
    tokenCode,
  ]);

  const finalImageUrl = icon?.imageUrl || lastValidImageUrl || iconUrl;

  const tokenSourceToken = token.issuer?.key
    ? {
        code: token.code,
        issuer: token.issuer.key,
      }
    : undefined;

  return (
    <TokenComponent
      variant="single"
      size={size}
      sourceOne={{
        altText: t("tokenIconAlt", { code: token.code }),
        backgroundColor,
        image: finalImageUrl,
        token: tokenSourceToken,
        renderContent,
      }}
    />
  );
};

const CustomTokenIcon: React.FC<{
  token: NonNativeToken;
  size?: TokenSize;
  backgroundColor?: string;
  iconUrl?: string;
}> = ({ token, size, backgroundColor, iconUrl }) => {
  const renderSorobanContent = React.useCallback(
    () => <SorobanTokenIcon />,
    [],
  );

  return (
    <TokenIconWithStore
      token={token}
      size={size}
      backgroundColor={backgroundColor}
      iconUrl={iconUrl}
      renderContent={renderSorobanContent}
    />
  );
};

const StandardTokenIcon: React.FC<{
  token: NonNativeToken;
  size?: TokenSize;
  backgroundColor?: string;
  iconUrl?: string;
}> = ({ token, size = "lg", backgroundColor, iconUrl }) => {
  const fallbackTextSize = React.useMemo(
    () => getFallbackTextSize(size),
    [size],
  );

  const renderInitialsContent = React.useCallback(
    () => (
      <Text size={fallbackTextSize} bold secondary isVerticallyCentered>
        {token.code?.slice(0, size === "sm" ? 1 : 2) || ""}
      </Text>
    ),
    [fallbackTextSize, token.code, size],
  );

  return (
    <TokenIconWithStore
      token={token}
      size={size}
      backgroundColor={backgroundColor}
      iconUrl={iconUrl}
      renderContent={renderInitialsContent}
    />
  );
};

export const TokenIcon: React.FC<TokenIconProps> = ({
  token: tokenProp,
  size = "lg",
  backgroundColor,
  iconUrl,
}) => {
  if (isLiquidityPool(tokenProp)) {
    return (
      <LiquidityPoolTokenIcon size={size} backgroundColor={backgroundColor} />
    );
  }

  const token = normalizeToken(tokenProp);

  if (token.type === TokenTypeWithCustomToken.NATIVE) {
    return <NativeTokenIcon size={size} backgroundColor={backgroundColor} />;
  }

  if (token.type === TokenTypeWithCustomToken.CUSTOM_TOKEN) {
    return (
      <CustomTokenIcon
        token={token}
        size={size}
        backgroundColor={backgroundColor}
        iconUrl={iconUrl}
      />
    );
  }

  return (
    <StandardTokenIcon
      token={token}
      size={size}
      backgroundColor={backgroundColor}
      iconUrl={iconUrl}
    />
  );
};
