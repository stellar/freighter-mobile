import BigNumber from "bignumber.js";
import {
  PriceHistoryChange,
  PriceHistoryPoint,
  PriceHistoryRange,
} from "config/types";
import { formatFiatAmount, formatPercentageAmount } from "helpers/formatAmount";
import { ThemeColors } from "hooks/useColors";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

/**
 * Below this fraction of a range's expected points the chart carries the
 * limited-data notice. A starting point (raised from 25% in review); tune
 * once analytics land.
 */
export const SPARSE_SERIES_RATIO = 0.33;

/** Expected points per range at full coverage; real series are smaller. */
export const EXPECTED_POINTS_BY_RANGE: Record<PriceHistoryRange, number> = {
  "1H": 12,
  "1D": 97,
  "1W": 169,
  "1M": 180,
  "1Y": 122,
  ALL: 277,
};

/**
 * 0–1 points are the empty state, not sparse. ALL is measured against the
 * token's own lifetime (first bucket to now), not the fixed table: ALL starts
 * before the network, so the fixed count flags every token younger than XLM.
 */
export const isSparseSeries = (
  range: PriceHistoryRange,
  points: PriceHistoryPoint[],
  resolutionSeconds: number,
  nowSeconds: number,
): boolean => {
  if (points.length < 2) return false;

  const expected =
    range === "ALL" && resolutionSeconds > 0
      ? Math.ceil((nowSeconds - points[0].t) / resolutionSeconds)
      : EXPECTED_POINTS_BY_RANGE[range];

  return points.length < expected * SPARSE_SERIES_RATIO;
};

/**
 * Each range's lookback window. Must match freighter-backend-v2's
 * `priceHistoryRanges`, or a token that started trading just outside the
 * window is called newly traded. ALL has no window.
 */
export const RANGE_WINDOW_SECONDS: Partial<Record<PriceHistoryRange, number>> =
  {
    "1H": 3600,
    "1D": 86400,
    "1W": 7 * 86400,
    "1M": 30 * 86400,
    "1Y": 365 * 86400,
  };

/** ALL first: its first point is what tells a newly traded token apart from
 * a limited-data one, and until it lands every range falls back to the
 * latter. */
export const PRICE_HISTORY_WARM_ORDER: PriceHistoryRange[] = [
  "ALL",
  "1H",
  "1D",
  "1W",
  "1M",
  "1Y",
];

const NARROWING_ORDER: PriceHistoryRange[] = ["1Y", "1M", "1W", "1D", "1H"];

/**
 * The earliest the token's first trade can be: the start of ALL's first
 * bucket, narrowed by each finer cached range whose window (measured from
 * when it was fetched) reaches back to the bound — every trade then falls
 * inside that range, so its first bucket holds the first trade. Without the
 * narrowing, ALL's two-week buckets put a token launched today before the 1D
 * window. Undefined until ALL is cached.
 */
export const getFirstTradeLowerBound = (
  cachedByRange: Partial<
    Record<string, { data: { points: PriceHistoryPoint[] }; updatedAt: number }>
  >,
  nowSeconds: number,
): number | undefined => {
  let bound = cachedByRange.ALL?.data.points[0]?.t;
  if (bound === undefined) return undefined;

  NARROWING_ORDER.forEach((range) => {
    const entry = cachedByRange[range];
    const firstT = entry?.data.points[0]?.t;
    if (!entry || firstT === undefined || bound === undefined) return;
    const fetchedAtSeconds = Math.min(entry.updatedAt / 1000, nowSeconds);
    if (fetchedAtSeconds - (RANGE_WINDOW_SECONDS[range] ?? 0) <= bound) {
      bound = Math.max(bound, firstT);
    }
  });

  return bound;
};

/**
 * A sparse series whose shortfall is explained by the token's age. The
 * backend returns only buckets that traded, so a series' first point is the
 * first trade in the window, not the token's first trade: an old token that
 * traded only in the last hour looks young from its own series. Only
 * `firstTradeSeconds` can rule that out, and it is a lower bound, so an
 * unknown or straddling first trade is not newly traded.
 */
export const isNewlyTradedSeries = (
  range: PriceHistoryRange,
  points: PriceHistoryPoint[],
  resolutionSeconds: number,
  nowSeconds: number,
  firstTradeSeconds: number | undefined,
): boolean => {
  const windowSeconds = RANGE_WINDOW_SECONDS[range];
  if (
    !windowSeconds ||
    firstTradeSeconds === undefined ||
    resolutionSeconds <= 0 ||
    points.length === 0 ||
    firstTradeSeconds <= nowSeconds - windowSeconds
  ) {
    return false;
  }
  const expectedSinceFirstPoint = Math.ceil(
    (nowSeconds - points[0].t) / resolutionSeconds,
  );
  return points.length >= expectedSinceFirstPoint * SPARSE_SERIES_RATIO;
};

/**
 * Keeps the plotted extremes off the plot band's edges: the high/low labels
 * sit immediately above and below, so an unpadded min lands hard against its
 * own label. Matches the extension's constant.
 */
export const CHART_VERTICAL_PADDING = 8;

/**
 * Two points is the floor for a line. The `has_data` analytics property, the
 * chart-vs-empty gate, the notice and the header delta all read this one
 * rule; its value is part of the frozen cross-platform analytics contract.
 */
export const hasChartData = (points: PriceHistoryPoint[]): boolean =>
  points.length >= 2;

/**
 * The timestamp at which the LAST point is plotted: its bucket end, clamped
 * to `now` (the in-progress bucket; spot is never plotted) but never before
 * the point it follows — the same clamp {@link computeChartGeometry} applies.
 */
export const getPlottedRangeEnd = ({
  points,
  resolutionSeconds,
  nowSeconds,
}: {
  points: PriceHistoryPoint[];
  resolutionSeconds: number;
  nowSeconds: number;
}): number => {
  const lastIndex = points.length - 1;
  const bucketEnd = points[lastIndex].t + resolutionSeconds;
  const previousBucketEnd =
    lastIndex > 0
      ? points[lastIndex - 1].t + resolutionSeconds
      : Number.NEGATIVE_INFINITY;

  return Math.max(previousBucketEnd, Math.min(bucketEnd, nowSeconds));
};
/**
 * Where the FIRST point is plotted: its bucket end, unclamped unless it is
 * also the final point. The text alternative announces this, not the raw
 * bucket start — which is a full bucket earlier, weeks on ALL.
 */
export const getPlottedRangeStart = (input: {
  points: PriceHistoryPoint[];
  resolutionSeconds: number;
  nowSeconds: number;
}): number =>
  input.points.length === 1
    ? getPlottedRangeEnd(input)
    : input.points[0].t + input.resolutionSeconds;

const INSPECT_TIME_RANGES: PriceHistoryRange[] = ["1H", "1D"];
const INSPECT_YEAR_RANGES: PriceHistoryRange[] = ["1Y", "ALL"];

/** The inspected point's timestamp label parts; the caller joins them through i18n. */
export const formatInspectedTimestamp = ({
  unixSeconds,
  range,
  locale,
}: {
  unixSeconds: number;
  range: PriceHistoryRange;
  locale: string;
}): { date: string; time?: string } => {
  const instant = new Date(unixSeconds * 1000);
  const date = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(INSPECT_YEAR_RANGES.includes(range) && { year: "numeric" }),
  }).format(instant);

  if (!INSPECT_TIME_RANGES.includes(range)) {
    return { date };
  }

  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  })
    .format(instant)
    .toLowerCase();

  return { date, time };
};

/**
 * Index of the plotted x nearest to `x` — the drag-to-inspect SNAP (Phase 3).
 *
 * `xs` is ascending but not strictly: the clock-skew clamp can put several
 * points on one x. Ties and duplicates resolve to the LATER index, so a
 * finger on a collapsed cluster reads the most recent close in it — the one
 * the polyline is drawn on from. At the ~277-point ALL ceiling adjacent
 * points sit ~2px apart; per-point precision is never asked of the user.
 * Returns -1 for an empty series.
 */
export const nearestCoordinateIndex = (xs: number[], x: number): number => {
  if (xs.length === 0) {
    return -1;
  }

  // First index whose x is >= the pointer.
  let low = 0;
  let high = xs.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (xs[mid] < x) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  let best = low;
  const previous = low - 1;
  // Strictly nearer wins; an exact tie stays on `low`, the later point.
  if (previous >= 0 && x - xs[previous] < xs[low] - x) {
    best = previous;
  }
  while (best + 1 < xs.length && xs[best + 1] === xs[best]) {
    best += 1;
  }

  return best;
};

/**
 * The one delta the client computes (D8 exception, Phase 3): close-to-close
 * from the first plotted point to the inspected one. Shaped exactly like the
 * server's `change` so the header formats it through the same path.
 * `percent` is rounded to 2dp as the backend does, so a real-but-tiny move
 * arrives as "0.00" beside a live absolute and the direction helper falls
 * back to the absolute — the same behaviour the server delta already has.
 * A zero start price reports "0.00" rather than dividing by zero.
 */
export const computeInspectedChange = (
  from: PriceHistoryPoint,
  to: PriceHistoryPoint,
): PriceHistoryChange => {
  const start = new BigNumber(from.p);
  const absolute = new BigNumber(to.p).minus(start);
  const percent = start.isZero()
    ? new BigNumber(0)
    : absolute.div(start).times(100);

  return { absolute: absolute.toFixed(), percent: percent.toFixed(2) };
};

export interface ChartCoordinate {
  x: number;
  y: number;
}

export interface ChartGeometry {
  /** Pixel-space coordinates, one per input point — none added, none dropped */
  coords: ChartCoordinate[];
  /** Lowest price in the series (raw string, for the axis label) */
  minPrice: string;
  /** Highest price in the series (raw string, for the axis label) */
  maxPrice: string;
  /** Coordinate of the lowest-priced point */
  minCoord: ChartCoordinate;
  /** Coordinate of the highest-priced point */
  maxCoord: ChartCoordinate;
}

interface ComputeChartGeometryParams {
  points: PriceHistoryPoint[];
  resolutionSeconds: number;
  /** Current unix time in seconds (injected for testability) */
  nowSeconds: number;
  width: number;
  height: number;
}

/**
 * Maps the wire series to pixel space:
 *
 * - Exactly the `points` array — nothing fabricated, appended or filled.
 *   Fewer than 2 points returns null.
 * - Positioned by TIMESTAMP, never index: each `p` is a bucket close, plotted
 *   at the bucket END, so a gap draws as one visibly long segment.
 * - The in-progress final bucket clamps to now — repositioning that point,
 *   never adding one or substituting spot. The clamp is MONOTONIC: a device
 *   clock behind the server would otherwise invert the x-domain, doubling the
 *   line back and self-intersecting the fill.
 */
export const computeChartGeometry = ({
  points,
  resolutionSeconds,
  nowSeconds,
  width,
  height,
}: ComputeChartGeometryParams): ChartGeometry | null => {
  if (points.length < 2) {
    return null;
  }

  const bucketEnds = points.map((point) => point.t + resolutionSeconds);
  const lastIndex = bucketEnds.length - 1;
  // Clamp to now, but never before the previous bucket end: a device clock
  // behind the server must not invert the x-domain (see the doc comment).
  // points.length >= 2 above, so lastIndex - 1 always exists.
  bucketEnds[lastIndex] = Math.max(
    bucketEnds[lastIndex - 1],
    Math.min(bucketEnds[lastIndex], nowSeconds),
  );

  const t0 = bucketEnds[0];
  // Monotonic by construction, so the span is >= 0; `|| 1` covers the
  // degenerate all-clamped-to-one-instant case (every x collapses to 0).
  const timeSpan = bucketEnds[lastIndex] - t0 || 1;

  const prices = points.map((point) => new BigNumber(point.p));
  let minIndex = 0;
  let maxIndex = 0;
  prices.forEach((price, index) => {
    if (price.lt(prices[minIndex])) minIndex = index;
    if (price.gt(prices[maxIndex])) maxIndex = index;
  });
  const minPriceBn = prices[minIndex];
  const maxPriceBn = prices[maxIndex];
  const priceSpan = maxPriceBn.minus(minPriceBn);
  const isFlat = priceSpan.isZero();

  const drawableHeight = height - CHART_VERTICAL_PADDING * 2;

  const coords = points.map((point, index) => {
    const x = ((bucketEnds[index] - t0) / timeSpan) * width;
    // Plotted inside a band inset by CHART_VERTICAL_PADDING top and bottom, so
    // the extremes never touch the label rows that sit immediately above and
    // below them. A flat series still centres.
    const y = isFlat
      ? height / 2
      : CHART_VERTICAL_PADDING +
        (1 - prices[index].minus(minPriceBn).div(priceSpan).toNumber()) *
          drawableHeight;
    return { x, y };
  });

  return {
    coords,
    minPrice: points[minIndex].p,
    maxPrice: points[maxIndex].p,
    minCoord: coords[minIndex],
    maxCoord: coords[maxIndex],
  };
};

/** Identical on both platforms, so a switch feels the same on each. */
export const CHART_MORPH_DURATION_MS = 250;

/**
 * Cubic ease-out — exactly Reanimated's `Easing.out(Easing.cubic)`, which the
 * extension's rAF loop calls directly, so both animate on one curve.
 * Deliberately unclamped: {@link interpolateChartCoordinates} clamps instead.
 */
export const easeOutCubic = (progress: number): number => {
  "worklet";

  return 1 - (1 - progress) ** 3;
};

/**
 * The outgoing series' y at an arbitrary x, linearly interpolated between the
 * bracketing pair; outside its domain the nearest endpoint's y holds, so an
 * incoming series that extends further still has a height to start from.
 * `coords` must be sorted by x, which the geometry's monotonic clamp
 * guarantees; a duplicate x is a zero-width bracket and the later y wins.
 */
export const sampleCoordinateY = (
  coords: ChartCoordinate[],
  x: number,
): number => {
  "worklet";

  const last = coords.length - 1;

  if (x <= coords[0].x) {
    return coords[0].y;
  }
  if (x >= coords[last].x) {
    return coords[last].y;
  }

  for (let index = 0; index < last; index += 1) {
    const start = coords[index];
    const end = coords[index + 1];

    if (x <= end.x) {
      const span = end.x - start.x;

      // Zero-width bracket (duplicate x): the later point is what the line
      // actually shows at that x.
      if (span === 0) {
        return end.y;
      }

      return start.y + (end.y - start.y) * ((x - start.x) / span);
    }
  }

  return coords[last].y;
};

interface InterpolateChartCoordinatesParams {
  /** The outgoing series' geometry — the shape currently on screen */
  from: ChartCoordinate[];
  /** The incoming series' REAL geometry, straight from computeChartGeometry */
  to: ChartCoordinate[];
  /** Already-eased tween progress; clamped to [0, 1] here */
  progress: number;
}

/**
 * One frame of a morph:
 *
 *   `frame[k] = { x: to[k].x, y: lerp(sampleY(from, to[k].x), to[k].y, p) }`
 *
 * Only y tweens, and only at the INCOMING series' own x positions — the two
 * are never resampled onto a common grid. So the settled chart is
 * byte-identical to a hard switch, and monotonic x is inherited from `to`,
 * keeping the clock-skew guard valid mid-tween. Interpolated frames are
 * transient animation, not rendered data.
 *
 * `p >= 1` returns `to`'s own numbers by early return, since `a + (b - a) * 1`
 * is not exact for every float pair. Nothing to morph returns `to` as well.
 */
export const interpolateChartCoordinates = ({
  from,
  to,
  progress,
}: InterpolateChartCoordinatesParams): ChartCoordinate[] => {
  "worklet";

  const clamped = progress < 0 ? 0 : progress;

  if (clamped >= 1 || from.length < 2 || to.length < 2) {
    return to.slice();
  }

  return to.map((coord) => {
    const startY = sampleCoordinateY(from, coord.x);

    return { x: coord.x, y: startY + (coord.y - startY) * clamped };
  });
};

/** Prices below this magnitude are formatted by significant digits. */
const SUB_CENT_THRESHOLD = new BigNumber("0.01");
/** Matches the extension, so both label a micro-priced token identically. */
const SUB_CENT_SIGNIFICANT_DIGITS = 2;
/** Sane maximum so a dust price can't render an unreadably long label. */
const MAX_LABEL_DECIMALS = 8;
/** Cent-and-above keeps today's 2-to-4 decimal behavior (XLM: "$0.1589"). */
const MIN_LABEL_DECIMALS = 2;
const MAX_SUB_DOLLAR_DECIMALS = 4;

/**
 * Decimal places for a sub-dollar magnitude. At or above a cent, the value's
 * own places clamped to [2, 4]; below it, enough for
 * {@link SUB_CENT_SIGNIFICANT_DIGITS} significant digits — `BigNumber.e` is
 * floor(log10(value)), so two need `1 - e` places (0.00001 → "0.000010").
 */
const subDollarDecimalPlaces = (abs: BigNumber): number => {
  if (abs.isZero()) {
    return MIN_LABEL_DECIMALS;
  }

  if (abs.gte(SUB_CENT_THRESHOLD)) {
    return Math.min(
      Math.max(abs.decimalPlaces() ?? MIN_LABEL_DECIMALS, MIN_LABEL_DECIMALS),
      MAX_SUB_DOLLAR_DECIMALS,
    );
  }

  return Math.min(
    SUB_CENT_SIGNIFICANT_DIGITS - 1 - (abs.e ?? 0),
    MAX_LABEL_DECIMALS,
  );
};

/**
 * Standard fiat formatting at a dollar and above; below it the decimals adapt.
 * A fixed 2-to-4-decimal pipeline rendered every micro-priced token as
 * "$0.00" and collapsed a chart's high and low onto one label.
 */
export const formatPriceHistoryLabel = (price: string | BigNumber): string => {
  const bn = new BigNumber(price);
  const abs = bn.abs();

  if (abs.gte(1)) {
    return formatFiatAmount(bn);
  }

  return `${bn.lt(0) ? "-" : ""}$${abs.toFixed(subDollarDecimalPlaces(abs))}`;
};

/**
 * `change.absolute` verbatim — never reconstructed from the percentage (the
 * `now × pct/100` derivation in TrendingTokenDetailBottomSheet is wrong by a
 * factor of (1 + pct/100); do not copy it). The sign is always in the text.
 */
export const formatPriceHistoryDelta = (absolute: string): string => {
  const bn = new BigNumber(absolute);
  const label = formatPriceHistoryLabel(bn.abs());

  if (bn.gt(0)) {
    return `+${label}`;
  }
  if (bn.lt(0)) {
    return `-${label}`;
  }

  return label;
};

/**
 * The one presentation of a range delta, shared by the header and the chart's
 * accessibility label so they cannot describe a range differently. Both
 * halves come from the server's `change`; neither is derived from the other.
 *
 * The sign is carried once, by the absolute — signing both would print
 * "(+32.12%)" and diverge from the design and the extension at once. When the
 * absolute rounds away, the signed percentage stands alone.
 */
export const formatPriceHistoryRangeDelta = (
  change: PriceHistoryChange,
): string => {
  const signedPercent = formatPercentageAmount(change.percent);
  const absolute = formatPriceHistoryDelta(change.absolute);

  // Zero at the precision the label prints, not on the wire: past the decimal
  // cap a real move formats to "$0.00000000", a signed zero.
  const magnitude = new BigNumber(change.absolute).abs();
  if (
    new BigNumber(magnitude.toFixed(subDollarDecimalPlaces(magnitude))).isZero()
  ) {
    return signedPercent;
  }

  // Drop the percent's own sign; the absolute already carries it.
  return `${absolute} (${signedPercent.replace(/^[+-]/, "")})`;
};

/**
 * Three states, not two: the design draws a negative range RED, text and
 * artwork alike, where the old rule drew it neutral.
 */
export type PriceChangeDirection = "positive" | "negative" | "neutral";

/**
 * The sign of one half of a change, as a direction. Anything without a
 * magnitude to show — absent, non-numeric, or exactly zero — is neutral.
 */
const directionOfValue = (
  value: BigNumber.Value | null | undefined,
): PriceChangeDirection => {
  if (value === null || value === undefined) {
    return "neutral";
  }

  const bn = new BigNumber(value);

  if (!bn.isFinite()) {
    return "neutral";
  }
  if (bn.isGreaterThan(0)) {
    return "positive";
  }
  if (bn.isLessThan(0)) {
    return "negative";
  }

  return "neutral";
};

/**
 * The one direction behind the delta's sign, its colour and the artwork, so
 * the three cannot disagree. The percent decides when it has a magnitude;
 * when it does not, the absolute does — the backend rounds percent to two
 * decimals, so a real-but-tiny move arrives as `percent: "0"` beside a live
 * absolute, and reading the percent alone printed a signed dollar figure in
 * flat grey.
 *
 * A genuinely flat range is NEUTRAL, not negative — unlike the extension's
 * `getPriceDeltaColor`, which maps zero to its negative colour.
 */
export const getPriceChangeDirection = (
  percent: BigNumber.Value | null | undefined,
  absolute?: BigNumber.Value | null,
): PriceChangeDirection => {
  const fromPercent = directionOfValue(percent);

  return fromPercent === "neutral" ? directionOfValue(absolute) : fromPercent;
};

/**
 * The one place a direction becomes a colour, shared by the header delta and
 * the chart artwork so the two can never disagree. Existing palette entries
 * only — `status.error` is the red-09 counterpart of the green already in use.
 */
export const getPriceChangeColor = (
  direction: PriceChangeDirection,
  themeColors: ThemeColors,
): string => {
  switch (direction) {
    case "positive":
      return themeColors.status.success;
    case "negative":
      return themeColors.status.error;
    default:
      return themeColors.text.secondary;
  }
};
