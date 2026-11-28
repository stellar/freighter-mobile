import {
  GainTone,
  getGainTone,
} from "components/screens/PositionsScreen/helpers/positionFigures";
import { DISPLAY_SIZES, Display, Text } from "components/sds/Typography";
import { fsValue } from "helpers/dimensions";
import { NO_FIAT_VALUE } from "helpers/formatAmount";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

/**
 * The building blocks the pool and token position screens share. Sizes are
 * Figma's in points: arbitrary-value classes, because NativeWind's rem is 14
 * here.
 */

/** Figma's Text/SM is 14/20; `TEXT_SIZES.sm` stays 14/22 for the rest. */
export const SM_LINE_HEIGHT = 20;
/**
 * Display/SM/400's -4% letter spacing. React Native takes it in points, so
 * it's a fraction of the font size, as Home's total does it.
 */
const TOTAL_LETTER_SPACING = -0.04 * fsValue(DISPLAY_SIZES.sm.fontSize);

/** The colour a gain figure takes: green for a gain, grey otherwise. */
export const useGainColor = () => {
  const { themeColors } = useColors();
  return (tone: GainTone) =>
    tone === "gain" ? themeColors.green[11] : themeColors.text.secondary;
};

/** A section's grey heading over its content, 8pt apart. */
export const PositionSection: React.FC<{
  title: string;
  /** The pool screen's headings are Text/MD; the token screen's Text/SM. */
  titleSize?: "sm" | "md";
  children: React.ReactNode;
  testID?: string;
}> = ({ title, titleSize = "sm", children, testID }) => (
  <View className="gap-[8px]" testID={testID}>
    {titleSize === "md" ? (
      <Text md medium secondary>
        {title}
      </Text>
    ) : (
      <Text sm medium secondary style={{ lineHeight: fsValue(SM_LINE_HEIGHT) }}>
        {title}
      </Text>
    )}
    {children}
  </View>
);

/**
 * A position screen's headline: what it holds in USD and the gain under it,
 * green for a gain and grey when it's a loss or unknown, optionally under the
 * token's icon.
 */
export const PositionFigures: React.FC<{
  mark?: React.ReactNode;
  total: string;
  /** The formatted gain line; null reads "--". */
  gain: string | null;
  /** The figure the gain's colour follows. */
  gainValue: number | null;
  testIDPrefix: string;
}> = ({ mark, total, gain, gainValue, testIDPrefix }) => {
  const gainColor = useGainColor();

  return (
    <View className="gap-[12px]">
      {mark}
      <View className="gap-[8px]">
        <Display
          sm
          regular
          primary
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{ letterSpacing: TOTAL_LETTER_SPACING }}
          testID={`${testIDPrefix}-total`}
        >
          {total}
        </Display>
        <Text
          md
          medium
          color={gainColor(getGainTone(gainValue))}
          testID={`${testIDPrefix}-gain`}
        >
          {gain ?? NO_FIAT_VALUE}
        </Text>
      </View>
    </View>
  );
};

/**
 * One token line: its icon, its name with an optional green line under it,
 * and a value over the token amount on the right. A card by default; a
 * button when it opens something.
 */
export const PositionTokenLine: React.FC<{
  icon: React.ReactNode;
  name: string;
  subtitle?: string;
  value: string;
  /** The value's colour and weight, as the earnings line's green +$. */
  valueColor?: string;
  isValueEmphasized?: boolean;
  /** The token amount with its code, e.g. "1,218.6488 USDC". */
  amount: string;
  /** Draws the grey card around the line; off inside a card of its own. */
  isCard?: boolean;
  /** The pool screen's cards round at 12 and the token screen's at 16. */
  cardRadius?: 12 | 16;
  /** Between the icon and the name: 12 on the pool screen, 16 elsewhere. */
  iconGap?: 12 | 16;
  onPress?: () => void;
  testID?: string;
}> = ({
  icon,
  name,
  subtitle,
  value,
  valueColor,
  isValueEmphasized = false,
  amount,
  isCard = true,
  cardRadius = 16,
  iconGap = 16,
  onPress,
  testID,
}) => {
  const { themeColors } = useColors();

  const content = (
    <View className="flex-row items-center justify-between gap-[16px]">
      <View className="flex-1 flex-row items-center" style={{ gap: iconGap }}>
        {icon}
        <View className="flex-1">
          <Text md medium primary numberOfLines={1}>
            {name}
          </Text>
          {subtitle ? (
            <Text
              sm
              medium
              color={themeColors.green[11]}
              numberOfLines={1}
              style={{ lineHeight: fsValue(SM_LINE_HEIGHT) }}
              testID={testID ? `${testID}-subtitle` : undefined}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="items-end">
        <Text
          md
          medium={!isValueEmphasized}
          semiBold={isValueEmphasized}
          primary
          color={valueColor}
          testID={testID ? `${testID}-value` : undefined}
        >
          {value}
        </Text>
        <Text
          sm
          medium
          secondary
          textAlign="right"
          style={{ lineHeight: fsValue(SM_LINE_HEIGHT) }}
          testID={testID ? `${testID}-amount` : undefined}
        >
          {amount}
        </Text>
      </View>
    </View>
  );

  const cardStyle = isCard
    ? {
        borderRadius: cardRadius,
        backgroundColor: themeColors.background.tertiary,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }
    : undefined;

  return onPress ? (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      style={cardStyle}
      testID={testID}
    >
      {content}
    </TouchableOpacity>
  ) : (
    <View style={cardStyle} testID={testID}>
      {content}
    </View>
  );
};
