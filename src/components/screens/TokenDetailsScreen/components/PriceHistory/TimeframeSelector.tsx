import { Text, TEXT_SIZES } from "components/sds/Typography";
import { PRICE_HISTORY_RANGES, PriceHistoryRange } from "config/types";
import useAppTranslation from "hooks/useAppTranslation";
import { TFunction } from "i18next";
import React from "react";
import { Pressable, useWindowDimensions, View } from "react-native";

/**
 * Every measurement below derives from these three, and the row applies them
 * as style rather than Tailwind classes. Two reasons: a hand-copied `gap-2`
 * could drift from the slop that is supposed to tile it, and Nativewind does
 * not apply classes under Jest, so a class-based layout is untestable here
 * while a style prop is not.
 */
/** WCAG 2.5.5 / Apple HIG minimum touch target. */
export const TOUCH_TARGET = 44;

/**
 * Visual gap between pills, and the pill's own horizontal padding.
 *
 * Raw points, NOT run through `pxValue`. That asymmetry matters: `Text`
 * renders at `fs(fontSize)` and the screen padding is `pxValue(24)`, so type
 * and screen padding scale with the device while these two do not. The room
 * a label gets is therefore a different multiple of its own size on every
 * device, which is why `timeframeLabelWidth.test.ts` takes the minimum across
 * the supported set rather than trusting one reference figure.
 */
export const SEGMENT_GAP = 8;
/**
 * Horizontal padding on a single-row pill, which is `flexBasis: 0` — an equal
 * sixth of the row regardless of padding, so this sets the text box and not
 * the outline. It is this tight only because six labels have to share that
 * row; see `PILL_PAD_X_WRAPPED` for the unconstrained case.
 */
export const PILL_PAD_X = 2;
/**
 * Wrapped pills are content-sized, so nothing is competing for their width
 * and the padding can go back to what the design asks for. Keeping it at 2
 * there would put the glyphs within 2pt of a `rounded-full` border that has
 * grown with the text.
 */
export const PILL_PAD_X_WRAPPED = 8;
/** `py-0.5`, top and bottom. */
export const PILL_PAD_Y = 2;
/** Border on the selected pill. Border-box in Yoga, so it eats the text box. */
export const SELECTED_BORDER = 1;
/** The type step the labels render at. */
export const LABEL_TEXT_SIZE = "sm";
/** Rendered pill height is `fs(this) + PILL_PAD_Y * 2`. */
export const LABEL_LINE_HEIGHT = TEXT_SIZES[LABEL_TEXT_SIZE].lineHeight;
/** Rendered label width is `fs(this)` times the glyph advances. */
export const LABEL_FONT_SIZE = TEXT_SIZES[LABEL_TEXT_SIZE].fontSize;

/**
 * Half the gap. Two neighbours' touch areas meet at the gap's midpoint and
 * tile it exactly: no dead strip between them, and no overlapping band where
 * the tap would land on whichever view sits later in the hierarchy.
 *
 * The first and last tabs have no gap on their outer side, so that side's
 * slop is clipped by the row and they are effectively one-sided. That is
 * fine: even on the narrowest supported device the pill plus its inner slop
 * clears the target, which `TimeframeSelector.test.tsx` derives rather than
 * restates. An earlier revision widened the row with a negative margin to
 * rescue that one side, which did not work — hitSlop is bounded by EVERY
 * ancestor, and the section above the row has no matching bleed — and was
 * not needed.
 */
export const SEGMENT_HIT_SLOP_X = SEGMENT_GAP / 2;

/**
 * The text scale above which six pills no longer fit one row.
 *
 * NOT a cap. An earlier revision passed this to `maxFontSizeMultiplier`,
 * which kept the row intact by refusing to honour the reader's text-size
 * setting — the labels stayed small for exactly the people who had asked for
 * them to be large, while everything around them grew. WCAG 1.4.4 asks for
 * 200%, and suppressing scaling on the section's only interactive control is
 * not a way to get there.
 *
 * So the type scales without limit and the LAYOUT gives instead: past this
 * threshold the pills size to their content and wrap onto further lines. The
 * row is unchanged at ordinary text sizes, where the value is also what
 * `timeframeLabelWidth.test.ts` proves the single-row budget supports.
 */
export const LABEL_WRAP_ABOVE_FONT_SCALE = 1.2;

/**
 * Deliberately larger than the headroom it needs to fill. `hitSlop` is
 * clipped to the parent's bounds, and the row below reserves exactly
 * TOUCH_TARGET, so asking for half the target in each direction lands the
 * vertical touch area on the row's height — 44pt — whatever the pill's own
 * height turns out to be.
 *
 * That only holds while the row is ONE line. Once it wraps there is no
 * per-line box to clip against: the slop is bounded by the whole container,
 * so a pill's touch area reaches well past its own line — about 68pt against
 * a line pitch of 32pt at the wrap threshold — and overlaps its neighbours
 * above and below. Overlapping siblings resolve to whichever sits later in
 * the hierarchy, so a tap near a line boundary selects the wrong timeframe.
 * Wrapped pills therefore carry the target height themselves and spend only
 * half the inter-line gap, which tiles it exactly; see
 * `PILL_MIN_HEIGHT_WHEN_WRAPPED` and `SEGMENT_HIT_SLOP_Y_WRAPPED` below.
 *
 * The previous `(TOUCH_TARGET - PILL_HEIGHT) / 2` could not do that: it
 * derived the slop from a pill height measured at the 402x874 design
 * reference, while the rendered height is `fs(22) + 4`. That left the target
 * at 39.2pt on a 320pt SE and 43.5pt on an iPhone 16 — short of the minimum
 * on every device narrower than the reference, with the rest of the row's
 * reserved height simply dead.
 */
export const SEGMENT_HIT_SLOP_Y = TOUCH_TARGET / 2;

/**
 * In wrapped mode the pill carries the full target height itself rather than
 * borrowing it from a row that no longer bounds it. The label is centred in
 * it, so the pill grows rather than the text moving.
 *
 * It does still take a little vertical slop — see
 * `SEGMENT_HIT_SLOP_Y_WRAPPED`, which tiles the gap between lines. What is
 * unsafe wrapped is the SINGLE-ROW slop, which assumes a 44pt row to clip it.
 */
export const PILL_MIN_HEIGHT_WHEN_WRAPPED = TOUCH_TARGET;

/**
 * Vertical slop for a wrapped pill: half the gap between lines, the same rule
 * the horizontal slop follows.
 *
 * Zero would be safe but leaves the 8pt band between two lines tappable by
 * nothing — the dead strip the single-row layout goes out of its way to tile
 * away, reintroduced for the large-text users this mode exists to serve.
 * Half the gap tiles the line pitch exactly at any text size, since the pitch
 * is the pill plus the gap and the pill already carries the full target.
 */
export const SEGMENT_HIT_SLOP_Y_WRAPPED = SEGMENT_GAP / 2;

/**
 * Width floor for a wrapped pill.
 *
 * Content sizing is what stops the last line stretching, but a two-character
 * label plus its padding lands around 39pt even on the reference device,
 * under the target. The vertical axis is covered separately, by the pill's
 * own `minHeight`, so nothing else is making up the width.
 *
 * Subtracts ONE slop, not two. The pill starting each line sits against the
 * row's edge, so its outer slop is clipped and only the inner side counts —
 * and wrapping means every line has such a pill, not just the first. Taking
 * two would assume slop the edge pills never get, and would also put the
 * floor below the natural width, where it lifts nothing at all.
 */
export const PILL_MIN_WIDTH_WHEN_WRAPPED = TOUCH_TARGET - SEGMENT_HIT_SLOP_X;

/**
 * The enum value stays the request/ID/analytics spelling; the label goes
 * through `t` as literal keys, or a pt user reads English abbreviations.
 */
export const formatRangeLabel = (
  range: PriceHistoryRange,
  t: TFunction<"translations", undefined>,
): string => {
  switch (range) {
    case "1H":
      return t("priceHistory.ranges.1H");
    case "1D":
      return t("priceHistory.ranges.1D");
    case "1W":
      return t("priceHistory.ranges.1W");
    case "1M":
      return t("priceHistory.ranges.1M");
    case "1Y":
      return t("priceHistory.ranges.1Y");
    case "ALL":
      return t("priceHistory.ranges.ALL");
    default:
      return range;
  }
};

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

interface TimeframeSelectorProps {
  selected: PriceHistoryRange;
  onSelect: (range: PriceHistoryRange) => void;
}

/**
 * Always visible, including on a per-range empty result: a thin asset can
 * have 1Y data and no 1H data. Not the SDS `SegmentedControl` — that is a
 * radiogroup with a solid fill, and the design calls for pill tabs — but it
 * shares that component's touch-target constant.
 */
const TimeframeSelector: React.FC<TimeframeSelectorProps> = ({
  selected,
  onSelect,
}) => {
  const { t } = useAppTranslation();
  // From the subscription, not `PixelRatio.getFontScale()`: that returns
  // `Dimensions.get("window").fontScale || PixelRatio.get()`, so a missing or
  // zero scale falls back to the DISPLAY density — 2 or 3 on every modern
  // phone — and would latch the wrapped layout on permanently at normal text
  // size. Reading it here also makes the subscription load-bearing, rather
  // than a bare call a future cleanup could drop without visible effect.
  const { fontScale } = useWindowDimensions();
  // Defaults to 1 rather than to the display density: an absent scale must
  // read as "ordinary text", never as "wrap".
  const wraps = (fontScale ?? 1) > LABEL_WRAP_ABOVE_FONT_SCALE;

  return (
    <View
      // `hitSlop` never extends a touch target past the parent's bounds, so
      // the row reserves the height the tabs want to spend. Without
      // `minHeight` the row hugged its content and the vertical slop was
      // silently clipped to the pill's own ~26pt.
      testID="timeframe-selector"
      className="flex-row items-center"
      style={{
        minHeight: TOUCH_TARGET,
        gap: SEGMENT_GAP,
        flexWrap: wraps ? "wrap" : "nowrap",
      }}
      accessibilityRole="tablist"
      accessibilityLabel={t("priceHistory.timeframeSelectorA11yLabel")}
    >
      {PRICE_HISTORY_RANGES.map((range) => {
        const isSelected = range === selected;

        return (
          <Pressable
            key={range}
            testID={`timeframe-selector-${range}`}
            // `tab`, not `button`: a generic child withholds the tab
            // relationship from assistive tech under a `tablist` parent.
            accessibilityRole="tab"
            accessibilityLabel={formatRangeLabel(range, t)}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(range)}
            // On the single row the pill is an equal sixth whatever its
            // padding, so `PILL_PAD_X` sets only the text box — and it is
            // this tight because at the original 8pt the Portuguese label did
            // not fit on any device. Wrapped, the pill is content-sized, so
            // the padding does set the outline and goes back to the design's
            // value. hitSlop spends the room the row reserves.
            hitSlop={{
              top: wraps ? SEGMENT_HIT_SLOP_Y_WRAPPED : SEGMENT_HIT_SLOP_Y,
              bottom: wraps ? SEGMENT_HIT_SLOP_Y_WRAPPED : SEGMENT_HIT_SLOP_Y,
              left: SEGMENT_HIT_SLOP_X,
              right: SEGMENT_HIT_SLOP_X,
            }}
            style={{
              // Equal sixths on one row; content-sized when wrapped. `grow`
              // has to come off with it, or each line redistributes its own
              // free space and a 4+2 split renders the last two pills at
              // around 2.5x the width of the four above them.
              flexBasis: wraps ? "auto" : 0,
              flexGrow: wraps ? 0 : 1,
              // Wrapped pills own their full target height instead of
              // borrowing it from the row, which no longer bounds them.
              minHeight: wraps ? PILL_MIN_HEIGHT_WHEN_WRAPPED : undefined,
              minWidth: wraps ? PILL_MIN_WIDTH_WHEN_WRAPPED : undefined,
              paddingHorizontal: wraps ? PILL_PAD_X_WRAPPED : PILL_PAD_X,
              paddingVertical: PILL_PAD_Y,
              // As style, not a `border` class, so the width the label-width
              // guard subtracts is the width actually rendered.
              borderWidth: isSelected ? SELECTED_BORDER : 0,
            }}
            className={`items-center justify-center rounded-full ${
              isSelected ? "border-border-primary" : ""
            }`}
          >
            <Text
              // Addressed directly by the test asserting no font-scale cap
              // is applied here, which is the only guard against reinstating
              // the accessibility regression this layout replaced.
              testID={`timeframe-label-${range}`}
              size={LABEL_TEXT_SIZE}
              semiBold
              primary={isSelected}
              secondary={!isSelected}
            >
              {formatRangeLabel(range, t)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default TimeframeSelector;
