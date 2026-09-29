import {
  Blur,
  Canvas,
  Group,
  LinearGradient,
  Path,
  vec,
} from "@shopify/react-native-skia";
import {
  priceChartHeight,
  priceChartLabelHeight,
  PRICE_CHART_LINE_HEIGHT,
} from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceChart";
import useColors from "hooks/useColors";
import React, { useMemo } from "react";
import { useWindowDimensions, View } from "react-native";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

/**
 * DECORATIVE PLACEHOLDER ART — NOT DATA. A hand-authored silhouette in
 * normalized coordinates, deliberately off the real rendering path (no
 * `PriceHistoryPoint`, no `computeChartGeometry`) and blurred beyond
 * legibility before it reaches a screen.
 */
const GHOST_CHART_SHAPE: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.86],
  [0.05, 0.8],
  [0.1, 0.88],
  [0.16, 0.72],
  [0.22, 0.66],
  [0.27, 0.74],
  [0.33, 0.55],
  [0.38, 0.62],
  [0.44, 0.44],
  [0.49, 0.52],
  [0.55, 0.38],
  [0.61, 0.46],
  [0.66, 0.3],
  [0.72, 0.36],
  [0.77, 0.22],
  [0.83, 0.28],
  [0.88, 0.14],
  [0.94, 0.2],
  [1.0, 0.08],
];

/**
 * From the Figma "Data loading" frame. Skia's sigma is the same quantity CSS
 * `filter: blur()` uses, so this and the extension blur identically.
 */
const GHOST_BLUR_SIGMA = 10;

const GHOST_LINE_STROKE_WIDTH = 2;

interface TokenPriceChartGhostProps {
  /** Measured width of the chart block */
  width: number;
  testID?: string;
}

/**
 * The chart's own artwork behind a 10px blur, at exactly
 * `priceChartHeight(fontScale)` so swapping in the real chart shifts nothing.
 *
 * Static by design: the blur alone says "not ready", and a pulsing blurred
 * chart reads as a rendering glitch. No axis labels — the design blurs the
 * real ones into smudges, but a wallet must not draw invented prices, even
 * blurred. Hidden from assistive tech; the container announces the state.
 */
const TokenPriceChartGhost: React.FC<TokenPriceChartGhostProps> = ({
  width,
  testID,
}) => {
  const { themeColors } = useColors();
  // The ghost has to land on the same geometry as the real chart, and that
  // now moves with the OS text size, because the axis-label rows are sized
  // from the type they hold.
  const { fontScale } = useWindowDimensions();

  const paths = useMemo(() => {
    /** Top of the plot band: the ghost sits exactly where the real line does. */
    const plotTop = priceChartLabelHeight(fontScale);
    const plotBottom = plotTop + PRICE_CHART_LINE_HEIGHT;

    const toY = (normalizedY: number) =>
      plotTop + normalizedY * PRICE_CHART_LINE_HEIGHT;

    const linePath = GHOST_CHART_SHAPE.map(
      ([normalizedX, normalizedY], index) =>
        `${index === 0 ? "M" : "L"}${(normalizedX * width).toFixed(2)} ${toY(
          normalizedY,
        ).toFixed(2)}`,
    ).join(" ");

    return {
      linePath,
      fillPath: `${linePath} L${width.toFixed(2)} ${plotBottom} L0 ${plotBottom} Z`,
      plotTop,
      plotBottom,
    };
  }, [width, fontScale]);

  const lineColor = themeColors.status.success;

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height: priceChartHeight(fontScale) }}
    >
      {width > 0 && (
        <>
          {/* Skia's Path `style` is its paint style ("fill"/"stroke"), not an RN style object */}
          {/* eslint-disable react/style-prop-object */}
          <Canvas style={{ width, height: priceChartHeight(fontScale) }}>
            {/* The blur is declared on the Group so it applies to the whole
                ghost at once, the way the Figma frame blurs the chart frame. */}
            <Group>
              <Blur blur={GHOST_BLUR_SIGMA} />
              <Path path={paths.fillPath} style="fill">
                <LinearGradient
                  start={vec(0, paths.plotTop)}
                  end={vec(0, paths.plotBottom)}
                  colors={[`${lineColor}4D`, `${lineColor}00`]}
                />
              </Path>
              <Path
                path={paths.linePath}
                style="stroke"
                strokeWidth={GHOST_LINE_STROKE_WIDTH}
                strokeJoin="round"
                strokeCap="round"
                color={lineColor}
              />
            </Group>
          </Canvas>
          {/* eslint-enable react/style-prop-object */}
        </>
      )}
    </View>
  );
};

export default TokenPriceChartGhost;
