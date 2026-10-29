import { readBundledFont, widthInEm } from "__tests__/support/fontMetrics";
import { LABEL_CLAMP_WIDTH_AT_DEFAULT_SCALE } from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceChart";
import { TEXT_SIZES } from "components/sds/Typography";
import { formatPriceHistoryLabel } from "helpers/priceHistoryChart";

/**
 * Records how the reserve relates to the prices the formatter really emits.
 *
 * The reserve is the width assumed for a label before it measures itself, so
 * this is about how close that first frame is — NOT about wrapping. Yoga
 * measures an absolutely positioned child against the containing block's full
 * width regardless of its `left`, so an over-wide label never wrapped on
 * account of the reserve; `numberOfLines={1}` is what bounds it, and past the
 * reserve the label simply clips.
 *
 * Kept because the numbers are the reason the reserve is 128 rather than the
 * 64 it was, and because the cliff is worth being explicit about: the
 * formatter caps neither the integer digits nor the value.
 */
/** `Text sm medium` — the labels' type step and weight. */
const FONT = readBundledFont("Inter-Medium.ttf");
const { fontSize } = TEXT_SIZES.sm;

/**
 * Prices spanning what `formatPriceHistoryLabel` emits: sub-cent tokens at
 * full precision, ordinary dollar amounts, and grouped thousands.
 */
const PRICES = [
  "0.00000010",
  "0.00000012",
  "0.00012345",
  "0.000012",
  "0.1589",
  "1.23",
  "123.45",
  "1234.56",
  "123456.78",
  "1234567.89",
  // The formatter caps neither the integer digits nor the value.
  "12345678.90",
  "123456789.12",
  // Past the reserve even at default text — kept so the cliff is documented
  // rather than sitting just outside the sample. See the reserve's docstring
  // for why no fixed width can bound it.
  "1234567890.12",
];

/**
 * Fraction of the reserve the widest label may occupy. This model sums glyph
 * advances; CoreText and Android's Paint add kerning and round up, so a
 * margin inside a percent or so says nothing. Asserting a bare `<=` would
 * call a 0.7% one a pass.
 */
const HEADROOM = 0.9;

describe("axis label widths", () => {
  /** Everything the reserve is expected to fit. */
  const FITTING = PRICES.filter((price) => Number(price) < 1e9);

  it.each(FITTING)("reserves enough room for %s", (price) => {
    const label = formatPriceHistoryLabel(price);
    const renderedWidth = widthInEm(FONT, label) * fontSize;

    expect(renderedWidth).toBeLessThanOrEqual(
      LABEL_CLAMP_WIDTH_AT_DEFAULT_SCALE * HEADROOM,
    );
  });

  it("would have caught the reserves this guard exists for", () => {
    // 64 fitted `$0.1589` at 53pt and failed everything longer. 96 cleared
    // the old sample set by 0.64pt — inside this model's own error, since it
    // sums glyph advances and ignores kerning and platform rounding — and
    // fails outright against the larger prices now in the set.
    const widest = Math.max(
      ...FITTING.map(
        (price) => widthInEm(FONT, formatPriceHistoryLabel(price)) * fontSize,
      ),
    );

    expect(widest).toBeGreaterThan(64);
    expect(widest).toBeGreaterThan(96 * HEADROOM);
    expect(widest).toBeLessThanOrEqual(
      LABEL_CLAMP_WIDTH_AT_DEFAULT_SCALE * HEADROOM,
    );
    // And the documented cliff really is one: a billion-dollar price exceeds
    // the reserve, which is why the labels clip rather than relying on it.
    const overflowing =
      widthInEm(FONT, formatPriceHistoryLabel("1234567890.12")) * fontSize;

    expect(overflowing).toBeGreaterThan(
      LABEL_CLAMP_WIDTH_AT_DEFAULT_SCALE * HEADROOM,
    );
  });
});
