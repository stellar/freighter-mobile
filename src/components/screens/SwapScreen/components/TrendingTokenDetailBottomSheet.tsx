import BigNumber from "bignumber.js";
import { TokenIconWithBadge } from "components/TokenIconWithBadge";
import { Banner } from "components/sds/Banner";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { TextButton } from "components/sds/TextButton";
import { Display, Text } from "components/sds/Typography";
import {
  mapNetworkToNetworkDetails,
  POSITIVE_PRICE_CHANGE_THRESHOLD,
} from "config/constants";
import {
  FormattedSearchTokenRecord,
  NonNativeToken,
  TokenTypeWithCustomToken,
} from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { formatFiatAmount, formatPercentageAmount } from "helpers/formatAmount";
import { getTokenSacAddress } from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { SecurityLevel } from "services/blockaid/constants";

export interface TrendingTokenDetailBottomSheetProps {
  record: FormattedSearchTokenRecord;
  priceInfo: {
    currentPrice?: BigNumber;
    percentagePriceChange24h?: BigNumber;
  };
  onSwapTo: () => void;
  // Only rendered when the record is flagged (malicious/suspicious).
  onCancel: () => void;
  onSecurityWarningPress?: () => void;
}

/** Format a BigNumber as a USD delta string with 4 decimal places, e.g. "$0.0602" */
const formatDeltaUsd = (delta: BigNumber): string => {
  const abs = delta.abs();
  const fixed = abs.toFixed(4);
  return `$${fixed}`;
};

export const TrendingTokenDetailBottomSheet: React.FC<
  TrendingTokenDetailBottomSheetProps
> = ({ record, priceInfo, onSwapTo, onCancel, onSecurityWarningPress }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { copyToClipboard } = useClipboard();
  const { network } = useAuthenticationStore();
  const { networkPassphrase } = mapNetworkToNetworkDetails(network);

  // Derive the deterministic SAC C-address for the classic asset so the
  // Issuer row exposes the on-chain contract counterpart rather than the
  // G-address of the asset's issuer account — that's what users typically
  // need when wiring this token into Soroban contracts or paste into
  // explorer search bars. Null for XLM (handled by the existing native
  // special-case) and on derivation failure (e.g. unexpected asset code).
  const sacAddress = (() => {
    if (record.isNative || !record.issuer) return null;
    try {
      return getTokenSacAddress(
        record.tokenCode,
        record.issuer,
        networkPassphrase,
      );
    } catch {
      return null;
    }
  })();

  const token: NonNativeToken = {
    type: record.tokenType ?? TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    code: record.tokenCode,
    issuer: { key: record.issuer },
  };

  // Native XLM is unscannable by definition and trusted — never surface a
  // security warning for it (matches useReviewSecuritySummary's
  // !isNativeAssetId gate). unable-to-scan on a non-native token stays
  // trusted here too — the banner alone signals caution.
  const isMalicious =
    !record.isNative && record.securityLevel === SecurityLevel.MALICIOUS;
  const isSuspicious =
    !record.isNative && record.securityLevel === SecurityLevel.SUSPICIOUS;
  const isTrusted = !isMalicious && !isSuspicious;

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

  // XLM has no traditional issuer / TOML home_domain — special-case the
  // canonical "Stellar Network" issuer label and "stellar.org" domain so
  // the info card stays informative instead of falling through to "—" or
  // hiding the domain row.
  //
  // For classic non-native assets the Issuer row shows the truncated SAC
  // C-address (derived via getTokenSacAddress) instead of the G-address.
  // The G-address is also a valid identifier but the C-address is what
  // users typically need for Soroban interop / explorer pastes.
  const issuerLabel = (() => {
    if (record.isNative) return t("swapScreen.trendingDetail.stellarNetwork");
    if (sacAddress) return truncateAddress(sacAddress);
    if (record.issuer) return truncateAddress(record.issuer);
    return "—";
  })();
  const domainLabel = record.isNative
    ? "stellar.org"
    : record.domain || undefined;

  // Mirror SwapReviewBottomSheet: surface Blockaid signals on this sheet
  // too so the user sees malicious/suspicious / unable-to-scan warnings
  // BEFORE committing the token as the swap destination (instead of
  // waiting until the review step). MALICIOUS → red, SUSPICIOUS or
  // UNABLE_TO_SCAN → amber; SAFE/EXPECTED_TO_FAIL → no banner.
  const securityBanner = (() => {
    if (record.isNative) return null;
    switch (record.securityLevel) {
      case SecurityLevel.MALICIOUS:
        return {
          variant: "error" as const,
          text: t("blockaid.security.token.malicious"),
        };
      case SecurityLevel.SUSPICIOUS:
        return {
          variant: "warning" as const,
          text: t("blockaid.security.token.suspicious"),
        };
      case SecurityLevel.UNABLE_TO_SCAN:
        return {
          variant: "warning" as const,
          text: t("securityWarning.proceedWithCaution"),
        };
      default:
        return null;
    }
  })();

  return (
    <View className="gap-[24px] p-[4px]">
      <View className="flex-col gap-[16px]">
        {/* self-start so the TokenIconWithBadge wrapper hugs the icon's
            intrinsic width instead of stretching to the column's cross axis
            — otherwise the badge's `right-0` anchors to the row's far
            edge instead of the icon's bottom-right corner. */}
        <View className="self-start">
          <TokenIconWithBadge
            token={token}
            iconUrl={record.iconUrl}
            securityLevel={record.securityLevel}
            size="lg"
          />
        </View>
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

      {securityBanner ? (
        <Banner
          variant={securityBanner.variant}
          text={securityBanner.text}
          onPress={onSecurityWarningPress}
        />
      ) : null}

      <View className="bg-background-tertiary rounded-[16px] px-[16px] py-[12px] flex-col gap-[12px] w-full">
        {/* Native XLM has no issuer key — render the label only and skip
            the copy button. For classic assets the truncated label is for
            display; copy always sends the full SAC C-address (or the
            G-address if SAC derivation failed). */}
        <View className="flex-row items-center justify-between">
          <Text md medium secondary>
            {record.isNative
              ? t("swapScreen.trendingDetail.issuer")
              : t("swapScreen.trendingDetail.tokenAddress")}
          </Text>
          {record.isNative || !record.issuer ? (
            <Text md medium primary numberOfLines={1}>
              {issuerLabel}
            </Text>
          ) : (
            <TouchableOpacity
              testID="trending-detail-copy-issuer"
              className="flex-row items-center gap-[8px]"
              hitSlop={10}
              onPress={() =>
                copyToClipboard(sacAddress ?? record.issuer, {
                  notificationMessage: t("common.copied"),
                })
              }
            >
              <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
              <Text md medium primary numberOfLines={1}>
                {issuerLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {domainLabel ? (
          <>
            <View className="h-px bg-border-primary w-full" />

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

      {isTrusted ? (
        <Button onPress={onSwapTo} tertiary>
          {t("swapScreen.trendingDetail.swapTo", {
            tokenCode: record.tokenCode,
          })}
        </Button>
      ) : (
        <View className="gap-3">
          <Button
            tertiary={isSuspicious}
            destructive={isMalicious}
            onPress={onCancel}
            isFullWidth
            testID="trending-detail-cancel-button"
          >
            {t("common.cancel")}
          </Button>
          <TextButton
            text={t("swapScreen.trendingDetail.swapToAnyway", {
              tokenCode: record.tokenCode,
            })}
            onPress={onSwapTo}
            variant={isMalicious ? "error" : "secondary"}
            testID="trending-detail-swap-to-anyway-button"
          />
        </View>
      )}
    </View>
  );
};

export default TrendingTokenDetailBottomSheet;
