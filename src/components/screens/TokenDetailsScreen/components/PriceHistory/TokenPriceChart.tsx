import {
  Canvas,
  Circle,
  LinearGradient,
  Path,
  vec,
} from "@shopify/react-native-skia";
import { Text, TEXT_SIZES } from "components/sds/Typography";
import { PriceHistoryPoint } from "config/types";
import { fsValue, pxValue } from "helpers/dimensions";
import {
  ChartCoordinate,
  CHART_MORPH_DURATION_MS,
  computeChartGeometry,
  formatPriceHistoryLabel,
  getPriceChangeColor,
  interpolateChartCoordinates,
  PriceChangeDirection,
} from "helpers/priceHistoryChart";
import useColors from "hooks/useColors";
import useIsReduceMotionEnabled from "hooks/useIsReduceMotionEnabled";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LayoutChangeEvent, useWindowDimensions, View } from "react-native";
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

/** Height of the plotted line area (from the Figma chart instance). */
export const PRICE_CHART_LINE_HEIGHT = 152;
/**
 * Height of each axis-label row above/below the line area.
 *
 * Derived from the type it contains rather than fixed at the Figma's 20pt.
 * `Text sm` renders at `fs(22)` — 22pt on the 402x874 reference, less on a
 * small device, more on a large one — and the OS text-size setting scales it
 * again on top. A flat 20 matched none of those. Where it was too small the
 * labels spilled out of the row over the plot, since they are absolutely
 * positioned; where it was too large the block carried dead space the
 * skeleton had to match.
 *
 * Takes the scale explicitly, with no default: a caller that forgets to pass
 * the live one would silently lay the real chart out shorter than the
 * skeleton it replaces, which no test can see but every user would.
 */
export const priceChartLabelHeight = (fontScale: number): number =>
  fsValue(TEXT_SIZES.sm.lineHeight) * fontScale;

/**
 * Total chart block height — also the skeleton, error and empty-state height
 * (§7.3), which is why it is one function they all call: the placeholder has to match the
 * real chart exactly or swapping them in shifts the page.
 */
export const priceChartHeight = (fontScale: number): number =>
  PRICE_CHART_LINE_HEIGHT + 2 * priceChartLabelHeight(fontScale);

const LINE_STROKE_WIDTH = 2;
/**
 * The last point plots at exactly `width`, so its dot is centred on the
 * canvas edge; the canvas is drawn this much wider than the plot so the dot
 * draws whole instead of being cut to a half disc. The caller must leave that
 * much room to the right of `width`: the chart sits in a SectionList header,
 * and an iOS ScrollView clips to its bounds, so the section hands the chart
 * its measured width minus this radius rather than letting it overflow.
 */
export const END_DOT_RADIUS = 4;

/**
 * Width assumed for an axis label before it has measured itself.
 *
 * A positioning fallback only. It does NOT constrain layout: Yoga measures an
 * absolutely positioned child against its containing block's full width, not
 * `parentWidth - left`, so an over-wide label was never going to wrap on
 * account of this number — `numberOfLines={1}` is what bounds that.
 *
 * Sized to the formatter's real output so the pre-measurement frame is close
 * rather than arbitrary: `$0.1589` is 53pt, `$0.00000010` 90pt,
 * `$1,234,567.89` 95pt, and the formatter caps neither the integer digits nor
 * the value, so nothing fixed bounds it. `axisLabelWidth.test.ts` records
 * where that runs out.
 */
export const LABEL_CLAMP_WIDTH_AT_DEFAULT_SCALE = 128;

/**
 * Room to assume for a label before it has been measured.
 *
 * Capped at the chart's own width: past that the box would overhang the
 * margin. Both terms that size the label itself — `pxValue` for the device,
 * the same scaling `fsValue` applies to the type, and `fontScale` for the OS
 * text setting. The device half is invisible to the suite, where the
 * dimensions helper is mocked to the identity.
 */
export const axisLabelWidth = (width: number, fontScale: number): number =>
  Math.min(pxValue(LABEL_CLAMP_WIDTH_AT_DEFAULT_SCALE) * fontScale, width);

/**
 * Left offset that centres a label of `labelWidth` on `x`, pulled inside the
 * chart where centring would hang it over an edge.
 *
 * Takes the label's width, and once it has rendered that is its MEASURED
 * width rather than a reserve. Picking between a few alignments inside a
 * fixed-width box cannot be right: the clamp saturates across a band half the
 * reserve wide, so anywhere inside that band an edge-aligned label is wrong,
 * and it jumps tens of points as the extreme crosses the band's boundary.
 * With the real width the position is exact wherever the extreme lands, and
 * continuous as it moves.
 */
export const clampAxisLabelX = (
  x: number,
  width: number,
  labelWidth: number,
): number => Math.max(0, Math.min(x - labelWidth / 2, width - labelWidth));

/** A worklet: the morph rebuilds this on the UI thread every frame. */
export const buildChartLinePath = (coords: ChartCoordinate[]): string => {
  "worklet";

  return coords
    .map(
      (coord, index) =>
        `${index === 0 ? "M" : "L"}${coord.x.toFixed(2)} ${coord.y.toFixed(2)}`,
    )
    .join(" ");
};

/**
 * The line's own path, closed to the bottom of the plot band — derived rather
 * than recomputed, so fill and stroke cannot disagree mid-tween.
 */
export const buildChartFillPath = (coords: ChartCoordinate[]): string => {
  "worklet";

  if (coords.length === 0) {
    return "";
  }

  const first = coords[0];
  const last = coords[coords.length - 1];

  return `${buildChartLinePath(coords)} L${last.x.toFixed(2)} ${PRICE_CHART_LINE_HEIGHT} L${first.x.toFixed(2)} ${PRICE_CHART_LINE_HEIGHT} Z`;
};

interface TokenPriceChartProps {
  /** The wire series — rendered exactly, no fabricated points */
  points: PriceHistoryPoint[];
  /** Derived bucket width from the response (plotting only) */
  resolutionSeconds: number;
  /** Measured width of the chart block */
  width: number;
  /** Colours the whole artwork, from the same source as the header delta. */
  direction: PriceChangeDirection;
  /** Replacing the loading hairline: start as a flat line at the vertical
   * centre, where the hairline sat, and morph up into the series. Read on
   * mount only. The caller checks reduced motion: this chart's own query is
   * still unresolved (and so reads "reduced") when it mounts. */
  riseFromFlat?: boolean;
  testID?: string;
}

/** The series laid flat across the plot's vertical centre. */
const flattenChartCoordinates = (
  coords: ChartCoordinate[],
): ChartCoordinate[] =>
  coords.map(({ x }) => ({ x, y: PRICE_CHART_LINE_HEIGHT / 2 }));

/**
 * Static Skia polyline — no gestures in Phase 1, so nothing competes with the
 * parent ScrollView. Geometry comes from {@link computeChartGeometry}: exactly
 * the returned points, positioned by timestamp at bucket ends, spot never
 * plotted. Axis labels come from those points, not the requested window.
 *
 * A timeframe switch MORPHS the line: the y values tween at the incoming
 * series' own x positions, so the tween settles on real geometry rather than
 * an approximation. Only the line moves — colour and labels describe the
 * selected range and update at once. A switch that must fetch shows the
 * skeleton instead, so the previous range's line never sits under another range's tab.
 */
const TokenPriceChart: React.FC<TokenPriceChartProps> = ({
  points,
  resolutionSeconds,
  width,
  direction,
  riseFromFlat = false,
  testID,
}) => {
  const { themeColors } = useColors();
  const { fontScale } = useWindowDimensions();

  const geometry = useMemo(
    () =>
      computeChartGeometry({
        points,
        resolutionSeconds,
        nowSeconds: Math.floor(Date.now() / 1000),
        width,
        height: PRICE_CHART_LINE_HEIGHT,
      }),
    [points, resolutionSeconds, width],
  );

  const coords = useMemo(() => geometry?.coords ?? [], [geometry]);

  // Reduced motion is honoured by not animating at all: the hard switch is
  // the correct behaviour in its own right, not a degraded one.
  const isReduceMotionEnabled = useIsReduceMotionEnabled();

  // The tween's two endpoints and its position between them, all on the UI
  // thread. Seeded with the first geometry so the very first paint is the
  // settled shape, or with that shape laid flat when rising from the hairline.
  const morphFrom = useSharedValue<ChartCoordinate[]>(
    riseFromFlat ? flattenChartCoordinates(coords) : coords,
  );
  const morphTo = useSharedValue<ChartCoordinate[]>(coords);
  const morphProgress = useSharedValue(riseFromFlat ? 0 : 1);
  // Only the rise fades the fill in: a flat line's fill would otherwise flash
  // as a solid band under it.
  const fillOpacity = useSharedValue(riseFromFlat ? 0 : 1);
  // Consumed by the first geometry with a line in it (the width is measured
  // after mount, so the series may be empty on the first render).
  const risePending = useRef(riseFromFlat);
  // A rise in flight survives this chart's reduced-motion query settling and
  // re-layouts; only a new series takes over from it.
  const isRising = useRef(false);
  // Identity of the series the shared values were last aimed at. Compared by
  // reference on purpose: only a NEW series morphs. A re-layout (measured
  // width) or a recoloured direction recomputes the geometry without changing
  // what is being shown, and must snap.
  const renderedPoints = useRef(points);
  /**
   * While a tween runs the artwork reads the animated paths, otherwise the
   * settled strings. Not an optimisation: a shared value written from JS
   * reaches the UI thread a frame later, so routing the settled state through
   * one would paint the previous range for that frame.
   */
  const [isMorphing, setIsMorphing] = useState(riseFromFlat);
  const stopMorphing = useCallback(() => {
    isRising.current = false;
    setIsMorphing(false);
  }, []);

  useEffect(() => {
    const isNewSeries = renderedPoints.current !== points;
    renderedPoints.current = points;

    const startTween = () => {
      morphProgress.value = 0;
      setIsMorphing(true);
      // Reanimated's easing is applied here, so the helper receives an
      // already-eased progress and stays a pure linear lerp. Easing.out(cubic)
      // is the same curve as the shared `easeOutCubic`; do not ease twice.
      morphProgress.value = withTiming(
        1,
        { duration: CHART_MORPH_DURATION_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          "worklet";

          // Only a tween that RAN OUT hands back to the settled strings; an
          // interrupted one would snap the line to the range it was abandoning.
          if (finished) {
            runOnJS(stopMorphing)();
          }
        },
      );
    };

    if (isRising.current && !isNewSeries) {
      morphFrom.value = flattenChartCoordinates(coords);
      morphTo.value = coords;

      return;
    }
    isRising.current = false;

    if (risePending.current && coords.length >= 2) {
      risePending.current = false;
      isRising.current = true;
      morphFrom.value = flattenChartCoordinates(coords);
      morphTo.value = coords;
      fillOpacity.value = 0;
      fillOpacity.value = withTiming(1, {
        duration: CHART_MORPH_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      });
      startTween();

      return;
    }

    // Nothing to morph from or to (fewer than 2 points is not a line), a
    // re-layout rather than a switch, or reduced motion: show the settled
    // geometry immediately.
    if (
      !isNewSeries ||
      isReduceMotionEnabled ||
      coords.length < 2 ||
      morphTo.value.length < 2
    ) {
      morphFrom.value = coords;
      morphTo.value = coords;
      morphProgress.value = 1;
      fillOpacity.value = 1;
      setIsMorphing(false);

      return;
    }

    // Interruptions resume from what is on screen: the shape currently
    // painted becomes the next tween's outgoing series, so rapid switching
    // stays continuous instead of snapping back and re-animating.
    morphFrom.value = interpolateChartCoordinates({
      from: morphFrom.value,
      to: morphTo.value,
      progress: morphProgress.value,
    });
    morphTo.value = coords;
    startTween();
  }, [
    points,
    coords,
    isReduceMotionEnabled,
    morphFrom,
    morphTo,
    morphProgress,
    fillOpacity,
    stopMorphing,
  ]);

  // Nothing in flight outlives the chart. Its own effect, with only stable
  // deps, so it cancels on unmount and never on a new tween.
  useEffect(
    () => () => {
      cancelAnimation(morphProgress);
      cancelAnimation(fillOpacity);
    },
    [morphProgress, fillOpacity],
  );

  // One interpolation per frame, shared by the stroke, the fill and the end
  // dot so the three can never disagree about where the line is.
  const morphedCoords = useDerivedValue(() =>
    interpolateChartCoordinates({
      from: morphFrom.value,
      to: morphTo.value,
      progress: morphProgress.value,
    }),
  );
  const morphedLinePath = useDerivedValue(() =>
    buildChartLinePath(morphedCoords.value),
  );
  const morphedFillPath = useDerivedValue(() =>
    buildChartFillPath(morphedCoords.value),
  );
  const morphedEndDotX = useDerivedValue(
    () => morphedCoords.value[morphedCoords.value.length - 1]?.x ?? 0,
  );
  const morphedEndDotY = useDerivedValue(
    () => morphedCoords.value[morphedCoords.value.length - 1]?.y ?? 0,
  );

  // The settled artwork, built on the JS thread from the real geometry. This
  // is what the chart shows whenever nothing is animating — including the
  // first paint, a re-layout, and every switch under reduced motion.
  const settled = useMemo(
    () => ({
      linePath: buildChartLinePath(coords),
      fillPath: buildChartFillPath(coords),
      // Runs above the null-geometry guard, so the series may be empty here.
      endDot: coords[coords.length - 1] ?? { x: 0, y: 0 },
    }),
    [coords],
  );

  /**
   * Measured label widths, keyed high/low and tagged with the text they were
   * taken from.
   *
   * Tagged because the key alone goes stale: switching 1D to 1Y turns
   * `$0.1589` into `$1,234.56` at the same key, and positioning the wider
   * text with the narrower measurement overhangs the chart for a frame.
   *
   * The tag carries the text AND the text scale, because the rendered width
   * is the product of the two. Tagging on the text alone leaves the tag
   * matching when someone changes the OS text size with the chart open, and
   * the label is then drawn, visibly, at a width it no longer has.
   */
  const [labelWidths, setLabelWidths] = useState<
    Partial<Record<"high" | "low", { tag: string; width: number }>>
  >({});

  if (!geometry || width <= 0) {
    return null;
  }

  // One colour for the whole artwork: the stroke, the end dot and the
  // gradient fill (that colour at 30% fading to transparent) all follow the
  // direction, the way the design draws a losing range entirely in red.
  const lineColor = getPriceChangeColor(direction, themeColors);
  /** What a stored measurement has to still describe to be usable. */
  const labelTag = (label: string) => `${label}|${fontScale}`;

  const measureLabel =
    (key: "high" | "low", label: string) => (event: LayoutChangeEvent) => {
      const measured = event.nativeEvent.layout.width;
      const tag = labelTag(label);

      setLabelWidths((current) =>
        current[key]?.width === measured && current[key]?.tag === tag
          ? current
          : { ...current, [key]: { tag, width: measured } },
      );
    };

  const labelStyle = (key: "high" | "low", x: number, label: string) => {
    const entry = labelWidths[key];
    const measured = entry?.tag === labelTag(label) ? entry.width : undefined;

    return {
      position: "absolute" as const,
      left: clampAxisLabelX(
        x,
        width,
        measured ?? axisLabelWidth(width, fontScale),
      ),
      // Hidden until its own measurement lands. The reserve is a guess, and
      // drawing with it puts the label tens of points from its point for one
      // frame — the same error this model removed, flashing once per mount
      // and once per range switch. A blank first frame is the cheaper one.
      opacity: measured === undefined ? 0 : 1,
    };
  };

  return (
    <View style={{ width }} testID={testID}>
      <View
        testID="price-history-chart-label-row-high"
        style={{ height: priceChartLabelHeight(fontScale) }}
      >
        <Text
          // Remounts when the price changes, which GUARANTEES a layout event.
          // React Native only emits `onLayout` when a node's metrics actually
          // change, and a new price can land on byte-identical metrics — a
          // digit anagram measures the same, and the clamped offset collides
          // on a whole line of solutions. Without the remount the tag would
          // stay stale with no event coming, and the label would sit hidden
          // for the rest of the range.
          key={formatPriceHistoryLabel(geometry.maxPrice)}
          testID="price-history-chart-label-high"
          numberOfLines={1}
          sm
          medium
          secondary
          onLayout={measureLabel(
            "high",
            formatPriceHistoryLabel(geometry.maxPrice),
          )}
          style={labelStyle(
            "high",
            geometry.maxCoord.x,
            formatPriceHistoryLabel(geometry.maxPrice),
          )}
        >
          {formatPriceHistoryLabel(geometry.maxPrice)}
        </Text>
      </View>
      {/* Skia's Path `style` is its paint style ("fill"/"stroke"), not an RN style object */}
      {/* eslint-disable react/style-prop-object */}
      <Canvas
        style={{
          width: width + END_DOT_RADIUS,
          height: PRICE_CHART_LINE_HEIGHT,
        }}
      >
        <Path
          path={isMorphing ? morphedFillPath : settled.fillPath}
          style="fill"
          opacity={fillOpacity}
        >
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, PRICE_CHART_LINE_HEIGHT)}
            colors={[`${lineColor}4D`, `${lineColor}00`]}
          />
        </Path>
        <Path
          path={isMorphing ? morphedLinePath : settled.linePath}
          style="stroke"
          strokeWidth={LINE_STROKE_WIDTH}
          strokeJoin="round"
          strokeCap="round"
          color={lineColor}
        />
        <Circle
          cx={isMorphing ? morphedEndDotX : settled.endDot.x}
          cy={isMorphing ? morphedEndDotY : settled.endDot.y}
          r={END_DOT_RADIUS}
          color={lineColor}
        />
      </Canvas>
      {/* eslint-enable react/style-prop-object */}
      <View
        testID="price-history-chart-label-row-low"
        style={{ height: priceChartLabelHeight(fontScale) }}
      >
        <Text
          // Remounts when the price changes, which GUARANTEES a layout event.
          // React Native only emits `onLayout` when a node's metrics actually
          // change, and a new price can land on byte-identical metrics — a
          // digit anagram measures the same, and the clamped offset collides
          // on a whole line of solutions. Without the remount the tag would
          // stay stale with no event coming, and the label would sit hidden
          // for the rest of the range.
          key={formatPriceHistoryLabel(geometry.minPrice)}
          testID="price-history-chart-label-low"
          numberOfLines={1}
          sm
          medium
          secondary
          onLayout={measureLabel(
            "low",
            formatPriceHistoryLabel(geometry.minPrice),
          )}
          style={labelStyle(
            "low",
            geometry.minCoord.x,
            formatPriceHistoryLabel(geometry.minPrice),
          )}
        >
          {formatPriceHistoryLabel(geometry.minPrice)}
        </Text>
      </View>
    </View>
  );
};

export default TokenPriceChart;
