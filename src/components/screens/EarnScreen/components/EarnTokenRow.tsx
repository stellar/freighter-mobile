import BigNumber from "bignumber.js";
import { TokenIcon } from "components/TokenIcon";
import { formatRate } from "components/screens/EarnScreen/helpers";
import { EarnTokenOption } from "components/screens/EarnScreen/hooks/useEarnTokens";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { Balance, Token } from "config/types";
import { formatTokenForDisplay } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export interface EarnTokenRowProps {
  option: EarnTokenOption;
  onPress: () => void;
  /** Forwarded to the row's TouchableOpacity so e2e flows can tap a specific token. */
  testID?: string;
}

/**
 * The pool's headline rate as a pill: "16.94% APY" in success green on a
 * pale green fill. Shared by the token picker and the Earn swap sheet.
 *
 * A null rate means the pool oracle has no fresh price. The pill then reads
 * "-- APY" in neutral grays rather than green, so an unknown rate is never
 * dressed up as a yield.
 */
export const EarnApyPill: React.FC<{ apy: number | null; testID?: string }> = ({
  apy,
  testID,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const isKnown = apy !== null;

  return (
    <View
      className="items-center justify-center rounded-full px-[12px] py-[4px]"
      style={{
        backgroundColor: isKnown
          ? themeColors.green[4]
          : themeColors.background.secondary,
      }}
      testID={testID}
    >
      <Text
        xs
        medium
        color={isKnown ? themeColors.green[11] : themeColors.text.secondary}
      >
        {t("earnTokenPicker.apyPill", { rate: formatRate(apy) })}
      </Text>
    </View>
  );
};

/**
 * Single row for the Earn token picker: icon + display name + balance on the
 * left, the pool's headline APY pill on the right, on a tertiary card.
 */
export const EarnTokenRow: React.FC<EarnTokenRowProps> = ({
  option,
  onPress,
  testID,
}) => {
  const isHeld = new BigNumber(option.total).gt(0);

  // Prefer the real held balance's token shape (correctly discriminates
  // native vs. classic vs. Soroban already). For a zero-balance row there is
  // no balance to read from, so reconstruct a minimal token: native XLM by
  // `isNative` (never by code, per the trap this hook's `buildEarnTokenRows`
  // already guards against), otherwise a generic token keyed by the reserve's
  // own contract address.
  const token: Token | Balance =
    option.balance ??
    (option.isNative
      ? { type: "native" as const, code: NATIVE_TOKEN_CODE as "XLM" }
      : { code: option.code, issuer: { key: option.assetId } });

  // The token's display name ("Stellar Lumens" for native XLM, otherwise the
  // code) is the primary line. Zero-balance rows have no `balance` to read it
  // from, so they fall back to the row's display code.
  const primaryText = option.balance?.displayName ?? option.code;

  // Zero-balance rows read "0 EURC" rather than `formatTokenForDisplay`'s
  // "0.00 EURC". Every zero-balance row's `option.total` is exactly "0" by
  // construction (see `buildEarnTokenRows`).
  const balanceText = isHeld
    ? formatTokenForDisplay(option.total, option.code)
    : `0 ${option.code}`;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center gap-[16px] rounded-[16px] bg-background-tertiary px-[16px] py-[12px]"
    >
      <TokenIcon token={token} />
      <View className="flex-1">
        <Text md primary medium numberOfLines={1}>
          {primaryText}
        </Text>
        <Text sm secondary medium numberOfLines={1}>
          {balanceText}
        </Text>
      </View>
      <EarnApyPill apy={option.apy} />
    </TouchableOpacity>
  );
};

export default EarnTokenRow;
