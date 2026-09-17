import { act, renderHook } from "@testing-library/react-native";
import {
  priceChartLabelHeight,
  PRICE_CHART_LINE_HEIGHT,
} from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceChart";
import TokenPriceChartGhost from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceChartGhost";
import { findAllRenderedByType, renderWithProviders } from "helpers/testUtils";
import React from "react";
import { Dimensions, useWindowDimensions } from "react-native";

/**
 * The ghost stands in for the real chart while the fetch is in flight, so its
 * artwork has to sit in the same plot band. Only its container height was
 * ever asserted: the line and its gradient could be drawn flush with the top
 * of the block and nothing noticed, which is precisely the jump on swap that
 * the ghost exists to avoid.
 */
describe("TokenPriceChartGhost geometry", () => {
  // One test changes the window to observe a text-size change; put it back,
  // or everything appended to this file afterwards silently runs at different
  // dimensions. `restoreAllMocks` does nothing here — this file uses no spies.
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

  const WIDTH = 300;

  const renderGhost = () =>
    renderWithProviders(<TokenPriceChartGhost width={WIDTH} testID="ghost" />);

  const liveScale = () =>
    renderHook(() => useWindowDimensions()).result.current.fontScale;

  it("draws its artwork inside the plot band, not from the top of the block", () => {
    const { toJSON } = renderGhost();
    const plotTop = priceChartLabelHeight(liveScale());

    const [gradient] = findAllRenderedByType(
      toJSON() as never,
      "skLinearGradient",
    );

    expect(plotTop).toBeGreaterThan(0);
    // Skia points come back as JsiSkPoint, whose coordinates live in `ref`.
    const yOf = (point: unknown) => (point as { ref: Float32Array }).ref[1];

    // The gradient spans exactly the plot band: from the label row's bottom
    // edge to the line area's bottom edge.
    expect(yOf(gradient.props.start)).toBe(plotTop);
    expect(yOf(gradient.props.end)).toBe(plotTop + PRICE_CHART_LINE_HEIGHT);
  });

  it("moves its artwork when the OS text size changes while it is up", () => {
    // The container height is computed on every render, but the artwork is
    // memoised. If the text scale is missing from the memo's deps the block
    // grows while the line stays where it was — a skeleton that is briefly
    // wrong in exactly the way the swap is supposed to avoid.
    const scaleOf = (tree: unknown) =>
      (
        findAllRenderedByType(tree as never, "skLinearGradient")[0].props
          .start as { ref: Float32Array }
      ).ref[1];

    const window = { width: 402, height: 874, scale: 3, fontScale: 1 };
    act(() => {
      // Only `window` — writing the window's metrics into `screen` too would
      // leave `screen` wrong for anything appended to this file.
      Dimensions.set({ window, screen: original.screen });
    });

    const { toJSON } = renderGhost();
    const before = scaleOf(toJSON());

    // A real text-size change: `useWindowDimensions` only updates on the
    // dimensions event, so re-rendering with a different mock would leave the
    // hook — and therefore both halves — on the old value, hiding the bug.
    const larger = { ...window, fontScale: 2 };
    act(() => {
      Dimensions.set({ window: larger, screen: original.screen });
    });

    expect(scaleOf(toJSON())).toBeGreaterThan(before);
  });

  it("reserves the same block height the real chart lays out to", () => {
    const { getByTestId } = renderGhost();

    // The ghost is hidden from assistive tech, so the default query skips it.
    const node = getByTestId("ghost", { includeHiddenElements: true });

    expect(node.props.style.height).toBe(
      PRICE_CHART_LINE_HEIGHT + priceChartLabelHeight(liveScale()) * 2,
    );
  });
});
