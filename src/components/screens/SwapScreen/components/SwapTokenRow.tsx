import BigNumber from "bignumber.js";
import { TokenIconWithBadge } from "components/TokenIconWithBadge";
import { TokenContextMenu } from "components/screens/SwapScreen/components/TokenContextMenu";
import { Text } from "components/sds/Typography";
import { NETWORKS, POSITIVE_PRICE_CHANGE_THRESHOLD } from "config/constants";
import {
  FormattedSearchTokenRecord,
  NativeToken,
  NonNativeToken,
  PricedBalance,
  TokenTypeWithCustomToken,
} from "config/types";
import { formatFiatAmount, formatPercentageAmount } from "helpers/formatAmount";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export type SwapTokenRowVariant = "held" | "non-held" | "trending";

export interface SwapTokenRowProps {
  variant: SwapTokenRowVariant;
  /** For "held" rows: full PricedBalance. */
  balance?: PricedBalance & { id: string };
  /** For "non-held" and "trending" rows: FormattedSearchTokenRecord. */
  record?: FormattedSearchTokenRecord;
  /** For "trending" rows: price + 24h%. Falls back to record.price for stellar.expert-only data. */
  priceInfo?: {
    currentPrice?: BigNumber;
    percentagePriceChange24h?: BigNumber;
  };
  network: NETWORKS;
  onPress: () => void;
}

/**
 * Single row for the SwapToScreen picker and the Trending Tokens list.
 *
 * Three right-hand-slot variants:
 * - held: fiat value + 24h % (same layout as BalanceRow on the Home screen)
 * - non-held: ellipsis context menu (TokenContextMenu)
 * - trending: price + 24h %; % chip hidden when 24h data is unavailable
 */
const SwapTokenRowComponent: React.FC<SwapTokenRowProps> = ({
  variant,
  balance,
  record,
  priceInfo,
  network,
  onPress,
}) => {
  const { themeColors } = useColors();

  // Derive display values from the appropriate data source
  const tokenCode = variant === "held" ? balance?.tokenCode : record?.tokenCode;
  const domain = variant !== "held" ? record?.domain : undefined;
  const iconUrl = variant !== "held" ? record?.iconUrl : undefined;
  const securityLevel = variant !== "held" ? record?.securityLevel : undefined;

  // Build a minimal token object for TokenIconWithBadge.
  // PricedBalance extends Balance which includes ClassicBalance/SorobanBalance
  // (both have a `token` property). NativeBalance also has `token`.
  const balanceToken =
    balance && "token" in balance
      ? (balance as PricedBalance & { token: NativeToken | NonNativeToken })
          .token
      : undefined;

  const token: NativeToken | NonNativeToken = balanceToken ?? {
    type: record?.tokenType ?? TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    code: record?.tokenCode ?? "",
    issuer: { key: record?.issuer ?? "" },
  };

  // Build a minimal TokenReference for TokenContextMenu
  const tokenRef =
    variant === "non-held"
      ? {
          id: record?.issuer
            ? `${record.tokenCode}:${record.issuer}`
            : record?.tokenCode,
          tokenCode: record?.tokenCode,
          issuer: record?.issuer,
          tokenType: record?.tokenType,
        }
      : undefined;

  // Right-slot rendering
  const renderRightSlot = () => {
    if (variant === "held" && balance) {
      return (
        <View className="flex-col items-end">
          {balance.fiatTotal ? (
            <>
              <Text medium numberOfLines={1}>
                {formatFiatAmount(balance.fiatTotal)}
              </Text>
              <Text
                sm
                medium
                color={
                  balance.percentagePriceChange24h?.gte(
                    POSITIVE_PRICE_CHANGE_THRESHOLD,
                  )
                    ? themeColors.status.success
                    : themeColors.text.secondary
                }
              >
                {formatPercentageAmount(balance.percentagePriceChange24h)}
              </Text>
            </>
          ) : (
            <Text sm medium secondary>
              --
            </Text>
          )}
        </View>
      );
    }

    if (variant === "non-held" && tokenRef) {
      return <TokenContextMenu token={tokenRef} network={network} />;
    }

    if (variant === "trending") {
      const price = priceInfo?.currentPrice;
      const pct = priceInfo?.percentagePriceChange24h;
      return (
        <View className="flex-col items-end">
          {price !== undefined ? (
            <Text medium numberOfLines={1}>
              {formatFiatAmount(price)}
            </Text>
          ) : (
            <Text sm medium secondary>
              --
            </Text>
          )}
          {pct !== undefined && (
            <Text
              sm
              medium
              color={
                pct.gte(POSITIVE_PRICE_CHANGE_THRESHOLD)
                  ? themeColors.status.success
                  : themeColors.text.secondary
              }
            >
              {formatPercentageAmount(pct)}
            </Text>
          )}
        </View>
      );
    }

    return null;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row justify-between items-center mb-6"
    >
      <View className="flex-row items-center flex-1 mr-4">
        <TokenIconWithBadge
          token={token}
          iconUrl={iconUrl}
          securityLevel={securityLevel}
        />
        <View className="ml-4 flex-1">
          <Text md primary medium numberOfLines={1}>
            {tokenCode}
          </Text>
          {domain ? (
            <Text sm secondary medium numberOfLines={1}>
              {domain}
            </Text>
          ) : null}
        </View>
      </View>
      {renderRightSlot()}
    </TouchableOpacity>
  );
};

SwapTokenRowComponent.displayName = "SwapTokenRow";

export const SwapTokenRow = React.memo(SwapTokenRowComponent, (prev, next) => {
  if (prev.variant !== next.variant) return false;
  if (prev.network !== next.network) return false;
  if (prev.onPress !== next.onPress) return false;

  if (prev.variant === "held") {
    const pb = prev.balance;
    const nb = next.balance;
    if (pb === nb) return true;
    if (!pb || !nb) return false;
    return (
      pb.id === nb.id &&
      (pb.fiatTotal?.eq(nb.fiatTotal ?? 0) ?? nb.fiatTotal == null) &&
      (pb.percentagePriceChange24h?.eq(nb.percentagePriceChange24h ?? 0) ??
        nb.percentagePriceChange24h == null)
    );
  }

  if (prev.variant === "non-held") {
    return (
      prev.record?.tokenCode === next.record?.tokenCode &&
      prev.record?.issuer === next.record?.issuer
    );
  }

  // trending
  const priceEq =
    prev.priceInfo?.currentPrice?.eq(next.priceInfo?.currentPrice ?? 0) ??
    next.priceInfo?.currentPrice == null;
  const pctEq =
    prev.priceInfo?.percentagePriceChange24h?.eq(
      next.priceInfo?.percentagePriceChange24h ?? 0,
    ) ?? next.priceInfo?.percentagePriceChange24h == null;
  return (
    prev.record?.tokenCode === next.record?.tokenCode &&
    prev.record?.issuer === next.record?.issuer &&
    priceEq &&
    pctEq
  );
});

export default SwapTokenRow;
