import BigNumber from "bignumber.js";
import { Text, TEXT_SIZES } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { PriceHistoryRange, TokenIdentifier } from "config/types";
import { useSelectedPriceHistoryRange } from "ducks/priceHistory";
import { fsValue } from "helpers/dimensions";
import { formatPercentageAmount } from "helpers/formatAmount";
import {
  formatPriceHistoryRangeDelta,
  getPriceChangeColor,
  getPriceChangeDirection,
  PriceChangeDirection,
  hasChartData,
} from "helpers/priceHistoryChart";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import usePriceHistoryEnabled from "hooks/usePriceHistoryEnabled";
import { usePriceHistoryRangeState } from "hooks/useTokenPriceHistory";
import React from "react";
import { useWindowDimensions, View } from "react-native";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

/**
 * 1D IS 24 hours, so the existing 24h percentage is the right stand-in when
 * its fetch fails. Under any other range it would be the wrong timeframe.
 */
const FALLBACK_RANGE: PriceHistoryRange = "1D";

/**
 * Reserved in every state — number, placeholder or nothing — so a range
 * switch never moves the price above it or the chart below it. Scaled with
 * the live text size like the chart's label rows: `Text md` grows its line
 * height under a larger OS text setting, and a fixed reserve would leave the
 * placeholder row short.
 */
export const deltaRowHeight = (fontScale: number): number =>
  fsValue(TEXT_SIZES.md.lineHeight) * fontScale;

interface TokenPriceDeltaProps {
  /** Route-param token identifier ("native" for XLM) */
  tokenId: TokenIdentifier;
  network: NETWORKS;
  /**
   * The 24h percentage from /token-prices. It is the whole delta wherever the
   * chart does not render, and the 1D-only fallback where it does.
   */
  percentagePriceChange24h?: BigNumber | null;
}

interface Delta {
  text: string;
  direction: PriceChangeDirection;
}

/**
 * The view's single delta, under the price, following the selected timeframe.
 * Reads the selection and series from the duck the chart section already
 * fetched, so it issues no request and cannot drift from the selector.
 *
 * With the chart absent it is exactly the 24h percentage the header showed
 * before this feature, in the same markup: no reserved row, no placeholder.
 */
const TokenPriceDelta: React.FC<TokenPriceDeltaProps> = ({
  tokenId,
  network,
  percentagePriceChange24h,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { fontScale } = useWindowDimensions();
  const isPriceHistoryEnabled = usePriceHistoryEnabled(network);
  const range = useSelectedPriceHistoryRange(network, tokenId);
  const { data, isLoading, error } = usePriceHistoryRangeState(
    network,
    tokenId,
    range,
    isPriceHistoryEnabled,
  );

  // Green up, red down, neutral flat — the sign always lives in the text, so
  // colour never carries it alone (§7.4).
  const renderDelta = ({ text, direction }: Delta) => (
    <Text
      md
      medium
      color={getPriceChangeColor(direction, themeColors)}
      testID="token-price-delta"
    >
      {text}
    </Text>
  );

  const percent24h =
    percentagePriceChange24h !== undefined && percentagePriceChange24h !== null
      ? percentagePriceChange24h
      : null;

  // No chart on this screen: the pre-chart behaviour, untouched — including
  // its two-state colours. Reconciling this path with the rest of the app is
  // the design doc's §13 follow-up, deliberately out of scope here.
  if (!isPriceHistoryEnabled) {
    if (!percent24h) {
      return null;
    }

    return (
      <View className="flex-row items-center gap-1">
        {renderDelta({
          text: formatPercentageAmount(percent24h),
          direction: percent24h.isGreaterThan(0) ? "positive" : "neutral",
        })}
      </View>
    );
  }

  // Mirrors the chart section's own state precedence: a cached series keeps
  // rendering through a failed refresh, and only a failure with nothing to
  // show is an error state.
  const isErrorState = !!error && !data;
  const isPlaceholder = isLoading && !data && !isErrorState;

  // Off the DRAWABLE series, not the raw response: the backend computes
  // `change` from a single point, so a 1-point series would print a signed
  // delta above a canvas reading "No price data for this period".
  const hasChart = hasChartData(data?.points ?? []);

  let delta: Delta | null = null;
  if (hasChart && data?.change) {
    // The server's change, verbatim — never recomputed client-side (§4.2).
    delta = {
      text: formatPriceHistoryRangeDelta(data.change),
      // Both halves, because the text signs its dollar term from the
      // absolute: a percent rounded to "0" beside a live absolute (D8) must
      // still colour the sign it prints.
      direction: getPriceChangeDirection(
        data.change.percent,
        data.change.absolute,
      ),
    };
  } else if (isErrorState && range === FALLBACK_RANGE && percent24h) {
    // Still the chart's delta — only the number's source differs — so it
    // keeps the three-state colour rather than the non-chart path's two.
    delta = {
      text: formatPercentageAmount(percent24h),
      direction: getPriceChangeDirection(percent24h),
    };
  }

  const renderContent = () => {
    if (isPlaceholder) {
      // The loading pill. Decorative — the row announces the loading state —
      // and deliberately not a stale number: a 1D delta under a 1Y selector
      // would be a wrong, confident-looking figure.
      return (
        <View
          testID="token-price-delta-skeleton"
          className="h-[14px] w-[120px] rounded-full bg-background-tertiary"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      );
    }

    // `change: null` with points is the §4.2 coverage guard, not an error:
    // no number, and the row still holds its height.
    return delta ? renderDelta(delta) : null;
  };

  return (
    <View
      testID="token-price-delta-row"
      className="flex-row items-center gap-1"
      style={{ minHeight: deltaRowHeight(fontScale) }}
      accessible={isPlaceholder}
      accessibilityState={isPlaceholder ? { busy: true } : undefined}
      accessibilityLabel={
        isPlaceholder ? t("priceHistory.loadingDeltaA11yLabel") : undefined
      }
    >
      {renderContent()}
    </View>
  );
};

export default TokenPriceDelta;
