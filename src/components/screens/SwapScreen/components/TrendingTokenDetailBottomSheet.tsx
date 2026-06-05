import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BigNumber from "bignumber.js";
import { TokenIconWithBadge } from "components/TokenIconWithBadge";
import {
  descriptorFromBalance,
  descriptorFromSearchRecord,
} from "components/screens/SwapScreen/helpers";
import { Button } from "components/sds/Button";
import { Display, Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { POSITIVE_PRICE_CHANGE_THRESHOLD } from "config/constants";
import {
  FormattedSearchTokenRecord,
  NonNativeToken,
  PricedBalance,
  TokenTypeWithCustomToken,
} from "config/types";
import { useSwapStore } from "ducks/swap";
import { formatFiatAmount, formatPercentageAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";
import { analytics } from "services/analytics";

export interface TrendingTokenDetailBottomSheetProps {
  record: FormattedSearchTokenRecord;
  priceInfo: {
    currentPrice?: BigNumber;
    percentagePriceChange24h?: BigNumber;
  };
  balanceItems: Array<PricedBalance & { id: string }>;
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
}

/** Format a BigNumber as a USD delta string with 4 decimal places, e.g. "$0.0602" */
const formatDeltaUsd = (delta: BigNumber): string => {
  const abs = delta.abs();
  const fixed = abs.toFixed(4);
  return `$${fixed}`;
};

export const TrendingTokenDetailBottomSheet: React.FC<
  TrendingTokenDetailBottomSheetProps
> = ({ record, priceInfo, balanceItems, bottomSheetModalRef }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { setDestinationToken, setSourceToken, sourceTokenId } = useSwapStore();

  const token: NonNativeToken = {
    type: record.tokenType ?? TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    code: record.tokenCode,
    issuer: { key: record.issuer },
  };

  const handleBuy = () => {
    analytics.track(AnalyticsEvent.SWAP_TRENDING_BUY_PRESSED, {
      tokenCode: record.tokenCode,
    });
    const heldMatch = balanceItems.find(
      (b) => b.id === `${record.tokenCode}:${record.issuer}`,
    );
    let descriptor;
    if (heldMatch) {
      descriptor = descriptorFromBalance(heldMatch);
    } else {
      descriptor = descriptorFromSearchRecord(record);
    }
    analytics.track(AnalyticsEvent.SWAP_DESTINATION_SELECTED, {
      tokenCode: record.tokenCode,
      isNew: descriptor.isNew,
      source: "trending",
    });
    // Selection-swap rule (spec §12.4 / SwapToScreen parity): if the new
    // destination equals the current source, clear source so the user
    // doesn't end up with the same token on both sides.
    if (sourceTokenId && sourceTokenId === descriptor.id) {
      setSourceToken("", "");
    }
    setDestinationToken(descriptor);
    bottomSheetModalRef?.current?.dismiss();
  };

  const { currentPrice, percentagePriceChange24h } = priceInfo;

  const isPositive =
    percentagePriceChange24h !== undefined &&
    percentagePriceChange24h.gte(POSITIVE_PRICE_CHANGE_THRESHOLD);

  const deltaUsd =
    currentPrice !== undefined && percentagePriceChange24h !== undefined
      ? currentPrice.times(percentagePriceChange24h).div(100)
      : undefined;

  const deltaString =
    deltaUsd !== undefined && percentagePriceChange24h !== undefined
      ? `${isPositive ? "+" : ""}${formatDeltaUsd(deltaUsd)} (${formatPercentageAmount(percentagePriceChange24h)})`
      : undefined;

  // Type label — both native XLM and classic alphanum assets sit on the
  // Stellar Classic protocol (Soroban contracts are filtered out upstream),
  // so we always render "Stellar Classic" here.
  const tokenType = t("swapScreen.trendingDetail.stellarClassic");

  // XLM has no traditional issuer / TOML home_domain — special-case the
  // canonical "Stellar Network" issuer label and "stellar.org" domain so
  // the info card stays informative instead of falling through to "—" or
  // hiding the domain row.
  const issuerLabel = (() => {
    if (record.isNative) return t("swapScreen.trendingDetail.stellarNetwork");
    if (record.issuer) return truncateAddress(record.issuer);
    return "—";
  })();
  const domainLabel = record.isNative
    ? "stellar.org"
    : record.domain || undefined;

  return (
    <View className="gap-[24px] p-[4px]">
      {/* Header block: icon, then text stack below */}
      <View className="flex-col gap-[16px]">
        <TokenIconWithBadge
          token={token}
          iconUrl={record.iconUrl}
          securityLevel={record.securityLevel}
          size="lg"
        />
        <View className="flex-col gap-[8px]">
          <Text md medium secondary>
            {record.name ?? record.tokenCode}
          </Text>
          {currentPrice !== undefined ? (
            <Display sm regular primary>
              {formatFiatAmount(currentPrice)}
            </Display>
          ) : null}
          {deltaString !== undefined ? (
            <Text
              md
              medium
              color={
                isPositive
                  ? themeColors.status.success
                  : themeColors.text.secondary
              }
            >
              {deltaString}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Info card */}
      <View className="bg-background-tertiary rounded-[16px] px-[16px] py-[12px] flex-col gap-[12px] w-full">
        {/* Row: Issuer */}
        <View className="flex-row items-center justify-between">
          <Text md medium secondary>
            {t("swapScreen.trendingDetail.issuer")}
          </Text>
          <Text md medium primary numberOfLines={1}>
            {issuerLabel}
          </Text>
        </View>

        <View className="h-px bg-border-primary w-full" />

        {/* Row: Type */}
        <View className="flex-row items-center justify-between">
          <Text md medium secondary>
            {t("swapScreen.trendingDetail.type")}
          </Text>
          <Text md medium primary>
            {tokenType}
          </Text>
        </View>

        {domainLabel ? (
          <>
            <View className="h-px bg-border-primary w-full" />

            {/* Row: Domain */}
            <View className="flex-row items-center justify-between">
              <Text md medium secondary>
                {t("swapScreen.trendingDetail.domain")}
              </Text>
              <Text md medium primary numberOfLines={1}>
                {domainLabel}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Note: no inline security banner here. The Blockaid scan still
          surfaces MALICIOUS / SUSPICIOUS in the swap review sheet (a full
          transaction-level rescan runs there); this sheet just keeps the
          icon's small badge overlay as a hint via TokenIconWithBadge above. */}

      {/* Buy button */}
      <Button onPress={handleBuy} tertiary>
        {t("swapScreen.trendingDetail.buy", { tokenCode: record.tokenCode })}
      </Button>
    </View>
  );
};

export default TrendingTokenDetailBottomSheet;
