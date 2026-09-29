import PriceHistoryNotice, {
  getPriceHistoryNoticeVariant,
} from "components/screens/TokenDetailsScreen/components/PriceHistory/PriceHistoryNotice";
import TimeframeSelector, {
  formatRangeLabel,
} from "components/screens/TokenDetailsScreen/components/PriceHistory/TimeframeSelector";
import TokenPriceChart, {
  END_DOT_RADIUS,
  priceChartHeight,
} from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceChart";
import TokenPriceChartGhost from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceChartGhost";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING, NETWORKS } from "config/constants";
import {
  PriceHistoryRange,
  TokenIdentifier,
  TokenPriceHistory,
} from "config/types";
import { formatDate } from "helpers/date";
import { pxValue } from "helpers/dimensions";
import {
  formatPriceHistoryRangeDelta,
  getPriceChangeDirection,
  isSparseSeries,
  hasChartData,
  getPlottedRangeStart,
  getPlottedRangeEnd,
} from "helpers/priceHistoryChart";
import useAppTranslation from "hooks/useAppTranslation";
import usePriceHistoryEnabled from "hooks/usePriceHistoryEnabled";
import useTokenPriceHistory from "hooks/useTokenPriceHistory";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  useWindowDimensions,
  Dimensions,
  LayoutChangeEvent,
  View,
} from "react-native";
import { analytics } from "services/analytics";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

/**
 * Pre-layout width estimate (screen minus the BaseLayout horizontal padding,
 * which is `pxValue(DEFAULT_PADDING)` on each side) so the chart can render
 * before onLayout lands; replaced by the measured width on first layout.
 */
const DEFAULT_CHART_WIDTH =
  Dimensions.get("window").width - 2 * pxValue(DEFAULT_PADDING);

interface TokenPriceHistorySectionProps {
  /** Route-param token identifier ("native" for XLM) */
  tokenId: TokenIdentifier;
  network: NETWORKS;
}

/**
 * Ranges short enough that a date alone cannot describe the window, whatever
 * the endpoints happen to be. A 1D chart spans about 24 hours, so its two
 * ends nearly always fall on DIFFERENT dates — "Sep 19 to Sep 20" reads as a
 * two-day chart — and a 1H chart crossing midnight does the same for a
 * sixty-minute window.
 */
const INTRADAY_RANGES: PriceHistoryRange[] = ["1H", "1D"];

/**
 * Endpoint labels for the chart's accessible description.
 *
 * Two reasons to include the time, and they catch different things. The range
 * being intraday is the common one. The other is the endpoints landing on a
 * single date, which a sparse 1W or 1M series — the case the sparse notice
 * exists for — can do while the range itself is long.
 */
const formatRangeEndpoints = (
  range: PriceHistoryRange,
  startSeconds: number,
  endSeconds: number,
): { start: string; end: string } => {
  const asDate = (seconds: number, includeTime: boolean) =>
    formatDate({
      date: new Date(seconds * 1000).toISOString(),
      includeTime,
    });

  const needsTime =
    INTRADAY_RANGES.includes(range) ||
    asDate(startSeconds, false) === asDate(endSeconds, false);

  return {
    start: asDate(startSeconds, needsTime),
    end: asDate(endSeconds, needsTime),
  };
};

/**
 * Notice banner, chart, and the always-visible timeframe selector. Renders
 * and fetches nothing off mainnet or with the kill switch off.
 *
 * The delta is NOT drawn here: the view shows exactly one, in the header,
 * reading this section's selected range from the duck (`TokenPriceDelta`).
 */
const TokenPriceHistorySection: React.FC<TokenPriceHistorySectionProps> = ({
  tokenId,
  network,
}) => {
  const { t } = useAppTranslation();
  const { fontScale } = useWindowDimensions();
  // The kill switch is enforced HERE, not (only) by the screen wrapper: the
  // flag's §11 purpose is incident response, so any embed of this section
  // must go dark with it. Same shared predicate as the sibling sections.
  const isFeatureEnabled = usePriceHistoryEnabled(network);
  const [measuredWidth, setMeasuredWidth] = useState(DEFAULT_CHART_WIDTH);

  // token_chart.loaded fires when a fetch actually resolves (§7.5) — the
  // hook's onLoaded skips cache hits, superseded responses, and errors.
  const handleLoaded = useCallback(
    (loadedData: TokenPriceHistory) => {
      analytics.trackTokenChartLoaded({ tokenId, data: loadedData, network });
    },
    [tokenId, network],
  );

  // token_chart.range_changed fires once the user SETTLES on a timeframe —
  // the hook calls this from its debounced path, not from the tap handler,
  // so rapid cycling reports only the range that is actually fetched (§7.5).
  const handleRangeSettled = useCallback((settledRange: PriceHistoryRange) => {
    analytics.trackTokenChartRangeChanged(settledRange);
  }, []);

  const { range, setRange, data, isLoading, error, retry, isEnabled } =
    useTokenPriceHistory({
      tokenId,
      network,
      enabled: isFeatureEnabled,
      onLoaded: handleLoaded,
      onRangeSettled: handleRangeSettled,
    });

  /**
   * One event per (token, range) SHOWN, cache hits included — `loaded` skips
   * those, and warming means an opened range is usually already cached. Keyed
   * off the series' own range so a mid-switch render cannot mis-attribute.
   */
  const viewedRangesRef = useRef(new Set<string>());
  useEffect(() => {
    viewedRangesRef.current.clear();
  }, [tokenId, network]);

  useEffect(() => {
    // `isEnabled` too: the kill switch can flip off while a request is in
    // flight, and the entry it commits would otherwise report a range the
    // section is no longer rendering — the switch exists to stop exactly that.
    if (!isEnabled || isLoading || !data?.range) {
      return;
    }
    if (viewedRangesRef.current.has(data.range)) {
      return;
    }
    viewedRangesRef.current.add(data.range);
    analytics.trackTokenChartViewed({ tokenId, data, network });
  }, [tokenId, network, data, isLoading, isEnabled]);

  if (!isEnabled) {
    return null;
  }

  const handleLayout = (event: LayoutChangeEvent) => {
    setMeasuredWidth(event.nativeEvent.layout.width);
  };

  const points = data?.points ?? [];
  const hasChart = hasChartData(points);
  // Fetch errors degrade to the empty-style placeholder; a cached series
  // keeps rendering through a failed refresh (stale chart beats blank).
  const isErrorState = !!error && !data;
  const isSkeleton = isLoading && !data && !isErrorState;

  const noticeVariant =
    data && hasChart
      ? getPriceHistoryNoticeVariant({
          lowVolume: data.lowVolume,
          isSparse: isSparseSeries(
            range,
            points,
            data.resolutionSeconds,
            Math.floor(Date.now() / 1000),
          ),
        })
      : null;

  // The chart still DESCRIBES the range's delta to assistive tech even though
  // it no longer draws it — same string the header shows, from the shared
  // formatter. `change: null` is the §4.2 coverage guard, not an error.
  // The domain the chart actually plots — first and last bucket ENDS, the
  // last clamped to now — not the raw timestamps, which are a full bucket
  // earlier (weeks, on ALL) than the first and last x the line is drawn at.
  const plotted = {
    points,
    resolutionSeconds: data?.resolutionSeconds ?? 0,
    nowSeconds: Math.floor(Date.now() / 1000),
  };
  const chartA11yLabel = hasChart
    ? t("priceHistory.chartA11yLabel", {
        range: formatRangeLabel(range, t),
        ...formatRangeEndpoints(
          range,
          getPlottedRangeStart(plotted),
          getPlottedRangeEnd(plotted),
        ),
        delta: data?.change
          ? formatPriceHistoryRangeDelta(data.change)
          : t("priceHistory.noDelta"),
      })
    : undefined;

  const renderChartArea = () => {
    if (isSkeleton) {
      // A blurred ghost of the chart rather than a flat block (Figma "Data
      // loading"): same height, so no layout shift, and the timeframe
      // selector below stays crisp and tappable throughout.
      return (
        <View
          testID="price-history-skeleton"
          className="w-full"
          style={{ height: priceChartHeight(fontScale) }}
          accessible
          accessibilityState={{ busy: true }}
          accessibilityLabel={t("priceHistory.loadingA11yLabel")}
        >
          <TokenPriceChartGhost
            testID="price-history-chart-ghost"
            width={measuredWidth}
          />
        </View>
      );
    }

    if (isErrorState) {
      return (
        <View
          testID="price-history-error"
          className="w-full items-center justify-center gap-4"
          style={{ height: priceChartHeight(fontScale) }}
        >
          <Text md medium secondary>
            {t("priceHistory.errorState")}
          </Text>
          <Button secondary md onPress={retry} testID="price-history-retry">
            {t("priceHistory.retry")}
          </Button>
        </View>
      );
    }

    if (!hasChart) {
      return (
        <View
          testID="price-history-empty"
          className="w-full items-center justify-center"
          style={{ height: priceChartHeight(fontScale) }}
        >
          <Text md medium secondary>
            {t("priceHistory.emptyState")}
          </Text>
        </View>
      );
    }

    return (
      <View accessible accessibilityLabel={chartA11yLabel}>
        <TokenPriceChart
          testID="price-history-chart"
          points={points}
          resolutionSeconds={data!.resolutionSeconds}
          // The chart draws its canvas a dot radius wider than the plot. This
          // is a SectionList header, and an iOS ScrollView clips to its
          // bounds, so that room comes out of the measured width instead of
          // overflowing it. The ghost keeps the full width: its line has no dot.
          width={measuredWidth - END_DOT_RADIUS}
          // Same `change` the header delta reads, through the same helper:
          // the chart cannot end up green while the number is red, and a move
          // the 2dp percent rounds away (D8) colours both the same way.
          // No delta at all (the §4.2 coverage guard) is neutral, not a claim.
          direction={getPriceChangeDirection(
            data?.change?.percent,
            data?.change?.absolute,
          )}
        />
      </View>
    );
  };

  return (
    <View
      className="gap-4"
      onLayout={handleLayout}
      testID="token-price-history-section"
    >
      {renderChartArea()}
      <TimeframeSelector selected={range} onSelect={setRange} />
      {noticeVariant && <PriceHistoryNotice variant={noticeVariant} />}
    </View>
  );
};

export default TokenPriceHistorySection;
