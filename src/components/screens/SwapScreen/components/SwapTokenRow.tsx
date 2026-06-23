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
import {
  formatBalanceAmount,
  formatFiatAmount,
  formatPercentageAmount,
} from "helpers/formatAmount";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

/**
 * Compare two optional BigNumbers. Treats `undefined` and `null` as distinct
 * from `BigNumber(0)`. Returns true only when both sides are nullish OR both
 * sides are non-null and numerically equal.
 */
const bigEq = (
  a: BigNumber | null | undefined,
  b: BigNumber | null | undefined,
): boolean => {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a.eq(b);
};

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
  /** Forwarded to the row's TouchableOpacity so e2e flows can tap a specific token. */
  testID?: string;
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
  testID,
}) => {
  const { themeColors } = useColors();

  // Derive display values from the appropriate data source
  const tokenCode = variant === "held" ? balance?.tokenCode : record?.tokenCode;
  // Native XLM renders the canonical "Stellar Lumens" name. For all other
  // tokens, record.domain is always a string ("" when stellar.expert returns
  // no home_domain), so the truthy check correctly skips empty domains to
  // fall through to name → tokenCode.
  const nonHeldSubtitle = (() => {
    if (variant === "held") return undefined;
    if (record?.isNative) return "Stellar Lumens";
    return record?.domain || record?.name || record?.tokenCode;
  })();
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
          <Text
            sm
            medium
            color={
              pct?.gte(POSITIVE_PRICE_CHANGE_THRESHOLD)
                ? themeColors.status.success
                : themeColors.text.secondary
            }
          >
            {formatPercentageAmount(pct)}
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <TouchableOpacity
      testID={testID}
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
          {/* Held rows show the raw token amount; non-held rows show the
              issuer's home domain. Skip when `total` is missing (defensive
              for partial test fixtures). */}
          {variant === "held" && balance?.total ? (
            <Text sm secondary medium numberOfLines={1}>
              {formatBalanceAmount(balance, balance.tokenCode)}
            </Text>
          ) : null}
          {variant !== "held" && nonHeldSubtitle ? (
            <Text sm secondary medium numberOfLines={1}>
              {nonHeldSubtitle}
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
      // total drives the raw-amount subtitle on the left — re-render when
      // the balance changes (e.g. after a swap settles or trustline adds).
      bigEq(pb.total, nb.total) &&
      bigEq(pb.fiatTotal, nb.fiatTotal) &&
      bigEq(pb.percentagePriceChange24h, nb.percentagePriceChange24h)
    );
  }

  if (prev.variant === "non-held") {
    return (
      prev.record?.tokenCode === next.record?.tokenCode &&
      prev.record?.issuer === next.record?.issuer &&
      // Re-render when the Blockaid scan resolves after first paint, otherwise
      // the in-place badge stays hidden on rows that mounted before scan.
      prev.record?.securityLevel === next.record?.securityLevel
    );
  }

  // trending
  const priceEq = bigEq(
    prev.priceInfo?.currentPrice,
    next.priceInfo?.currentPrice,
  );
  const pctEq = bigEq(
    prev.priceInfo?.percentagePriceChange24h,
    next.priceInfo?.percentagePriceChange24h,
  );
  return (
    prev.record?.tokenCode === next.record?.tokenCode &&
    prev.record?.issuer === next.record?.issuer &&
    // Re-render when the Blockaid scan resolves after first paint, otherwise
    // the in-place badge stays hidden on rows that mounted before scan.
    prev.record?.securityLevel === next.record?.securityLevel &&
    priceEq &&
    pctEq
  );
});

export default SwapTokenRow;
