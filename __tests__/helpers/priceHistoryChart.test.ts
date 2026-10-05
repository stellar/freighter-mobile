import { getThemeColors } from "config/colors";
import {
  ChartCoordinate,
  CHART_MORPH_DURATION_MS,
  computeChartGeometry,
  CHART_VERTICAL_PADDING,
  easeOutCubic,
  EXPECTED_POINTS_BY_RANGE,
  formatInspectedTimestamp,
  formatPriceHistoryDelta,
  formatPriceHistoryLabel,
  formatPriceHistoryRangeDelta,
  getPriceChangeColor,
  getPriceChangeDirection,
  interpolateChartCoordinates,
  getFirstTradeLowerBound,
  isNewlyTradedSeries,
  isSparseSeries,
  SPARSE_SERIES_RATIO,
  hasChartData,
  getPlottedRangeStart,
  getPlottedRangeEnd,
} from "helpers/priceHistoryChart";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

describe("computeChartGeometry", () => {
  const size = { width: 300, height: 150 };

  it("returns null for fewer than 2 points (one point cannot form a line)", () => {
    expect(
      computeChartGeometry({
        points: [],
        resolutionSeconds: 900,
        nowSeconds: 10_000,
        ...size,
      }),
    ).toBeNull();
    expect(
      computeChartGeometry({
        points: [{ t: 0, p: "1" }],
        resolutionSeconds: 900,
        nowSeconds: 10_000,
        ...size,
      }),
    ).toBeNull();
  });

  it("positions points by timestamp at the bucket END, never by array index", () => {
    // Sparse, NON-uniform series: gaps of 900s and 2700s. Index-positioned
    // rendering would space these equally; timestamp positioning must give
    // the second segment 3x the width of the first.
    const geometry = computeChartGeometry({
      points: [
        { t: 0, p: "1.0" },
        { t: 900, p: "2.0" },
        { t: 3600, p: "3.0" },
      ],
      resolutionSeconds: 900,
      nowSeconds: 100_000,
      ...size,
    });

    expect(geometry).not.toBeNull();
    const [a, b, c] = geometry!.coords;
    // Bucket ends: 900, 1800, 4500 → domain [900, 4500], span 3600.
    expect(a.x).toBeCloseTo(0);
    expect(b.x).toBeCloseTo(((1800 - 900) / 3600) * size.width);
    expect(c.x).toBeCloseTo(size.width);
    // Segment ratio 1:3, not 1:1.
    expect((c.x - b.x) / (b.x - a.x)).toBeCloseTo(3);
  });

  it("clamps the final in-progress bucket's x to now without adding a point", () => {
    // Final bucket end (t + resolution = 2700) lies in the future
    // (now = 2000): reposition that existing point to now.
    const geometry = computeChartGeometry({
      points: [
        { t: 0, p: "1.0" },
        { t: 900, p: "2.0" },
        { t: 1800, p: "3.0" },
      ],
      resolutionSeconds: 900,
      nowSeconds: 2000,
      ...size,
    });

    // Domain: [900, 2000] — exactly the input points, none added.
    expect(geometry!.coords).toHaveLength(3);
    const [a, b, c] = geometry!.coords;
    expect(a.x).toBeCloseTo(0);
    expect(c.x).toBeCloseTo(size.width);
    // b at bucket end 1800 of an 1100s span starting at 900.
    expect(b.x).toBeCloseTo(((1800 - 900) / (2000 - 900)) * size.width);
  });

  it("keeps the x-domain monotonic when the device clock is behind the server", () => {
    // Device clock skew: `now` sits BEFORE the last two bucket ends. Clamping
    // only the final point to `now` would move it left of its predecessor —
    // the polyline doubles back and the gradient path self-intersects.
    const geometry = computeChartGeometry({
      points: [
        { t: 0, p: "1.0" },
        { t: 900, p: "2.0" },
        { t: 1800, p: "3.0" },
      ],
      resolutionSeconds: 900,
      nowSeconds: 1000,
      ...size,
    });

    const xs = geometry!.coords.map((coord) => coord.x);
    xs.slice(1).forEach((x, index) => {
      expect(x).toBeGreaterThanOrEqual(xs[index]);
    });
    // The clamp cannot pull the final point past its predecessor.
    expect(xs[2]).toBeCloseTo(xs[1]);
    xs.forEach((x) => {
      expect(Number.isFinite(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(size.width);
    });
  });

  it("never produces a negative time span when skew exceeds the visible window", () => {
    // Skew beyond the whole span: `now` is before even the FIRST bucket end,
    // which a plain Math.min clamp turns into a negative span (the `|| 1`
    // guard only catches exactly 0) and mirrors the chart.
    const geometry = computeChartGeometry({
      points: [
        { t: 10_000, p: "1.0" },
        { t: 10_900, p: "2.0" },
        { t: 11_800, p: "3.0" },
      ],
      resolutionSeconds: 900,
      nowSeconds: 5_000,
      ...size,
    });

    const xs = geometry!.coords.map((coord) => coord.x);
    xs.slice(1).forEach((x, index) => {
      expect(x).toBeGreaterThanOrEqual(xs[index]);
    });
    xs.forEach((x) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(size.width);
    });
  });

  it("maps the max price near the top and the min price near the bottom", () => {
    const geometry = computeChartGeometry({
      points: [
        { t: 0, p: "1.0" },
        { t: 900, p: "3.0" },
        { t: 1800, p: "2.0" },
      ],
      resolutionSeconds: 900,
      nowSeconds: 100_000,
      ...size,
    });

    const [a, b, c] = geometry!.coords;
    // Inset by the vertical padding rather than flush against the edges: the
    // high and low labels sit in bands directly above and below the plot, so
    // an extreme drawn on the boundary crowds its own label.
    expect(a.y).toBeCloseTo(size.height - CHART_VERTICAL_PADDING); // min → near bottom
    expect(b.y).toBeCloseTo(CHART_VERTICAL_PADDING); // max → near top
    expect(c.y).toBeCloseTo(size.height / 2);
    expect(geometry!.minPrice).toBe("1.0");
    expect(geometry!.maxPrice).toBe("3.0");
  });

  it("keeps every point clear of the label bands above and below", () => {
    // Regression: the min price mapped to exactly `height`, so the lowest
    // point sat on the boundary with the low price label immediately beneath
    // it — visibly cramped against its own label on a real chart.
    const geometry = computeChartGeometry({
      points: [
        { t: 0, p: "0.1794" },
        { t: 900, p: "0.1796" },
        { t: 1800, p: "0.1795" },
      ],
      resolutionSeconds: 900,
      nowSeconds: 100_000,
      ...size,
    });

    geometry!.coords.forEach((coord) => {
      expect(coord.y).toBeGreaterThanOrEqual(CHART_VERTICAL_PADDING);
      expect(coord.y).toBeLessThanOrEqual(size.height - CHART_VERTICAL_PADDING);
    });
  });

  it("centers a flat series vertically instead of dividing by zero", () => {
    const geometry = computeChartGeometry({
      points: [
        { t: 0, p: "1.0" },
        { t: 900, p: "1.0" },
      ],
      resolutionSeconds: 900,
      nowSeconds: 100_000,
      ...size,
    });

    geometry!.coords.forEach((coord) => {
      expect(coord.y).toBeCloseTo(size.height / 2);
    });
  });
});

describe("plotted range domain", () => {
  // The chart plots each point at its bucket END, so the text alternative has
  // to announce those, not the raw bucket starts one resolution earlier.
  const points = [
    { t: 1000, p: "1" },
    { t: 1900, p: "2" },
  ];

  it("starts at the first bucket's end, not its start", () => {
    expect(
      getPlottedRangeStart({ points, resolutionSeconds: 900, nowSeconds: 1e9 }),
    ).toBe(1900);
  });

  it("ends at the last bucket's end, clamped to now", () => {
    expect(
      getPlottedRangeEnd({ points, resolutionSeconds: 900, nowSeconds: 1e9 }),
    ).toBe(2800);
    expect(
      getPlottedRangeEnd({ points, resolutionSeconds: 900, nowSeconds: 2500 }),
    ).toBe(2500);
  });

  it("never pulls the end before the point it follows (clock behind server)", () => {
    expect(
      getPlottedRangeEnd({ points, resolutionSeconds: 900, nowSeconds: 100 }),
    ).toBe(1900);
  });

  it("collapses to the single plotted point for a one-point series", () => {
    const one = [{ t: 1000, p: "1" }];
    expect(
      getPlottedRangeStart({
        points: one,
        resolutionSeconds: 900,
        nowSeconds: 1500,
      }),
    ).toBe(1500);
  });
});

describe("hasChartData", () => {
  it("needs two points to draw a line", () => {
    expect(hasChartData([])).toBe(false);
    expect(hasChartData([{ t: 1, p: "1" }])).toBe(false);
    expect(
      hasChartData([
        { t: 1, p: "1" },
        { t: 2, p: "2" },
      ]),
    ).toBe(true);
  });
});

describe("isSparseSeries", () => {
  const NOW = 1790000000;
  const TWO_WEEKS = 1209600;
  /** `count` consecutive buckets of `resolution`, the last one ending at NOW. */
  const series = (count: number, resolution = 300) =>
    Array.from({ length: count }, (_, i) => ({
      t: NOW - (count - i) * resolution,
      p: "1",
    }));

  it("flags a series below ~33% of the range's expected point count", () => {
    // 1H expects 12 points → threshold 3.96: 3 is sparse, 4 is not.
    expect(isSparseSeries("1H", series(3), 300, NOW)).toBe(true);
    expect(isSparseSeries("1H", series(4), 300, NOW)).toBe(false);
    // 1Y expects 122 → threshold ~40: 39 sparse, 41 not.
    expect(isSparseSeries("1Y", series(39, 259200), 259200, NOW)).toBe(true);
    expect(isSparseSeries("1Y", series(41, 259200), 259200, NOW)).toBe(false);
  });

  it("never flags the empty/one-point states (they are empty, not sparse)", () => {
    expect(isSparseSeries("1D", [], 900, NOW)).toBe(false);
    expect(isSparseSeries("1D", series(1, 900), 900, NOW)).toBe(false);
  });

  it("does not flag ALL for a young token with an unbroken history", () => {
    // USDY's shape: 27 two-week buckets since launch, none missing. Against
    // the fixed 277 it read as 10% coverage.
    expect(isSparseSeries("ALL", series(27, TWO_WEEKS), TWO_WEEKS, NOW)).toBe(
      false,
    );
  });

  it("still flags ALL when a token's own history has gaps", () => {
    // First bucket ~3 years back (78 buckets to now), only 10 of them traded.
    const gappy = [
      { t: NOW - 78 * TWO_WEEKS, p: "1" },
      ...series(9, TWO_WEEKS),
    ];
    expect(isSparseSeries("ALL", gappy, TWO_WEEKS, NOW)).toBe(true);
  });

  it("uses the named constants (ratio scales with the interval automatically)", () => {
    expect(SPARSE_SERIES_RATIO).toBe(0.33);
    expect(EXPECTED_POINTS_BY_RANGE).toEqual({
      "1H": 12,
      "1D": 97,
      "1W": 169,
      "1M": 180,
      "1Y": 122,
      ALL: 277,
    });
  });
});

describe("getFirstTradeLowerBound", () => {
  const NOW = 1790000000;
  const HOUR = 3600;
  const DAY = 86400;
  const cached = (range: string, firstT: number, updatedAtSeconds = NOW) => ({
    data: {
      token: "native",
      range,
      resolutionSeconds: 900,
      currency: "USD",
      lowVolume: false,
      change: null,
      points: [{ t: firstT, p: "1" }],
    },
    updatedAt: updatedAtSeconds * 1000,
  });

  it("is unknown until ALL is cached", () => {
    expect(
      getFirstTradeLowerBound({ "1D": cached("1D", NOW - 6 * HOUR) }, NOW),
    ).toBeUndefined();
  });

  it("is ALL's first bucket start when nothing finer covers it", () => {
    expect(
      getFirstTradeLowerBound({ ALL: cached("ALL", NOW - 400 * DAY) }, NOW),
    ).toBe(NOW - 400 * DAY);
  });

  it("narrows a launch hours ago down to the 1D bucket", () => {
    // ALL's two-week bucket alone starts before the 1D window.
    expect(
      getFirstTradeLowerBound(
        {
          ALL: cached("ALL", NOW - 12 * DAY),
          "1Y": cached("1Y", NOW - 2 * DAY),
          "1M": cached("1M", NOW - 8 * HOUR),
          "1W": cached("1W", NOW - 7 * HOUR),
          "1D": cached("1D", NOW - 6 * HOUR),
        },
        NOW,
      ),
    ).toBe(NOW - 6 * HOUR);
  });

  it("does not narrow through a range whose window starts after the bound", () => {
    // 1W's window starts 7 days back, after the 8.5-day bound, so trades
    // before it are invisible to 1W — its later first point proves nothing.
    expect(
      getFirstTradeLowerBound(
        {
          ALL: cached("ALL", NOW - 10 * DAY),
          "1M": cached("1M", NOW - 8.5 * DAY),
          "1W": cached("1W", NOW - 1 * DAY),
        },
        NOW,
      ),
    ).toBe(NOW - 8.5 * DAY);
  });

  it("measures a cached range's window from when it was fetched", () => {
    // 1W fetched 3 days ago reached back 10 days, past the 9-day bound.
    expect(
      getFirstTradeLowerBound(
        {
          ALL: cached("ALL", NOW - 9 * DAY),
          "1W": cached("1W", NOW - 8 * DAY, NOW - 3 * DAY),
        },
        NOW,
      ),
    ).toBe(NOW - 8 * DAY);
  });
});

describe("isNewlyTradedSeries", () => {
  const NOW = 1790000000;
  const THREE_DAYS = 259200;
  const FIFTEEN_MIN = 900;
  /** `count` consecutive buckets of `resolution`, the last one ending at NOW. */
  const series = (count: number, resolution: number) =>
    Array.from({ length: count }, (_, i) => ({
      t: NOW - (count - i) * resolution,
      p: "1",
    }));
  // USDT0 on 1Y: 12 three-day buckets, unbroken, from its first trade.
  const youngOneYear = series(12, THREE_DAYS);
  const firstTradeInWindow = NOW - 13 * THREE_DAYS;

  it("is true when the first trade is inside the window and coverage since is dense", () => {
    expect(
      isNewlyTradedSeries(
        "1Y",
        youngOneYear,
        THREE_DAYS,
        NOW,
        firstTradeInWindow,
      ),
    ).toBe(true);
  });

  it("is false while the token's first trade is unknown", () => {
    expect(
      isNewlyTradedSeries("1Y", youngOneYear, THREE_DAYS, NOW, undefined),
    ).toBe(false);
  });

  it("is false for an old token that only traded late in the window", () => {
    // The backend returns only buckets that traded, so this series alone is
    // indistinguishable from a young token: 8 dense buckets in the last 2h.
    expect(
      isNewlyTradedSeries(
        "1D",
        series(8, FIFTEEN_MIN),
        FIFTEEN_MIN,
        NOW,
        NOW - 2 * 365 * 86400,
      ),
    ).toBe(false);
  });

  it("is false when the first trade is only known to fall before the window", () => {
    expect(
      isNewlyTradedSeries("1W", series(40, 3600), 3600, NOW, NOW - 10 * 86400),
    ).toBe(false);
  });

  it("is false for a young token with gaps since its first trade", () => {
    const gappy = [
      { t: NOW - 12 * THREE_DAYS, p: "1" },
      ...series(2, THREE_DAYS),
    ];
    expect(
      isNewlyTradedSeries("1Y", gappy, THREE_DAYS, NOW, firstTradeInWindow),
    ).toBe(false);
  });

  it("is never true on ALL, which is already lifetime-relative", () => {
    expect(
      isNewlyTradedSeries(
        "ALL",
        series(3, 1209600),
        1209600,
        NOW,
        NOW - 3 * 1209600,
      ),
    ).toBe(false);
  });
});

describe("formatPriceHistoryLabel", () => {
  it("keeps sub-dollar precision instead of rounding to $0.00", () => {
    expect(formatPriceHistoryLabel("0.158900")).toBe("$0.1589");
    expect(formatPriceHistoryLabel("0.29")).toBe("$0.29");
    expect(formatPriceHistoryLabel("0.1")).toBe("$0.10");
  });

  it("formats dollar-and-above prices as standard fiat", () => {
    expect(formatPriceHistoryLabel("1234.5")).toBe("$1,234.50");
  });

  it("keeps 2 significant digits below a cent so micro-priced tokens don't collapse to $0.00", () => {
    // A micro-priced Soroban token: high AND low both reading "$0.00" made
    // the chart unreadable and every delta "+$0.00".
    expect(formatPriceHistoryLabel("0.00001")).toBe("$0.000010");
    expect(formatPriceHistoryLabel("0.000123")).toBe("$0.00012");
    expect(formatPriceHistoryLabel("0.0099")).toBe("$0.0099");
  });

  it("keeps today's 2-decimal behavior from a cent upward", () => {
    expect(formatPriceHistoryLabel("0.01")).toBe("$0.01");
    expect(formatPriceHistoryLabel("1.5")).toBe("$1.50");
  });

  it("labels distinct micro prices distinctly (the high/low axis must differ)", () => {
    expect(formatPriceHistoryLabel("0.0000123")).not.toBe(
      formatPriceHistoryLabel("0.0000456"),
    );
  });

  it("keeps the sign in the text for negative values", () => {
    expect(formatPriceHistoryLabel("-0.00001")).toBe("-$0.000010");
  });

  it("renders exact zero as $0.00", () => {
    expect(formatPriceHistoryLabel("0")).toBe("$0.00");
  });
});

describe("formatPriceHistoryDelta", () => {
  it("signs positive deltas explicitly", () => {
    expect(formatPriceHistoryDelta("0.0602")).toBe("+$0.0602");
  });

  it("renders negative deltas with the sign before the dollar", () => {
    expect(formatPriceHistoryDelta("-0.5")).toBe("-$0.50");
  });

  it("displays the server's absolute value — never recomputed from percent", () => {
    expect(formatPriceHistoryDelta("0.001359")).toBe("+$0.0014");
  });

  it("keeps a micro-token's delta readable instead of '+$0.00'", () => {
    expect(formatPriceHistoryDelta("0.0000021")).toBe("+$0.0000021");
    expect(formatPriceHistoryDelta("-0.0000021")).toBe("-$0.0000021");
  });
});

describe("formatPriceHistoryRangeDelta", () => {
  // This exact string is a cross-platform contract: the extension composes
  // the same delta from the percent's MAGNITUDE, and the design draws
  // "+$0.0602 (32.12%)". Signing both halves would print "(+32.12%)" and
  // diverge from the design and the extension at the same time.
  it.each([
    [{ absolute: "0.0602", percent: "32.12" }, "+$0.0602 (32.12%)"],
    [{ absolute: "-0.1234", percent: "-45.60" }, "-$0.1234 (45.60%)"],
    [{ absolute: "0.001359", percent: "0.86" }, "+$0.0014 (0.86%)"],
  ])("formats %o as %s", (change, expected) => {
    expect(formatPriceHistoryRangeDelta(change)).toBe(expected);
  });

  it("still signs the dollar term when the percent rounds to zero", () => {
    // D8 rounds `percent` to 2dp, so a live absolute can arrive beside "0".
    // The sign is still carried once, by the dollar term, and the
    // parenthesised percent stays magnitude-only.
    const positive = formatPriceHistoryRangeDelta({
      absolute: "0.000019827880302",
      percent: "0",
    });
    expect(positive.startsWith("+$")).toBe(true);
    expect(positive.endsWith(" (0.00%)")).toBe(true);

    const negative = formatPriceHistoryRangeDelta({
      absolute: "-0.000019827880302",
      percent: "0",
    });
    expect(negative.startsWith("-$")).toBe(true);
    expect(negative.endsWith(" (0.00%)")).toBe(true);
  });

  it("shows the signed percentage alone when the absolute has no magnitude", () => {
    // A signed "$0.00" next to a live percentage claims a move the dollar
    // figure denies; the extension drops the dollar term here too.
    expect(
      formatPriceHistoryRangeDelta({ absolute: "0", percent: "0.05" }),
    ).toBe("+0.05%");
  });

  it("drops the dollar term when it rounds away at the printed precision", () => {
    // Non-zero on the wire, but past the label's decimal cap it prints as
    // "$0.00000000" — the same signed zero the extension drops.
    expect(
      formatPriceHistoryRangeDelta({ absolute: "0.000000001", percent: "1" }),
    ).toBe("+1.00%");
    expect(
      formatPriceHistoryRangeDelta({ absolute: "-0.000000001", percent: "-1" }),
    ).toBe("-1.00%");
  });
});

describe("getPriceChangeDirection", () => {
  it("reads the sign of the percent — three states, not two", () => {
    expect(getPriceChangeDirection("32.12")).toBe("positive");
    expect(getPriceChangeDirection("-12.12")).toBe("negative");
  });

  it("treats a flat change as neutral, NOT negative", () => {
    // The extension's getPriceDeltaColor maps 0 to its negative colour; this
    // delta must not inherit that bug — a flat range is not a loss.
    expect(getPriceChangeDirection("0")).toBe("neutral");
    expect(getPriceChangeDirection("0.00")).toBe("neutral");
    expect(getPriceChangeDirection("-0")).toBe("neutral");
    expect(getPriceChangeDirection(0)).toBe("neutral");
  });

  it("is neutral when there is no number at all", () => {
    // The §4.2 coverage guard (`change: null`) and the error state with
    // nothing to show both land here.
    expect(getPriceChangeDirection(null)).toBe("neutral");
    expect(getPriceChangeDirection(undefined)).toBe("neutral");
    expect(getPriceChangeDirection("not-a-number")).toBe("neutral");
  });

  it("falls back to the absolute when the percent rounds to zero", () => {
    // The backend rounds `percent` to 2dp so the 1D value equals
    // `percentagePriceChange24h` exactly (D8), so a real-but-tiny move
    // arrives as percent "0" beside a live absolute — USDC over 1D. The
    // dollar term is signed from that absolute, so the direction must come
    // from it too, or the text reads "+$0.0000198" in flat grey.
    expect(getPriceChangeDirection("0", "0.000019827880302")).toBe("positive");
    expect(getPriceChangeDirection("0", "-0.000019827880302")).toBe("negative");
    expect(getPriceChangeDirection("0.00", "0.0000072")).toBe("positive");
    expect(getPriceChangeDirection("-0", "-0.0000072")).toBe("negative");
  });

  it("keeps the percent authoritative wherever it has a sign", () => {
    // The absolute is only a fallback: a signed percent still decides, even
    // if the two disagree.
    expect(getPriceChangeDirection("32.12", "-0.0602")).toBe("positive");
    expect(getPriceChangeDirection("-12.12", "0.0602")).toBe("negative");
  });

  it("is neutral when neither half has a magnitude", () => {
    // Genuinely flat, and the coverage guard where there is no change at all.
    expect(getPriceChangeDirection("0", "0")).toBe("neutral");
    expect(getPriceChangeDirection("0", "-0")).toBe("neutral");
    expect(getPriceChangeDirection("0", undefined)).toBe("neutral");
    expect(getPriceChangeDirection(undefined, undefined)).toBe("neutral");
    expect(getPriceChangeDirection("0", "not-a-number")).toBe("neutral");
  });
});

describe("getPriceChangeColor", () => {
  const themeColors = getThemeColors("dark");

  it("maps the three directions onto the existing palette — no new colours", () => {
    expect(getPriceChangeColor("positive", themeColors)).toBe(
      themeColors.status.success,
    );
    expect(getPriceChangeColor("negative", themeColors)).toBe(
      themeColors.status.error,
    );
    expect(getPriceChangeColor("neutral", themeColors)).toBe(
      themeColors.text.secondary,
    );
  });

  it("uses the red-09 counterpart of the green already in use", () => {
    expect(getPriceChangeColor("negative", themeColors)).toBe("#e5484d");
    expect(getPriceChangeColor("positive", themeColors)).toBe("#30a46c");
  });
});

describe("easeOutCubic", () => {
  it("is the standard cubic ease-out, 1 - (1 - p)^3", () => {
    [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].forEach((p) => {
      expect(easeOutCubic(p)).toBeCloseTo(1 - (1 - p) ** 3, 12);
    });
  });

  it("pins both ends exactly, so a tween starts and settles where it should", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it("decelerates — most of the distance is covered early", () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    // Strictly increasing across the range.
    const samples = [0, 0.2, 0.4, 0.6, 0.8, 1].map(easeOutCubic);
    samples.forEach((value, index) => {
      if (index > 0) expect(value).toBeGreaterThan(samples[index - 1]);
    });
  });

  it("runs for the shared 250ms (DECISION 4)", () => {
    expect(CHART_MORPH_DURATION_MS).toBe(250);
  });
});

describe("interpolateChartCoordinates", () => {
  // Deliberately different point counts AND different x grids: the whole
  // point of the helper is that the two series never have to line up.
  const from: ChartCoordinate[] = [
    { x: 0, y: 100 },
    { x: 50, y: 0 },
    { x: 100, y: 50 },
  ];
  const to: ChartCoordinate[] = [
    { x: 0, y: 10 },
    { x: 25, y: 20 },
    { x: 75, y: 30 },
    { x: 150, y: 40 },
  ];

  it("settles EXACTLY on the incoming series at p = 1 — no float drift", () => {
    const frame = interpolateChartCoordinates({ from, to, progress: 1 });

    expect(frame).toEqual(to);
    // Not just deep-equal: identical numbers. `a + (b - a) * 1` is not exact
    // for every pair of floats, so the settled frame must come from an early
    // return, never from the lerp.
    frame.forEach((coord, index) => {
      expect(coord.x).toBe(to[index].x);
      expect(coord.y).toBe(to[index].y);
    });
  });

  it("settles exactly even where the lerp itself would drift", () => {
    const drifty = {
      from: [
        { x: 0, y: 0.1 },
        { x: 1, y: 0.1 },
      ],
      to: [
        { x: 0, y: 0.3 },
        { x: 1, y: 0.3 },
      ],
    };
    const frame = interpolateChartCoordinates({ ...drifty, progress: 1 });

    expect(frame[0].y).toBe(0.3);
    expect(frame[1].y).toBe(0.3);
  });

  it("starts from the outgoing shape sampled at the incoming x positions", () => {
    const frame = interpolateChartCoordinates({ from, to, progress: 0 });

    expect(frame).toEqual([
      // x = 0 → from[0] exactly
      { x: 0, y: 100 },
      // x = 25 → halfway between (0, 100) and (50, 0)
      { x: 25, y: 50 },
      // x = 75 → halfway between (50, 0) and (100, 50)
      { x: 75, y: 25 },
      // x = 150 → beyond `from`'s domain, so its last y is held
      { x: 150, y: 50 },
    ]);
  });

  it("clamps to the outgoing endpoints outside its x domain, at both ends", () => {
    const shifted: ChartCoordinate[] = [
      { x: -40, y: 7 },
      { x: 200, y: 9 },
    ];
    const frame = interpolateChartCoordinates({
      from: [
        { x: 0, y: 100 },
        { x: 100, y: 50 },
      ],
      to: shifted,
      progress: 0,
    });

    expect(frame).toEqual([
      { x: -40, y: 100 },
      { x: 200, y: 50 },
    ]);
  });

  it("lerps y linearly between the sampled start and the real target", () => {
    const frame = interpolateChartCoordinates({ from, to, progress: 0.5 });

    // Start ys are [100, 50, 25, 50]; targets are [10, 20, 30, 40].
    expect(frame).toEqual([
      { x: 0, y: 55 },
      { x: 25, y: 35 },
      { x: 75, y: 27.5 },
      { x: 150, y: 45 },
    ]);
  });

  it("always plots the incoming series' own x — never a resampled grid", () => {
    [0, 0.3, 0.7, 1].forEach((progress) => {
      const frame = interpolateChartCoordinates({ from, to, progress });

      expect(frame).toHaveLength(to.length);
      expect(frame.map((coord) => coord.x)).toEqual(to.map((coord) => coord.x));
    });
  });

  it("keeps x monotonic in every frame (the clock-skew guard is not regressed)", () => {
    // A `from` whose final x was clamped onto its predecessor — the shape the
    // monotonic clock-skew clamp produces.
    const clamped: ChartCoordinate[] = [
      { x: 0, y: 10 },
      { x: 60, y: 20 },
      { x: 60, y: 30 },
    ];

    [0, 0.25, 0.5, 0.75, 1].forEach((progress) => {
      const frame = interpolateChartCoordinates({
        from: clamped,
        to,
        progress,
      });

      frame.forEach((coord, index) => {
        if (index > 0) {
          expect(coord.x).toBeGreaterThanOrEqual(frame[index - 1].x);
        }
      });
    });
  });

  it("takes the later point's y across a zero-width bracket", () => {
    const clamped: ChartCoordinate[] = [
      { x: 0, y: 10 },
      { x: 60, y: 20 },
      { x: 60, y: 30 },
    ];
    const frame = interpolateChartCoordinates({
      from: clamped,
      to: [
        { x: 60, y: 0 },
        { x: 90, y: 0 },
      ],
      progress: 0,
    });

    expect(frame[0].y).toBe(30);
  });

  it("does not tween when either side has fewer than 2 points — no line to morph", () => {
    const single: ChartCoordinate[] = [{ x: 0, y: 0 }];

    expect(
      interpolateChartCoordinates({ from: single, to, progress: 0 }),
    ).toEqual(to);
    expect(interpolateChartCoordinates({ from: [], to, progress: 0 })).toEqual(
      to,
    );
    expect(
      interpolateChartCoordinates({ from, to: single, progress: 0 }),
    ).toEqual(single);
  });

  it("returns a copy, never the caller's array", () => {
    const frame = interpolateChartCoordinates({ from, to, progress: 1 });

    expect(frame).not.toBe(to);
  });

  it("clamps progress into [0, 1]", () => {
    expect(interpolateChartCoordinates({ from, to, progress: -0.5 })).toEqual(
      interpolateChartCoordinates({ from, to, progress: 0 }),
    );
    expect(interpolateChartCoordinates({ from, to, progress: 1.5 })).toEqual(
      to,
    );
  });

  it("morphs the real geometry two ranges produce, settling on the later one", () => {
    const size = { width: 300, height: 150 };
    const hourly = computeChartGeometry({
      points: Array.from({ length: 12 }, (_, i) => ({
        t: 1786636800 + i * 300,
        p: (0.2 + i * 0.001).toFixed(6),
      })),
      resolutionSeconds: 300,
      nowSeconds: 1786636800 + 12 * 300,
      ...size,
    });
    const daily = computeChartGeometry({
      points: Array.from({ length: 5 }, (_, i) => ({
        t: 1786550400 + i * 21600,
        p: (0.18 + i * 0.004).toFixed(6),
      })),
      resolutionSeconds: 21600,
      nowSeconds: 1786636800,
      ...size,
    });

    expect(hourly).not.toBeNull();
    expect(daily).not.toBeNull();

    const settled = interpolateChartCoordinates({
      from: hourly!.coords,
      to: daily!.coords,
      progress: 1,
    });

    // The settled chart is byte-identical to what a hard switch would draw:
    // §7.0 ("exactly the points array") governs the settled state.
    expect(settled).toEqual(daily!.coords);
  });
});

describe("formatInspectedTimestamp", () => {
  // Built in local time, so the device-zone formatting reads back 4:03.
  const unixSeconds = new Date(2026, 8, 21, 4, 3).getTime() / 1000;

  it("gives an intraday point a weekday date and a lower-case time", () => {
    const { date, time } = formatInspectedTimestamp({
      unixSeconds,
      range: "1D",
      locale: "en",
    });

    expect(date).toBe("Mon, Sep 21");
    expect(time).toMatch(/^4:03\sam$/u);
  });

  it("times a 1H point too", () => {
    expect(
      formatInspectedTimestamp({ unixSeconds, range: "1H", locale: "en" }).time,
    ).toMatch(/^4:03\sam$/u);
  });

  it("dates a 1W point without a time or a year", () => {
    expect(
      formatInspectedTimestamp({ unixSeconds, range: "1W", locale: "en" }),
    ).toEqual({ date: "Mon, Sep 21" });
  });

  it.each(["1Y", "ALL"] as const)(
    "adds the year and drops the time on %s",
    (range) => {
      expect(
        formatInspectedTimestamp({ unixSeconds, range, locale: "en" }),
      ).toEqual({ date: "Mon, Sep 21, 2026" });
    },
  );

  it("formats in the given locale", () => {
    const { date } = formatInspectedTimestamp({
      unixSeconds,
      range: "1W",
      locale: "pt",
    });

    expect(date).toBe(
      new Intl.DateTimeFormat("pt", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date(unixSeconds * 1000)),
    );
    expect(date).not.toBe("Mon, Sep 21");
  });
});
