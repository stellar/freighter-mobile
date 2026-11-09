import { readBundledFont, widthInEm } from "__tests__/support/fontMetrics";
import {
  pillHeight,
  pxValue,
  tabWidth,
  worstCase,
} from "__tests__/support/timeframeLayout";
import TimeframeSelector, {
  LABEL_FONT_SIZE,
  LABEL_LINE_HEIGHT,
  LABEL_WRAP_ABOVE_FONT_SCALE,
  PILL_MIN_HEIGHT_WHEN_WRAPPED,
  PILL_MIN_WIDTH_WHEN_WRAPPED,
  PILL_PAD_X,
  PILL_PAD_X_WRAPPED,
  PILL_PAD_Y,
  SEGMENT_GAP,
  SEGMENT_HIT_SLOP_X,
  SEGMENT_HIT_SLOP_Y,
  SEGMENT_HIT_SLOP_Y_WRAPPED,
  TOUCH_TARGET,
} from "components/screens/TokenDetailsScreen/components/PriceHistory/TimeframeSelector";
import { PRICE_HISTORY_RANGES } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import en from "i18n/locales/en/translations.json";
import React from "react";
import { Dimensions } from "react-native";

/** Derived, never transcribed — see the note in `support/timeframeLayout`. */
const SHORTEST_PILL = worstCase((device) =>
  pillHeight(device, { lineHeight: LABEL_LINE_HEIGHT, padY: PILL_PAD_Y }),
);
const NARROWEST_PILL = worstCase((device) =>
  tabWidth(device, { gap: SEGMENT_GAP }),
);

/** A text scale comfortably past the wrap threshold. */
const WRAPPED_SCALE = LABEL_WRAP_ABOVE_FONT_SCALE + 0.1;

const render = () =>
  renderWithProviders(<TimeframeSelector selected="1D" onSelect={jest.fn()} />);

/**
 * Width a wrapped pill would take from its own label alone, for the narrowest
 * label across every supported device — i.e. what the pill would be with no
 * floor at all.
 */
const narrowestNaturalWrappedPill = (fontScale: number) => {
  const fonts = [
    readBundledFont("Inter-SemiBold.ttf"),
    readBundledFont("Inter-Bold.ttf"),
  ];
  const labels = Object.values(en.priceHistory.ranges);

  return worstCase((device) => {
    const fontSize = pxValue(LABEL_FONT_SIZE, device) * fontScale;
    const narrowest = Math.min(
      ...labels.map((label) =>
        Math.max(...fonts.map((font) => widthInEm(font, label))),
      ),
    );

    return narrowest * fontSize + PILL_PAD_X_WRAPPED * 2;
  });
};

/**
 * This environment stubs `Dimensions.get("window")` with a `fontScale` of 2,
 * so an unmocked render exercises the WRAPPED layout. Every test here states
 * the text scale it means to cover rather than inheriting that.
 *
 * Set through `Dimensions` rather than by spying on `useWindowDimensions`,
 * which is what the component calls: that is a named import bound at module
 * load, so a namespace spy does not intercept it. The hook reads `Dimensions`
 * itself, so this reaches it either way.
 */
const setFontScale = (scale: number) =>
  jest.spyOn(Dimensions, "get").mockReturnValue({
    width: 402,
    height: 874,
    scale: 3,
    fontScale: scale,
  });

describe("TimeframeSelector touch targets", () => {
  beforeEach(() => setFontScale(1));
  afterEach(() => jest.restoreAllMocks());

  it("gives every range tab hit-slop on all four sides", () => {
    const { getByTestId } = render();

    // The pills are visually compact by design and are narrower and shorter
    // than the minimum target in both axes, so every side needs slop.
    PRICE_HISTORY_RANGES.forEach((range) => {
      expect(getByTestId(`timeframe-selector-${range}`).props.hitSlop).toEqual({
        top: SEGMENT_HIT_SLOP_Y,
        bottom: SEGMENT_HIT_SLOP_Y,
        left: SEGMENT_HIT_SLOP_X,
        right: SEGMENT_HIT_SLOP_X,
      });
    });
  });

  it("asks for enough vertical slop to fill the row on the shortest pill", () => {
    // The rendered pill is `fs(22) + 4`, which varies by device. No slop
    // derived from a single design-space pill height can land on the target
    // across that range, which is how the previous `(TOUCH_TARGET - 26) / 2`
    // left the SE at 39.2pt. Overshooting works because the row's own
    // minHeight clips the excess back to exactly the target.
    expect(SHORTEST_PILL + SEGMENT_HIT_SLOP_Y * 2).toBeGreaterThanOrEqual(
      TOUCH_TARGET,
    );
  });

  it("reserves the target height, and the gap the slop is sized against", () => {
    const { style } = render().getByTestId("timeframe-selector").props;

    expect(style.minHeight).toBe(TOUCH_TARGET);
    // Ties the rendered gap to the constant that both the tiling invariant
    // below and the label-width budget are computed from. Changing the row to
    // `gap: 12` for visual reasons would otherwise leave a dead strip either
    // side of every boundary and quietly shrink each label's room.
    expect(style.gap).toBe(SEGMENT_GAP);
  });

  it("spends exactly half the gap per side, so neighbours tile it", () => {
    // Less than half leaves a dead strip that swallows taps; more than half
    // makes them overlap, and a tap in the contested band lands on whichever
    // view sits later in the hierarchy rather than the nearer pill.
    expect(SEGMENT_HIT_SLOP_X * 2).toBe(SEGMENT_GAP);
  });

  it("leaves the row unbled, because the end tabs do not need it", () => {
    // The first and last tabs have no gap on their outer side, so that slop
    // is clipped and they are one-sided. An earlier revision widened the row
    // with a negative margin to recover it, which does not work — hitSlop is
    // bounded by every ancestor and the section above has no matching bleed —
    // and is unnecessary: even one-sided, the narrowest supported pill plus
    // its inner slop still clears the target.
    const { style } = render().getByTestId("timeframe-selector").props;

    expect(NARROWEST_PILL + SEGMENT_HIT_SLOP_X).toBeGreaterThanOrEqual(
      TOUCH_TARGET,
    );
    expect(style.marginHorizontal).toBeUndefined();
  });

  describe("at a raised OS text size", () => {
    it("keeps the single row of equal sixths at ordinary text sizes", () => {
      setFontScale(1);
      const { getByTestId } = render();

      expect(getByTestId("timeframe-selector").props.style.flexWrap).toBe(
        "nowrap",
      );

      const { style } = getByTestId("timeframe-selector-1H").props;

      // Both sides of every mode-dependent value, not just the wrapped one.
      // Collapsing these to their wrapped values is catastrophic at ordinary
      // text size — `flexBasis: 0` with no grow gives padding-only pills —
      // and removing `flexGrow` is what caused the last regression here.
      expect(style.flexBasis).toBe(0);
      expect(style.flexGrow).toBe(1);
      expect(style.paddingHorizontal).toBe(PILL_PAD_X);
      expect(style.minWidth).toBeUndefined();
    });

    it("wraps onto further lines rather than shrinking the labels", () => {
      // The earlier revision passed this threshold to `maxFontSizeMultiplier`,
      // which held the row together by refusing the reader's text-size
      // setting — the labels stayed small for exactly the people who asked
      // for them to be large. The layout gives instead.
      setFontScale(WRAPPED_SCALE);
      const { getByTestId } = render();

      expect(getByTestId("timeframe-selector").props.style.flexWrap).toBe(
        "wrap",
      );
      // Content-sized, so a pill is as wide as its own label needs.
      expect(getByTestId("timeframe-selector-1H").props.style.flexBasis).toBe(
        "auto",
      );
    });

    it("stops leaning on the row for vertical target once it wraps", () => {
      // Single-row slop works because the row is exactly TOUCH_TARGET tall
      // and clips it. Wrapped, there is no per-line box to clip against: a
      // 22pt slop each way makes a pill's touch area about 68pt against a
      // line pitch of ~32pt, so it covers its neighbours on the lines above
      // and below. Overlapping siblings resolve to whichever is later in the
      // hierarchy, so a tap near a boundary picks the wrong timeframe.
      setFontScale(WRAPPED_SCALE);
      const { getByTestId } = render();

      PRICE_HISTORY_RANGES.forEach((range) => {
        const tab = getByTestId(`timeframe-selector-${range}`);

        // Half the inter-line gap, tiling it exactly — not zero, which would
        // leave the 8pt band between lines tappable by nothing.
        expect(tab.props.hitSlop.top).toBe(SEGMENT_HIT_SLOP_Y_WRAPPED);
        expect(tab.props.hitSlop.bottom).toBe(SEGMENT_HIT_SLOP_Y_WRAPPED);
        expect(SEGMENT_HIT_SLOP_Y_WRAPPED * 2).toBe(SEGMENT_GAP);
        // Horizontal slop still tiles the gap between pills on a line.
        expect(tab.props.hitSlop.left).toBe(SEGMENT_HIT_SLOP_X);
        expect(tab.props.hitSlop.right).toBe(SEGMENT_HIT_SLOP_X);
        // The pill carries the whole target itself instead.
        expect(tab.props.style.minHeight).toBe(PILL_MIN_HEIGHT_WHEN_WRAPPED);
      });
    });

    it("keeps the slop, and no per-pill height, on the single row", () => {
      setFontScale(1);
      const { getByTestId } = render();
      const tab = getByTestId("timeframe-selector-1H");

      expect(tab.props.hitSlop.top).toBe(SEGMENT_HIT_SLOP_Y);
      expect(tab.props.style.minHeight).toBeUndefined();
    });

    it("never caps the text scale", () => {
      // Reads the LABEL, not the Pressable. An earlier version of this test
      // checked the Pressable, which never carried the prop — so it passed
      // whether or not the cap was there, while being the only guard against
      // the accessibility regression this layout exists to undo.
      setFontScale(3);
      const { getByTestId } = render();

      PRICE_HISTORY_RANGES.forEach((range) => {
        const label = getByTestId(`timeframe-label-${range}`);

        expect(label.props.maxFontSizeMultiplier).toBeUndefined();
        expect(label.props.allowFontScaling).not.toBe(false);
      });
    });

    it("sizes wrapped pills to their own labels, not to equal shares", () => {
      // `flexBasis: auto` only decides where the lines break; `flexGrow` then
      // redistributes each line's leftover space, so leaving grow on makes a
      // 4+2 split render the last two pills far wider than the four above.
      setFontScale(WRAPPED_SCALE);
      const { getByTestId } = render();

      expect(getByTestId("timeframe-selector-1H").props.style.flexGrow).toBe(0);
    });

    it("keeps a wrapped pill wide enough to hit, once grow stops padding it", () => {
      // Content sizing is what stops the last line stretching, but a
      // two-character label plus 8pt padding is around 39pt even on the
      // reference device — under the target. The vertical axis is covered by
      // the pill's own minHeight, so nothing is making up the width; the pill
      // has to cover whatever the horizontal slop does not.
      setFontScale(WRAPPED_SCALE);
      const { getByTestId } = render();

      const { style } = getByTestId("timeframe-selector-1H").props;

      expect(style.minWidth).toBe(PILL_MIN_WIDTH_WHEN_WRAPPED);
      // ONE slop, matching the unbled-row test below: the pill starting each
      // wrapped line is against the row's edge, so its outer slop is clipped.
      expect(style.minWidth + SEGMENT_HIT_SLOP_X).toBeGreaterThanOrEqual(
        TOUCH_TARGET,
      );
      // The assertion above is an identity given how the constant is
      // defined, so on its own it only guards against someone hardcoding a
      // smaller number. This is the part that measures something: without a
      // floor, the narrowest label's pill at this text scale really is short
      // of what a line-edge tab needs. If labels ever grew enough that this
      // stopped holding, the floor would be dead weight and should go.
      expect(narrowestNaturalWrappedPill(WRAPPED_SCALE)).toBeLessThan(
        TOUCH_TARGET - SEGMENT_HIT_SLOP_X,
      );
    });

    it("gives wrapped pills the design's padding back", () => {
      // The single row's 2pt exists only because six labels compete for it.
      setFontScale(WRAPPED_SCALE);
      const { getByTestId } = render();

      expect(
        getByTestId("timeframe-selector-1H").props.style.paddingHorizontal,
      ).toBe(PILL_PAD_X_WRAPPED);
    });
  });
});
