import { readBundledFont, widthInEm } from "__tests__/support/fontMetrics";
import { textBudgetEm, worstCase } from "__tests__/support/timeframeLayout";
import {
  formatRangeLabel,
  LABEL_FONT_SIZE,
  LABEL_WRAP_ABOVE_FONT_SCALE,
  PILL_PAD_X,
  SEGMENT_GAP,
  SELECTED_BORDER,
} from "components/screens/TokenDetailsScreen/components/PriceHistory/TimeframeSelector";
import { PRICE_HISTORY_RANGES } from "config/types";
import { resources } from "i18n";
import i18n from "i18next";

/**
 * Models the SINGLE-ROW layout only. There, the six pills are equal sixths
 * (`flexBasis: 0`), so the longest label sets the floor for all of them —
 * which is the whole reason a budget exists. Above
 * `LABEL_WRAP_ABOVE_FONT_SCALE` the row wraps and the pills size to their own
 * content instead, so no shared budget applies and nothing here is asserted
 * about that case. A label that does not fit
 * wraps onto a second line inside its pill and distorts the row. Portuguese
 * "TUDO" did exactly that on every device.
 *
 * The room a label gets is NOT a fixed multiple of its own size. `Text`
 * renders at `fs(fontSize)` and the screen padding is `pxValue(DEFAULT_PADDING)`,
 * both scaling off a 402x874 reference, while the gap, the pill padding and
 * the selected border are raw points. So the budget in em varies by device —
 * about 3.4 on an iPhone 16 Pro against 3.1 at the 320-unit floor — and a
 * guard written against one reference device is useless. Every figure here
 * comes out of `support/timeframeLayout`, never a transcribed number.
 */

const WORST_BUDGET = worstCase((device) =>
  textBudgetEm(device, {
    gap: SEGMENT_GAP,
    padX: PILL_PAD_X,
    fontSize: LABEL_FONT_SIZE,
    border: SELECTED_BORDER,
  }),
);

/**
 * Android renders the static SemiBold. iOS asks for the variable font at
 * weight 600, whose advances live in `HVAR` deltas this reader does not
 * parse — its `hmtx` alone gives Regular, which is narrower and would make
 * the guard optimistic.
 *
 * Two corrections stand in for that, and they work together rather than
 * separately: Inter-Bold is measured alongside SemiBold as a heavier face,
 * and `OPTICAL_SIZE_ALLOWANCE` covers the variable font's `opsz` axis, which
 * defaults to 14 and renders about 1.5% wider than the 18pt statics bundled
 * here. Bold alone is NOT a bound — for "ALL" and "TUDO" it lands within a
 * whisker of the weight-600 optical-14 cut — so neither correction should be
 * removed on the grounds that the other covers it.
 */
const OPTICAL_SIZE_ALLOWANCE = 1.02;
const FONTS = [
  readBundledFont("Inter-SemiBold.ttf"),
  readBundledFont("Inter-Bold.ttf"),
];
const labelEm = (label: string) =>
  Math.max(...FONTS.map((font) => widthInEm(font, label))) *
  OPTICAL_SIZE_ALLOWANCE;

const labelFor = (range: string, locale: string) =>
  formatRangeLabel(
    range as (typeof PRICE_HISTORY_RANGES)[number],
    i18n.getFixedT(locale, "translations"),
  );

describe("timeframe label widths", () => {
  beforeAll(() => {
    Object.entries(resources).forEach(([locale, bundle]) => {
      i18n.addResourceBundle(locale, "translations", bundle.translations);
    });
  });

  // Every shipped locale, not a hardcoded pair: a future locale with a long
  // word for "all" (Spanish "TODO", "MÁXIMO") is guarded on arrival.
  describe.each(Object.keys(resources))("%s", (locale) => {
    it.each(PRICE_HISTORY_RANGES)("fits %s on the tightest device", (range) => {
      expect(labelEm(labelFor(range, locale))).toBeLessThanOrEqual(
        WORST_BUDGET,
      );
    });

    it("translates every range rather than falling back to English", () => {
      // `fallbackLng: "en"` means a missing key returns the English string,
      // which measures fine and would sail through the width assertions — a
      // pt user would just silently see "1W" instead of "1S". Reading through
      // `formatRangeLabel` cannot catch this, because its `default` branch
      // returns the raw range id and that fits too.
      const { ranges } = (
        resources[locale as keyof typeof resources].translations as {
          priceHistory: { ranges: Record<string, string> };
        }
      ).priceHistory;

      PRICE_HISTORY_RANGES.forEach((range) => {
        expect(ranges[range]).toBeTruthy();
      });
    });
  });

  it("keeps the single row intact up to the threshold it wraps at", () => {
    // Above LABEL_WRAP_ABOVE_FONT_SCALE the row wraps onto further lines, so
    // the budget only has to hold below it. This asserts the threshold is not
    // set higher than the single-row layout can actually carry — otherwise
    // the labels wrap inside their pills before the row gets the chance to.
    Object.keys(resources).forEach((locale) => {
      PRICE_HISTORY_RANGES.forEach((range) => {
        const headroom = WORST_BUDGET / labelEm(labelFor(range, locale));
        expect(headroom).toBeGreaterThanOrEqual(LABEL_WRAP_ABOVE_FONT_SCALE);
      });
    });
  });

  it("rejects a label the font cannot render", () => {
    expect(() => labelEm("▚▞")).toThrow(/no glyph for/);
  });

  it("would have caught the label this guard exists for", () => {
    // "TUDO" is why this file exists. Worth being precise about what is
    // wrong with it now: once the pill padding came down it does fit at the
    // default text size, so an overflow assertion would be false. What it
    // cannot do is hold the single row over the text-size range that layout
    // is meant to cover — it gives out just 7% up, well inside one notch, so
    // the row would be wrapping to two lines almost immediately.
    const headroom = WORST_BUDGET / labelEm("TUDO");

    expect(headroom).toBeLessThan(LABEL_WRAP_ABOVE_FONT_SCALE);
    expect(WORST_BUDGET / labelEm("MÁX")).toBeGreaterThanOrEqual(
      LABEL_WRAP_ABOVE_FONT_SCALE,
    );
  });
});
