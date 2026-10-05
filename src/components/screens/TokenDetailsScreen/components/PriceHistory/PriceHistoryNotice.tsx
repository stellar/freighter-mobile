import Icon from "components/sds/Icon";
import { Text, TEXT_SIZES } from "components/sds/Typography";
import { fsValue, pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { useWindowDimensions, View } from "react-native";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

export type PriceHistoryNoticeVariant =
  | "lowVolume"
  | "limitedData"
  | "newlyTraded"
  | "verdictUnavailable";

interface GetNoticeVariantParams {
  /** The server's §4.4 rule-2 verdict (true | false | null) */
  lowVolume: boolean | null;
  /** Whether the drawable series is below the sparse threshold */
  isSparse: boolean;
  /** Whether the token's age explains the sparseness */
  isNewlyTraded: boolean;
}

/**
 * Precedence: low volume beats limited-data (it commonly causes the
 * sparseness, and covers the wash-trader profile — a dense series at low
 * volume); a null verdict shows "couldn't verify", never the accusation.
 */
export const getPriceHistoryNoticeVariant = ({
  lowVolume,
  isSparse,
  isNewlyTraded,
}: GetNoticeVariantParams): PriceHistoryNoticeVariant | null => {
  if (lowVolume === true) return "lowVolume";
  if (lowVolume === null) return "verdictUnavailable";
  if (isSparse) return isNewlyTraded ? "newlyTraded" : "limitedData";

  return null;
};

interface PriceHistoryNoticeProps {
  variant: PriceHistoryNoticeVariant;
}

const ICON_SIZE = 16;

/**
 * Padding that puts the icon on the centre line of the title's FIRST line.
 *
 * Derived, not a constant: the icon is device-scaled only, while the title
 * also scales with the OS text size, so the gap between them changes. A flat
 * 3pt is right only when the line box is ~22 and the icon ~16 — i.e. on the
 * reference device at default text size — and floats the icon well above the
 * title everywhere else.
 */
export const iconOffsetFromFirstLine = (fontScale: number) =>
  Math.max(
    0,
    (fsValue(TEXT_SIZES.sm.lineHeight) * fontScale - pxValue(ICON_SIZE)) / 2,
  );

/**
 * Four copy variants, styled after the Blockaid token banners. Real text, so
 * screen readers announce it.
 */
const PriceHistoryNotice: React.FC<PriceHistoryNoticeProps> = ({ variant }) => {
  const { t } = useAppTranslation();
  const { fontScale } = useWindowDimensions();
  const { themeColors } = useColors();

  const isInfo = variant === "verdictUnavailable";
  const background = isInfo ? "bg-navy-3" : "bg-amber-3";
  const color = isInfo ? themeColors.navy[11] : themeColors.amber[11];

  // Not the shared `Banner`: that renders one string on a single centred row,
  // which turned the extension's title + sentence into the run-on "Limited
  // trading data: price history is limited for this period" and centred a
  // 16px icon against two lines of wrapped text. Same tokens, extension's
  // shape — icon and title on one row, the sentence beneath.
  return (
    <View
      className={`px-[16px] py-[12px] rounded-[16px] w-full gap-[4px] ${background}`}
      testID={`price-history-notice-${variant}`}
    >
      {/* `items-start`, not `items-center`: once the title wraps, centring it
          against a 16px icon floats the icon beside the middle of two lines
          instead of the first one. The padding below then re-centres it
          against the FIRST line, which is what `items-center` did for free
          while the title was guaranteed to be one line. */}
      <View
        testID="price-history-notice-heading"
        className="flex-row items-start gap-[8px]"
      >
        <View
          testID="price-history-notice-icon"
          style={{ paddingTop: iconOffsetFromFirstLine(fontScale) }}
        >
          <Icon.AlertSquare
            size={ICON_SIZE}
            themeColor={isInfo ? "navy" : "amber"}
          />
        </View>
        {/* `flex-1`: React Native defaults `flexShrink` to 0, so without this
            a long title — Portuguese `verdictUnavailable`, or any title at a
            raised OS text size — runs past the card's padding instead of
            wrapping inside it. */}
        <Text sm medium color={color} style={{ flex: 1 }}>
          {t(`priceHistory.notice.${variant}.title`)}
        </Text>
      </View>
      <Text sm color={color}>
        {t(`priceHistory.notice.${variant}.body`)}
      </Text>
    </View>
  );
};

export default PriceHistoryNotice;
