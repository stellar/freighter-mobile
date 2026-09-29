import { act, fireEvent, renderHook } from "@testing-library/react-native";
import TokenPriceChart, {
  buildChartFillPath,
  buildChartLinePath,
  axisLabelWidth,
  clampAxisLabelX,
  END_DOT_RADIUS,
  priceChartHeight,
  priceChartLabelHeight,
  PRICE_CHART_LINE_HEIGHT,
  INSPECT_GESTURE_TEST_ID,
  INSPECT_LONG_PRESS_MS,
} from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceChart";
import { TEXT_SIZES } from "components/sds/Typography";
import { getThemeColors } from "config/colors";
import { fsValue } from "helpers/dimensions";
import {
  CHART_MORPH_DURATION_MS,
  computeChartGeometry,
  formatInspectedTimestamp,
  interpolateChartCoordinates,
  PriceChangeDirection,
} from "helpers/priceHistoryChart";
import {
  findAllRenderedByType,
  RenderedTree,
  renderWithProviders,
} from "helpers/testUtils";
import React from "react";
import {
  AccessibilityInfo,
  DeviceEventEmitter,
  Dimensions,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { State, PanGesture } from "react-native-gesture-handler";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";

// `useColorScheme` reports "light" under the react-native jest preset, so the
// component resolves its palette through the light theme. The two status
// colours are the same hex in both themes; only neutral differs.
const themeColors = getThemeColors("light");

const points = Array.from({ length: 12 }, (_, i) => ({
  t: 1786636800 + i * 900,
  p: (0.2 - i * 0.001).toFixed(6),
}));

/**
 * The chart's paint props. Skia's `<Path>`/`<Circle>` render as host nodes
 * that take no testID, so the artwork is read off the render tree.
 */
const artworkColors = (tree: RenderedTree) => {
  const skPaths = findAllRenderedByType(tree, "skPath");

  return {
    line: skPaths.find((node) => node.props.style === "stroke")?.props.color,
    gradient: findAllRenderedByType(tree, "skLinearGradient")[0]?.props.colors,
    dot: findAllRenderedByType(tree, "skCircle")[0]?.props.color,
  };
};

const renderChart = (direction: PriceChangeDirection) =>
  renderWithProviders(
    <TokenPriceChart
      testID="chart"
      points={points}
      resolutionSeconds={900}
      range="1D"
      width={300}
      direction={direction}
    />,
  );

describe("TokenPriceChart artwork colour", () => {
  it("draws a negative range in red — line, end dot and gradient fill", () => {
    const { toJSON } = renderChart("negative");

    const { line, gradient, dot } = artworkColors(toJSON());
    expect(line).toBe(themeColors.status.error);
    expect(dot).toBe(themeColors.status.error);
    // The fill is the same colour faded out, exactly as the green one was.
    expect(gradient).toEqual([
      `${themeColors.status.error}4D`,
      `${themeColors.status.error}00`,
    ]);
  });

  it("still draws a positive range in green", () => {
    const { toJSON } = renderChart("positive");

    const { line, gradient, dot } = artworkColors(toJSON());
    expect(line).toBe(themeColors.status.success);
    expect(dot).toBe(themeColors.status.success);
    expect(gradient).toEqual([
      `${themeColors.status.success}4D`,
      `${themeColors.status.success}00`,
    ]);
  });

  it("draws a neutral range in neither green nor red", () => {
    const { toJSON } = renderChart("neutral");

    const { line, gradient, dot } = artworkColors(toJSON());
    expect(line).toBe(themeColors.text.secondary);
    expect(dot).toBe(themeColors.text.secondary);
    expect(gradient).toEqual([
      `${themeColors.text.secondary}4D`,
      `${themeColors.text.secondary}00`,
    ]);
  });

  it("paints the whole artwork one colour — no half-red chart", () => {
    const { toJSON } = renderChart("negative");

    const { line, dot, gradient } = artworkColors(toJSON());
    expect(new Set([line, dot])).toEqual(new Set([themeColors.status.error]));
    (gradient as string[]).forEach((stop) => {
      expect(stop.startsWith(themeColors.status.error)).toBe(true);
    });
  });
});

/**
 * A different range's series: a coarser resolution over a longer window, so
 * its geometry has a different point COUNT and a completely different x grid
 * from `points` above — exactly the case the morph has to handle without
 * resampling either side.
 */
const coarsePoints = Array.from({ length: 7 }, (_, i) => ({
  t: 1786550400 + i * 14_400,
  p: (0.17 + i * 0.003).toFixed(6),
}));

/**
 * A third series on the SAME timestamps as `coarsePoints` — same x grid,
 * different prices. Sharing the grid is what makes the interruption test
 * exact: sampling a shape at the very x positions it already has returns that
 * shape unchanged, so "resumed from what was on screen" becomes a string
 * comparison rather than an approximation.
 */
const coarsePointsHigher = coarsePoints.map((point, i) => ({
  t: point.t,
  p: (0.19 + i * 0.001).toFixed(6),
}));

const CHART_WIDTH = 300;

const geometryFor = (
  series: typeof points,
  resolutionSeconds: number,
  width = CHART_WIDTH,
) =>
  computeChartGeometry({
    points: series,
    resolutionSeconds,
    nowSeconds: Math.floor(Date.now() / 1000),
    width,
    height: PRICE_CHART_LINE_HEIGHT,
  })!;

/** The animated stroke path's CURRENT value, as Skia would paint it. */
const linePathValue = (tree: RenderedTree): string => {
  const stroke = findAllRenderedByType(tree, "skPath").find(
    (node) => node.props.style === "stroke",
  );
  const path = stroke!.props.path as string | { value: string };

  return typeof path === "string" ? path : path.value;
};

/** The react-native preset already mocks AccessibilityInfo with jest.fn()s. */
const isReduceMotionEnabled =
  AccessibilityInfo.isReduceMotionEnabled as jest.Mock;

/**
 * Runs the animation forward and lets everything it queues land: Reanimated
 * drives its frames off timers here, and the tween's completion callback hops
 * back to the JS thread.
 */
const settle = async (elapsedMs = 0) => {
  await act(async () => {
    jest.advanceTimersByTime(elapsedMs);
    await Promise.resolve();
  });
};

describe("TokenPriceChart timeframe morph", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    isReduceMotionEnabled.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderMorphable = async (
    series = points,
    resolutionSeconds = 900,
    width = CHART_WIDTH,
  ) => {
    const utils = renderWithProviders(
      <TokenPriceChart
        testID="chart"
        points={series}
        resolutionSeconds={resolutionSeconds}
        range="1D"
        width={width}
        direction="positive"
      />,
    );
    // Let the reduced-motion query settle before anything switches.
    await settle();

    return utils;
  };

  const switchTo = async (
    rerender: (element: React.ReactElement) => void,
    series: typeof points,
    resolutionSeconds: number,
    direction: PriceChangeDirection = "positive",
    width = CHART_WIDTH,
  ) => {
    await act(async () => {
      rerender(
        <TokenPriceChart
          testID="chart"
          points={series}
          resolutionSeconds={resolutionSeconds}
          range="1D"
          width={width}
          direction={direction}
        />,
      );
      await Promise.resolve();
    });
  };

  it("paints the settled geometry on the very first frame — nothing to morph from", async () => {
    const { toJSON } = await renderMorphable();

    expect(linePathValue(toJSON())).toBe(
      buildChartLinePath(geometryFor(points, 900).coords),
    );
  });

  it("starts the tween from the outgoing shape, not from the incoming one", async () => {
    const { toJSON, rerender } = await renderMorphable();

    await switchTo(rerender, coarsePoints, 14_400);

    // The outgoing line, sampled at the INCOMING series' x positions — no
    // hard cut, and no resampled compromise grid either.
    expect(linePathValue(toJSON())).toBe(
      buildChartLinePath(
        interpolateChartCoordinates({
          from: geometryFor(points, 900).coords,
          to: geometryFor(coarsePoints, 14_400).coords,
          progress: 0,
        }),
      ),
    );
  });

  it("settles EXACTLY on the incoming series' real geometry", async () => {
    const { toJSON, rerender } = await renderMorphable();
    const settled = buildChartLinePath(
      geometryFor(coarsePoints, 14_400).coords,
    );

    await switchTo(rerender, coarsePoints, 14_400);
    expect(linePathValue(toJSON())).not.toBe(settled);

    await settle(CHART_MORPH_DURATION_MS);

    expect(linePathValue(toJSON())).toBe(settled);
  });

  it("keeps x monotonic through the tween — the clock-skew guard is not regressed", async () => {
    const { toJSON, rerender } = await renderMorphable();

    await switchTo(rerender, coarsePoints, 14_400);

    const frames: string[] = [];
    for (let elapsed = 0; elapsed <= CHART_MORPH_DURATION_MS; elapsed += 50) {
      frames.push(linePathValue(toJSON()));
      // eslint-disable-next-line no-await-in-loop
      await settle(50);
    }

    frames.forEach((frame) => {
      const xs = frame
        .split(" ")
        .filter((token) => token.startsWith("M") || token.startsWith("L"))
        .map((token) => Number(token.slice(1)));

      xs.slice(1).forEach((x, index) => {
        expect(x).toBeGreaterThanOrEqual(xs[index]);
      });
    });
  });

  it("resumes an interrupted tween from what is on screen, never snapping back", async () => {
    const { toJSON, rerender } = await renderMorphable();

    await switchTo(rerender, coarsePoints, 14_400);
    await settle(100);

    const displayed = linePathValue(toJSON());
    // Mid-tween: neither endpoint of the first morph.
    expect(displayed).not.toBe(
      buildChartLinePath(geometryFor(points, 900).coords),
    );
    expect(displayed).not.toBe(
      buildChartLinePath(geometryFor(coarsePoints, 14_400).coords),
    );

    await switchTo(rerender, coarsePointsHigher, 14_400);

    // The third series shares the second's x grid, so a tween that resumes
    // from the displayed shape paints that exact shape on its first frame.
    expect(linePathValue(toJSON())).toBe(displayed);
    // And emphatically NOT a restart from the original outgoing series.
    expect(linePathValue(toJSON())).not.toBe(
      buildChartLinePath(
        interpolateChartCoordinates({
          from: geometryFor(points, 900).coords,
          to: geometryFor(coarsePointsHigher, 14_400).coords,
          progress: 0,
        }),
      ),
    );

    await settle(CHART_MORPH_DURATION_MS);

    expect(linePathValue(toJSON())).toBe(
      buildChartLinePath(geometryFor(coarsePointsHigher, 14_400).coords),
    );
  });

  it("hard-switches when reduced motion is on — the settled geometry, immediately", async () => {
    isReduceMotionEnabled.mockResolvedValue(true);

    const { toJSON, rerender } = await renderMorphable();

    await switchTo(rerender, coarsePoints, 14_400);

    expect(linePathValue(toJSON())).toBe(
      buildChartLinePath(geometryFor(coarsePoints, 14_400).coords),
    );
  });

  it("does not animate a re-layout — a new measured width snaps", async () => {
    const { toJSON, rerender } = await renderMorphable();

    await switchTo(rerender, points, 900, "positive", 420);

    expect(linePathValue(toJSON())).toBe(
      buildChartLinePath(geometryFor(points, 900, 420).coords),
    );
  });

  it("updates the direction colour immediately, without staggering it behind the line", async () => {
    const { toJSON, rerender } = await renderMorphable();

    await switchTo(rerender, coarsePoints, 14_400, "negative");

    // DECISION 6: only the geometry tweens.
    expect(artworkColors(toJSON()).line).toBe(themeColors.status.error);
    expect(linePathValue(toJSON())).not.toBe(
      buildChartLinePath(geometryFor(coarsePoints, 14_400).coords),
    );
  });
});

describe("end dot", () => {
  it("sits on the last plotted point, not a radius short of it", () => {
    const { toJSON } = renderChart("positive");
    const tree = toJSON() as RenderedTree;
    const last = geometryFor(points, 900).coords.at(-1)!;
    const dot = findAllRenderedByType(tree, "skCircle")[0];

    // The last point plots at exactly `width`; on a dense range the previous
    // point is under a radius away, so any inward shift reads as the dot
    // marking the wrong bucket.
    expect(dot.props.cx).toBe(last.x);
    expect(dot.props.cy).toBe(last.y);
  });

  it("widens the canvas by the dot's radius so the dot on the edge draws whole", () => {
    const { toJSON } = renderChart("positive");
    const tree = toJSON() as RenderedTree;
    // Skia's Canvas mocks as a View; it is the one sized to the line height.
    const styleOf = (node: { props: Record<string, unknown> }) =>
      node.props.style as { width?: number; height?: number } | undefined;
    const canvas = findAllRenderedByType(tree, "View").find(
      (node) => styleOf(node)?.height === PRICE_CHART_LINE_HEIGHT,
    );

    expect(canvas && styleOf(canvas)?.width).toBe(CHART_WIDTH + END_DOT_RADIUS);
  });
});

describe("TokenPriceChart with too few points to plot", () => {
  it("renders nothing rather than throwing", async () => {
    // `computeChartGeometry` returns null below two points, so the component
    // bails — but the artwork memo runs first, during render, on an empty
    // coordinate list. It must not dereference a last point that is not there.
    //
    // Awaited so the reduce-motion query's setState lands inside `act`;
    // rendering bare leaves it outside and warns.
    expect(() =>
      renderWithProviders(
        <TokenPriceChart
          testID="chart"
          points={[{ t: 1786636800, p: "0.1589" }]}
          resolutionSeconds={900}
          range="1D"
          width={300}
          direction="positive"
        />,
      ),
    ).not.toThrow();

    // Flushed after rendering, not around it: the reduce-motion query's
    // setState lands on the next microtask, and wrapping the render itself
    // lets cleanup run mid-assertion.
    await act(async () => {
      await Promise.resolve();
    });
  });
});

describe("chart block geometry", () => {
  it("sizes the axis-label row from the type it holds, not a fixed 20pt", () => {
    // The row is exactly the line height the label renders at, whatever the
    // device and text size resolve that to. Asserting a number instead —
    // "> 20", say — would only be true on devices at or above the reference,
    // and under jest `fsValue` is mocked to the identity, so such an
    // assertion would be checking the mock rather than the formula.
    expect(priceChartLabelHeight(1)).toBe(fsValue(TEXT_SIZES.sm.lineHeight));
    expect(priceChartLabelHeight(2)).toBe(
      fsValue(TEXT_SIZES.sm.lineHeight) * 2,
    );
  });

  it("grows the whole block with the text, so the ghost still matches", () => {
    // The skeleton, the ghost and the real chart all read this. If it stopped
    // tracking the label rows, swapping the placeholder for the chart would
    // shift the selector below it.
    const atDefault = priceChartHeight(1);
    const atLargeText = priceChartHeight(2);

    expect(atLargeText - atDefault).toBe(priceChartLabelHeight(1) * 2);
    expect(atDefault).toBe(
      PRICE_CHART_LINE_HEIGHT + priceChartLabelHeight(1) * 2,
    );
  });
});

describe("clampAxisLabelX", () => {
  const WIDTH = 320;
  const LABEL = 54;

  it("centres the label on its point where there is room", () => {
    expect(clampAxisLabelX(WIDTH / 2, WIDTH, LABEL)).toBe(
      WIDTH / 2 - LABEL / 2,
    );
  });

  it("moves continuously as the extreme approaches an edge", () => {
    // The previous revision clamped a fixed-width RESERVE and then picked one
    // of three alignments from which branch fired. That saturates across a
    // band half the reserve wide, so a label anywhere inside it was drawn at
    // the chart edge — and jumped tens of points as the extreme crossed the
    // boundary. With the real width the offset tracks the point smoothly.
    const near = clampAxisLabelX(LABEL / 2 + 1, WIDTH, LABEL);
    const nearer = clampAxisLabelX(LABEL / 2 + 2, WIDTH, LABEL);

    expect(nearer - near).toBe(1);
  });

  it("never lets the label hang over either edge", () => {
    expect(clampAxisLabelX(0, WIDTH, LABEL)).toBe(0);
    expect(clampAxisLabelX(WIDTH, WIDTH, LABEL)).toBe(WIDTH - LABEL);
  });

  it("collapses to the left edge for a label wider than the chart", () => {
    expect(clampAxisLabelX(WIDTH / 2, WIDTH, WIDTH + 40)).toBe(0);
  });
});

describe("axisLabelWidth", () => {
  it("never reserves more room than the chart has", () => {
    expect(axisLabelWidth(80, 3)).toBe(80);
  });
});

describe("axis label placement uses the live text scale", () => {
  it("clamps the high label against a reserve that grew with the text", () => {
    // The pure clamp being right is not enough — the component has to hand it
    // the live scale. A literal 1 there reserves half the room the rendered
    // label needs and pushes it off the chart's right edge, with the clamp's
    // own unit tests still green because they call the function directly.
    const width = 300;
    // Strictly rising, so the max is the LAST point and plots at exactly
    // `width` — the position the clamp exists for, and the one a rising token
    // always produces.
    const rising = Array.from({ length: 8 }, (_, i) => ({
      t: 1786636800 + i * 900,
      p: (0.15 + i * 0.01).toFixed(6),
    }));
    const { fontScale } = renderHook(() => useWindowDimensions()).result
      .current;
    const { getByTestId } = renderWithProviders(
      <TokenPriceChart
        testID="chart"
        points={rising}
        resolutionSeconds={900}
        range="1D"
        width={width}
        direction="positive"
      />,
    );

    const { left } = StyleSheet.flatten(
      getByTestId("price-history-chart-label-high").props.style,
    ) as { left: number };

    expect(Number.isFinite(fontScale)).toBe(true);
    // Before the first layout the width is unknown, so the reserve stands in.
    expect(left).toBe(
      clampAxisLabelX(width, width, axisLabelWidth(width, fontScale)),
    );

    // Clipped rather than wrapped. The box fits every plausible price, so
    // this only fires on an absurd one — but there a second line lands over
    // the plot, and a clipped price is the lesser failure.
    expect(
      getByTestId("price-history-chart-label-high").props.numberOfLines,
    ).toBe(1);
    expect(
      getByTestId("price-history-chart-label-low").props.numberOfLines,
    ).toBe(1);
  });
});

describe("axis labels reposition once they have been measured", () => {
  it("uses the measured width, not the reserve, after first layout", () => {
    // The reserve is only a stand-in for the first frame. If the measurement
    // never reaches the position, every label stays clamped as though it were
    // as wide as the longest possible price — which is the band problem the
    // measured model exists to remove.
    const width = 300;
    const rising = Array.from({ length: 8 }, (_, i) => ({
      t: 1786636800 + i * 900,
      p: (0.15 + i * 0.01).toFixed(6),
    }));
    const { fontScale } = renderHook(() => useWindowDimensions()).result
      .current;
    const { getByTestId } = renderWithProviders(
      <TokenPriceChart
        testID="chart"
        points={rising}
        resolutionSeconds={900}
        range="1D"
        width={width}
        direction="positive"
      />,
    );

    const label = () => getByTestId("price-history-chart-label-high");
    const styleOf = () =>
      StyleSheet.flatten(label().props.style) as {
        left: number;
        opacity: number;
      };
    const leftOf = () => styleOf().left;

    expect(leftOf()).toBe(
      clampAxisLabelX(width, width, axisLabelWidth(width, fontScale)),
    );
    // Hidden while the position is still a guess: drawing with the reserve
    // puts the label tens of points from its point for that frame.
    expect(styleOf().opacity).toBe(0);

    const measured = 54;
    fireEvent(label(), "layout", {
      nativeEvent: { layout: { width: measured, height: 20, x: 0, y: 0 } },
    });

    // The max plots at exactly `width`, so a narrower label sits further
    // right than the reserve allowed — right up against its own point.
    expect(leftOf()).toBe(clampAxisLabelX(width, width, measured));
    expect(leftOf()).toBe(width - measured);
    expect(styleOf().opacity).toBe(1);
  });
});

describe("axis label measurements do not outlive their text", () => {
  it("ignores a measurement taken from a different price", () => {
    // `labelWidths` is keyed high/low, so a range switch reuses the key with
    // new text. Positioning 1Y's `$1,234.56` with 1D's `$0.1589` measurement
    // would overhang the chart for a frame, which is the stale-width case the
    // tag exists to prevent.
    const width = 300;
    const rising = Array.from({ length: 8 }, (_, i) => ({
      t: 1786636800 + i * 900,
      p: (0.15 + i * 0.01).toFixed(6),
    }));
    const { getByTestId, rerender } = renderWithProviders(
      <TokenPriceChart
        testID="chart"
        points={rising}
        resolutionSeconds={900}
        range="1D"
        width={width}
        direction="positive"
      />,
    );

    const label = () => getByTestId("price-history-chart-label-high");
    const styleOf = () =>
      StyleSheet.flatten(label().props.style) as {
        left: number;
        opacity: number;
      };

    fireEvent(label(), "layout", {
      nativeEvent: { layout: { width: 54, height: 20, x: 0, y: 0 } },
    });
    expect(styleOf().opacity).toBe(1);

    // A different series, so a different maximum and a different label.
    const higher = rising.map((point, i) => ({
      ...point,
      p: (1234.5 + i).toFixed(6),
    }));
    rerender(
      <TokenPriceChart
        testID="chart"
        points={higher}
        resolutionSeconds={900}
        range="1D"
        width={width}
        direction="positive"
      />,
    );

    // Back to hidden: the stored measurement describes the old text.
    expect(styleOf().opacity).toBe(0);
  });
});

describe("axis label measurements survive their own edge cases", () => {
  const WIDTH = 300;
  const seriesAt = (base: number) =>
    Array.from({ length: 8 }, (_, i) => ({
      t: 1786636800 + i * 900,
      p: (base + i * 0.01).toFixed(6),
    }));

  // Restored in `afterAll`, not inline: a failed assertion aborts the body,
  // and an un-restored window cascades into every test appended after this
  // one. Same hazard `TokenPriceChartGhost.test.tsx` guards against.
  let original: {
    window: ReturnType<typeof Dimensions.get>;
    screen: ReturnType<typeof Dimensions.get>;
  };

  beforeAll(() => {
    original = {
      window: Dimensions.get("window"),
      screen: Dimensions.get("screen"),
    };
  });

  afterAll(() => {
    Dimensions.set(original);
  });

  const renderAt = (series: ReturnType<typeof seriesAt>) =>
    renderWithProviders(
      <TokenPriceChart
        testID="chart"
        points={series}
        resolutionSeconds={900}
        range="1D"
        width={WIDTH}
        direction="positive"
      />,
    );

  // NOT covered: the `key` on each label, which forces a remount when the
  // price changes so React Native is guaranteed to emit `onLayout`. Its whole
  // purpose is the on-device case where a new price lands on byte-identical
  // layout metrics and the event would otherwise be suppressed — jest never
  // emits `onLayout` on its own, so there is no difference here to observe,
  // and an element's key is not readable from the rendered tree.

  it("discards a measurement when the text scale changes under it", () => {
    // The rendered width is text x scale, so a tag on the text alone stays
    // matching through a font-size change and paints a stale width visibly.
    const { getByTestId } = renderAt(seriesAt(0.15));
    const label = () => getByTestId("price-history-chart-label-high");
    const opacityOf = () =>
      (StyleSheet.flatten(label().props.style) as { opacity: number }).opacity;

    fireEvent(label(), "layout", {
      nativeEvent: { layout: { width: 54, height: 20, x: 0, y: 0 } },
    });
    expect(opacityOf()).toBe(1);

    act(() => {
      const larger = {
        ...original.window,
        fontScale: original.window.fontScale + 1,
      };
      Dimensions.set({ window: larger, screen: original.screen });
    });

    expect(opacityOf()).toBe(0);
  });
});

describe("drag to inspect", () => {
  // RNTL skips a11y-hidden nodes by default; the timestamp is one.
  const HIDDEN = { includeHiddenElements: true };
  const width = 300;
  // 4 points spanning the width: bucket ends at 900, 1800, 2700, 3600 → x 0, 100, 200, 300
  const inspectPoints = [
    { t: 0, p: "1.00" },
    { t: 900, p: "1.10" },
    { t: 1800, p: "1.05" },
    { t: 2700, p: "1.20" },
  ];
  const renderInspectable = (
    props: Partial<React.ComponentProps<typeof TokenPriceChart>> = {},
  ) =>
    renderWithProviders(
      <TokenPriceChart
        testID="price-history-chart"
        points={inspectPoints}
        resolutionSeconds={900}
        range="1D"
        width={width}
        direction="positive"
        {...props}
      />,
    );

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(1_000_000 * 1000);
  });
  afterEach(() => jest.restoreAllMocks());

  it("arms the Pan gesture with the long-press duration, not an immediate drag", () => {
    renderInspectable();

    expect(
      getByGestureTestId(INSPECT_GESTURE_TEST_ID).config.activateAfterLongPress,
    ).toBe(INSPECT_LONG_PRESS_MS);
  });

  it("limits the Pan gesture to a single pointer", () => {
    renderInspectable();

    expect(getByGestureTestId(INSPECT_GESTURE_TEST_ID).config.maxPointers).toBe(
      1,
    );
  });

  it("reports the SNAPPED index on start and on every move, then ends", () => {
    const onInspectStart = jest.fn();
    const onInspectMove = jest.fn();
    const onInspectEnd = jest.fn();
    renderInspectable({ onInspectStart, onInspectMove, onInspectEnd });

    fireGestureHandler<PanGesture>(
      getByGestureTestId(INSPECT_GESTURE_TEST_ID),
      [
        { state: State.BEGAN, x: 40 },
        { state: State.ACTIVE, x: 40 },
        { x: 160 },
        { x: 999 },
        { state: State.END },
      ],
    );

    expect(onInspectStart).toHaveBeenCalledTimes(1);
    expect(onInspectStart).toHaveBeenCalledWith(0);
    expect(onInspectMove.mock.calls.map(([i]) => i)).toEqual([2, 3]);
    expect(onInspectEnd).toHaveBeenCalledTimes(1);
  });

  it("ends when the gesture is cancelled", () => {
    const onInspectEnd = jest.fn();
    renderInspectable({ onInspectEnd });
    fireGestureHandler<PanGesture>(
      getByGestureTestId(INSPECT_GESTURE_TEST_ID),
      [
        { state: State.BEGAN, x: 40 },
        { state: State.ACTIVE, x: 40 },
        { state: State.CANCELLED },
      ],
    );
    expect(onInspectEnd).toHaveBeenCalledTimes(1);
  });

  const timestampFor = (
    unixSeconds: number,
    range: React.ComponentProps<typeof TokenPriceChart>["range"] = "1D",
  ) => {
    const { date, time } = formatInspectedTimestamp({
      unixSeconds,
      range,
      locale: "en",
    });

    return time ? `${date} at ${time}` : date;
  };

  it("draws the guide and the dot at the inspected point and hides the end dot", () => {
    const { toJSON } = renderInspectable({ inspectedIndex: 1 });
    const tree = toJSON() as RenderedTree;
    const circles = findAllRenderedByType(tree, "skCircle");
    // ring + dot at x=100; no end dot at x=300
    expect(circles.map((c) => c.props.cx)).toEqual([100, 100]);
    expect(findAllRenderedByType(tree, "skLine")).toHaveLength(1);
    expect(findAllRenderedByType(tree, "skDashPathEffect")).toHaveLength(1);
  });

  it("shows the point's plotted time in the high-label row instead of the high and low prices", () => {
    const { fontScale } = renderHook(() => useWindowDimensions()).result
      .current;
    const { getByTestId, queryByTestId } = renderInspectable({
      inspectedIndex: 1,
    });

    const row = getByTestId("price-history-chart-label-row-high", HIDDEN);
    const timestamp = getByTestId("price-history-inspect-timestamp", HIDDEN);
    // Bucket end, not bucket start: point 1 starts at 900 and plots at 1800.
    expect(timestamp).toHaveTextContent(timestampFor(1800));
    expect(row).toContainElement(timestamp);
    expect(queryByTestId("price-history-chart-label-high", HIDDEN)).toBeNull();
    expect(queryByTestId("price-history-chart-label-low", HIDDEN)).toBeNull();
    expect(queryByTestId("price-history-inspect-tooltip", HIDDEN)).toBeNull();
    // The rows keep their height, so nothing below the chart moves.
    expect(
      getByTestId("price-history-chart-label-row-low", HIDDEN),
    ).toHaveStyle({ height: priceChartLabelHeight(fontScale) });
  });

  it("times the last point at now, where the chart plots it", () => {
    jest.spyOn(Date, "now").mockReturnValue(3000 * 1000);
    const { getByTestId } = renderInspectable({ inspectedIndex: 3 });

    expect(
      getByTestId("price-history-inspect-timestamp", HIDDEN),
    ).toHaveTextContent(timestampFor(3000));
  });

  it("dates a 1Y point with its year and no time", () => {
    const { getByTestId } = renderInspectable({
      inspectedIndex: 1,
      range: "1Y",
    });
    const text = timestampFor(1800, "1Y");

    expect(text).not.toContain(" at ");
    expect(
      getByTestId("price-history-inspect-timestamp", HIDDEN),
    ).toHaveTextContent(text);
  });

  it("centres the timestamp on the guide once measured, clamped inside the chart", () => {
    const { fontScale } = renderHook(() => useWindowDimensions()).result
      .current;
    const styleOf = (utils: ReturnType<typeof renderInspectable>) =>
      StyleSheet.flatten(
        utils.getByTestId("price-history-inspect-timestamp", HIDDEN).props
          .style,
      );
    const measure = (utils: ReturnType<typeof renderInspectable>) =>
      fireEvent(
        utils.getByTestId("price-history-inspect-timestamp", HIDDEN),
        "layout",
        { nativeEvent: { layout: { width: 90, height: 16, x: 0, y: 0 } } },
      );

    const middle = renderInspectable({ inspectedIndex: 1 }); // x = 100
    expect(styleOf(middle)).toMatchObject({
      left: clampAxisLabelX(100, width, axisLabelWidth(width, fontScale)),
      opacity: 0,
    });
    measure(middle);
    expect(styleOf(middle)).toMatchObject({ left: 100 - 45, opacity: 1 });
    middle.unmount();

    const edge = renderInspectable({ inspectedIndex: 3 }); // x = 300
    measure(edge);
    expect(styleOf(edge)).toMatchObject({ left: width - 90, opacity: 1 });
  });

  it("draws the timestamp in the foreground colour and hides it from assistive tech", () => {
    const { getByTestId, getByText } = renderInspectable({
      inspectedIndex: 1,
    });

    expect(
      getByTestId("price-history-inspect-timestamp", HIDDEN).props,
    ).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: "no-hide-descendants",
    });
    expect(getByText(timestampFor(1800), HIDDEN)).toHaveStyle({
      color: themeColors.foreground.primary,
    });
  });

  it("draws nothing extra and keeps the end dot and price labels when not inspecting", () => {
    const { toJSON, getByTestId, queryByTestId } = renderInspectable({
      inspectedIndex: null,
    });
    const tree = toJSON() as RenderedTree;
    expect(findAllRenderedByType(tree, "skCircle")).toHaveLength(1);
    expect(findAllRenderedByType(tree, "skLine")).toHaveLength(0);
    expect(queryByTestId("price-history-inspect-timestamp", HIDDEN)).toBeNull();
    expect(getByTestId("price-history-chart-label-high", HIDDEN)).toBeTruthy();
    expect(getByTestId("price-history-chart-label-low", HIDDEN)).toBeTruthy();
  });

  const pathsByStyle = (tree: RenderedTree, style: "stroke" | "fill") =>
    findAllRenderedByType(tree, "skPath")
      .filter((node) => node.props.style === style)
      .map((node) => ({ path: node.props.path, opacity: node.props.opacity }));

  it("dims the line and the fill beyond the inspected point, split at that point", () => {
    const { coords } = geometryFor(inspectPoints, 900, width);
    const { toJSON } = renderInspectable({ inspectedIndex: 1 });
    const tree = toJSON() as RenderedTree;

    expect(pathsByStyle(tree, "stroke")).toEqual([
      { path: buildChartLinePath(coords.slice(0, 2)), opacity: undefined },
      { path: buildChartLinePath(coords.slice(1)), opacity: 0.3 },
    ]);
    expect(pathsByStyle(tree, "fill")).toEqual([
      { path: buildChartFillPath(coords.slice(0, 2)), opacity: undefined },
      { path: buildChartFillPath(coords.slice(1)), opacity: 0.3 },
    ]);
  });

  it("draws one undimmed line and fill when not inspecting", () => {
    const { coords } = geometryFor(inspectPoints, 900, width);
    const { toJSON } = renderInspectable({ inspectedIndex: null });
    const tree = toJSON() as RenderedTree;

    expect(pathsByStyle(tree, "stroke")).toEqual([
      { path: buildChartLinePath(coords), opacity: undefined },
    ]);
    expect(pathsByStyle(tree, "fill")).toEqual([
      { path: buildChartFillPath(coords), opacity: undefined },
    ]);
  });

  /**
   * Drives RNGH's own event pipeline — the one `fireGestureHandler` emits on —
   * a single state change at a time.
   *
   * `fireGestureHandler` cannot express a gesture that is still running: its
   * `fillMissingStatesTransitions` always appends a terminal END to whatever
   * it is given, so there is no event list that leaves the handler ACTIVE.
   * Emitting the state changes directly is the same path, minus that sugar.
   */
  const emitStateChange = (
    handlerTag: number,
    event: { oldState: State; state: State; x?: number },
  ) =>
    DeviceEventEmitter.emit("onGestureHandlerStateChange", {
      handlerTag,
      numberOfPointers: 1,
      y: 0,
      absoluteX: event.x ?? 40,
      absoluteY: 0,
      translationX: 0,
      translationY: 0,
      velocityX: 0,
      velocityY: 0,
      x: 40,
      ...event,
    });

  it("ends an inspect the chart is unmounted out of", () => {
    const onInspectEnd = jest.fn();
    const { unmount } = renderInspectable({ onInspectEnd });
    const { handlerTag } = getByGestureTestId(INSPECT_GESTURE_TEST_ID);

    emitStateChange(handlerTag, {
      oldState: State.UNDETERMINED,
      state: State.BEGAN,
    });
    emitStateChange(handlerTag, { oldState: State.BEGAN, state: State.ACTIVE });
    // Still live: RNGH sends no terminal state change on teardown, so nothing
    // else is going to clear the parent's inspected point.
    expect(onInspectEnd).not.toHaveBeenCalled();

    unmount();

    expect(onInspectEnd).toHaveBeenCalledTimes(1);
  });

  it("does not end twice when a finished gesture is followed by an unmount", () => {
    const onInspectEnd = jest.fn();
    const { unmount } = renderInspectable({ onInspectEnd });

    fireGestureHandler<PanGesture>(
      getByGestureTestId(INSPECT_GESTURE_TEST_ID),
      [
        { state: State.BEGAN, x: 40 },
        { state: State.ACTIVE, x: 40 },
        { state: State.END },
      ],
    );
    expect(onInspectEnd).toHaveBeenCalledTimes(1);

    unmount();

    expect(onInspectEnd).toHaveBeenCalledTimes(1);
  });

  it("never ends a chart that was unmounted without a gesture", () => {
    const onInspectEnd = jest.fn();
    const { unmount } = renderInspectable({ onInspectEnd });

    unmount();

    expect(onInspectEnd).not.toHaveBeenCalled();
  });

  it("keeps ONE gesture across a callback change, and reports through the latest", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderInspectable({ onInspectStart: first });
    const gesture = getByGestureTestId(INSPECT_GESTURE_TEST_ID);

    // The ordinary call site passes inline arrows: a new function identity
    // every render. The detector must not be re-armed for that.
    rerender(
      <TokenPriceChart
        testID="price-history-chart"
        points={inspectPoints}
        resolutionSeconds={900}
        range="1D"
        width={width}
        direction="positive"
        onInspectStart={second}
      />,
    );
    expect(getByGestureTestId(INSPECT_GESTURE_TEST_ID)).toBe(gesture);

    fireGestureHandler<PanGesture>(
      getByGestureTestId(INSPECT_GESTURE_TEST_ID),
      [
        { state: State.BEGAN, x: 40 },
        { state: State.ACTIVE, x: 40 },
        { state: State.END },
      ],
    );

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith(0);
  });

  it("keeps ONE gesture across a same-length series change, and snaps against the NEW xs", () => {
    const onInspectStart = jest.fn();
    const { rerender } = renderInspectable({ onInspectStart });
    const gesture = getByGestureTestId(INSPECT_GESTURE_TEST_ID);

    // Same length (4) as `inspectPoints`, but unevenly spaced: bucket ends
    // 900, 1200, 2700, 3600 -> x 0, 33.3, 200, 300, so x=40 snaps to index 1
    // here instead of index 0 (nearest to x=0 in the original, evenly-spaced
    // series).
    const shiftedPoints = [
      { t: 0, p: "1.00" },
      { t: 300, p: "1.10" },
      { t: 1800, p: "1.05" },
      { t: 2700, p: "1.20" },
    ];
    rerender(
      <TokenPriceChart
        testID="price-history-chart"
        points={shiftedPoints}
        resolutionSeconds={900}
        range="1D"
        width={width}
        direction="positive"
        onInspectStart={onInspectStart}
      />,
    );
    expect(getByGestureTestId(INSPECT_GESTURE_TEST_ID)).toBe(gesture);

    fireGestureHandler<PanGesture>(
      getByGestureTestId(INSPECT_GESTURE_TEST_ID),
      [
        { state: State.BEGAN, x: 40 },
        { state: State.ACTIVE, x: 40 },
        { state: State.END },
      ],
    );

    expect(onInspectStart).toHaveBeenCalledWith(1);
  });
});
