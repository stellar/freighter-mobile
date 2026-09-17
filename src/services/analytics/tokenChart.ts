import { AnalyticsEvent } from "config/analyticsConfig";
import { NETWORKS } from "config/constants";
import {
  PriceHistoryRange,
  TokenIdentifier,
  TokenPriceHistory,
} from "config/types";
import { hasChartData } from "helpers/priceHistoryChart";
import {
  classifyToken,
  getChartAssetIdentity,
  TokenKind,
} from "helpers/tokenClassification";
import { track } from "services/analytics/core";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

/** §7.5 `token_type` vocabulary — closed, shared with the extension. */
export type ChartTokenType = TokenKind;

/**
 * Maps an app-side token identifier to the §7.5 `token_type` property, via
 * the one shared classifier the About card also uses, so the label on screen
 * and the reported value can never disagree.
 */
export const getChartTokenType = (
  tokenId: TokenIdentifier,
  network?: NETWORKS,
): ChartTokenType => classifyToken(tokenId, network).kind;

interface TrackTokenChartLoadedParams {
  /** App-side token identifier of the charted token */
  tokenId: TokenIdentifier;
  /** Active network — lets a native SAC id classify as native, not soroban */
  network?: NETWORKS;
  /** The resolved history payload */
  data: TokenPriceHistory;
}

/**
 * The outcome event, fired when the history fetch resolves — the moment
 * `has_data` is known. `has_data` means a chart can draw (>= 2 points) and
 * its false rate is the empty-state metric; `low_volume` is present ONLY on a
 * `true` verdict. FROZEN cross-platform payload, asserted deep-equal against
 * the same fixture on both platforms.
 */
export const trackTokenChartLoaded = ({
  tokenId,
  data,
  network,
}: TrackTokenChartLoadedParams): void => {
  track(AnalyticsEvent.TOKEN_CHART_LOADED, {
    token_type: getChartTokenType(tokenId, network),
    has_data: hasChartData(data.points),
    ...(data.lowVolume === true ? { low_volume: true } : {}),
    range: data.range,
  });
};

interface TrackTokenChartViewedParams {
  /** App-side token identifier of the charted token */
  tokenId: TokenIdentifier;
  /** The series the user was shown */
  data: TokenPriceHistory;
  /** Active network — resolves a native SAC id to native, not soroban */
  network?: NETWORKS;
}

/**
 * One event per (token, range) the user was SHOWN, cache hits included.
 * Distinct from `loaded`, which fires only on a network fetch — warming means
 * an opened range is usually cached, so `loaded` fires about once per open
 * and its `has_data` would describe the default range only.
 *
 * `range` comes from the payload, not the selector, so a mid-switch render
 * cannot mis-attribute. FROZEN cross-platform payload: do not add, rename or
 * reorder without the extension.
 */
export const trackTokenChartViewed = ({
  tokenId,
  data,
  network,
}: TrackTokenChartViewedParams): void => {
  track(AnalyticsEvent.TOKEN_CHART_VIEWED, {
    ...getChartAssetIdentity(tokenId, network),
    has_data: hasChartData(data.points),
    range: data.range,
  });
};

/**
 * `token_chart.range_changed` — fired when the user settles on a new
 * timeframe. `range` uses the API enum spelling verbatim (§7.5).
 */
export const trackTokenChartRangeChanged = (range: PriceHistoryRange): void => {
  track(AnalyticsEvent.TOKEN_CHART_RANGE_CHANGED, { range });
};
