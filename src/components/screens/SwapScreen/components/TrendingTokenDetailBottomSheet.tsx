import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BigNumber from "bignumber.js";
import { TokenIconWithBadge } from "components/TokenIconWithBadge";
import {
  descriptorFromBalance,
  descriptorFromSearchRecord,
} from "components/screens/SwapScreen/helpers";
import { Banner } from "components/sds/Banner";
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
import { SecurityLevel } from "services/blockaid/constants";

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
  const { setDestinationToken } = useSwapStore();

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

  const tokenType = record.isNative
    ? t("swapScreen.trendingDetail.stellarNative")
    : t("swapScreen.trendingDetail.stellarClassic");

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
            {record.issuer ? truncateAddress(record.issuer) : "—"}
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

        {record.domain ? (
          <>
            <View className="h-px bg-border-primary w-full" />

            {/* Row: Domain */}
            <View className="flex-row items-center justify-between">
              <Text md medium secondary>
                {t("swapScreen.trendingDetail.domain")}
              </Text>
              <Text md medium primary numberOfLines={1}>
                {record.domain}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Blockaid warning banner — surfaces MALICIOUS / SUSPICIOUS before the
          user taps Buy so they can't slip through to the review sheet without
          seeing the risk. UNABLE_TO_SCAN intentionally doesn't show a banner
          here because every non-mainnet path lands there and the picker
          already shows the icon's lack-of-badge for that case. */}
      {record.securityLevel === SecurityLevel.MALICIOUS && (
        <View testID="trending-detail-malicious-banner">
          <Banner variant="error" text={t("addTokenScreen.maliciousToken")} />
        </View>
      )}
      {record.securityLevel === SecurityLevel.SUSPICIOUS && (
        <View testID="trending-detail-suspicious-banner">
          <Banner
            variant="warning"
            text={t("addTokenScreen.suspiciousToken")}
          />
        </View>
      )}

      {/* Buy button */}
      <Button onPress={handleBuy} tertiary>
        {t("swapScreen.trendingDetail.buy", { tokenCode: record.tokenCode })}
      </Button>
    </View>
  );
};

export default TrendingTokenDetailBottomSheet;
