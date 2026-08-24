import BigNumber from "bignumber.js";
import { TokenIcon } from "components/TokenIcon";
import { formatRate } from "components/screens/EarnScreen/helpers";
import { EarnTokenOption } from "components/screens/EarnScreen/hooks/useEarnTokens";
import { Badge } from "components/sds/Badge";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { Balance, Token } from "config/types";
import { formatTokenForDisplay } from "helpers/formatAmount";
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
 * Single row for the Earn token picker: icon + display name + balance on the
 * left, the pool's headline APY pill on the right.
 *
 * Card surface: Figma node 8828:19263's row fill resolves to the variable
 * `Default/Background/Tertiary` (#232323), which is an exact hex match for
 * `PALETTE.dark.gray["03"]` -- i.e. this app's `background.tertiary` token,
 * not `background.secondary` (gray["02"]) despite the latter being the more
 * common "card directly on the page" choice elsewhere. Paired with
 * `rounded-2xl` (16px), the same radius already used for other
 * tertiary-background cards sitting directly on the page background (e.g.
 * `AddFundsScreen`, `CollectibleDetailsScreen`).
 */
export const EarnTokenRow: React.FC<EarnTokenRowProps> = ({
  option,
  onPress,
  testID,
}) => {
  const { themeColors } = useColors();
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

  // Figma node 8828:19263 renders the token's display name ("Stellar Lumens"
  // for native XLM, otherwise the code) as the primary line --
  // `PricedBalance.displayName` (ducks/balances.ts) already produces exactly
  // that. Zero-balance rows have no `balance` to read it from, so fall back
  // to `option.code` (the same display-code `useEarnTokens` already resolved
  // for the row).
  const primaryText = option.balance?.displayName ?? option.code;

  // Design shows the balance line unconditionally, including zero-balance
  // rows ("0 EUROC") -- but `formatTokenForDisplay` is a shared, unit-tested
  // helper that always renders a minimum of 2 decimal places (`"0"` ->
  // `"0.00"`; see __tests__/helpers/formatAmount.test.ts), which would print
  // "0.00 EUROC" instead of the design's literal "0 EUROC". Every
  // zero-balance row's `option.total` is exactly `"0"` by construction (see
  // `buildEarnTokenRows`), so branching on `isHeld` reproduces the design's
  // text without touching that shared helper.
  const balanceText = isHeld
    ? formatTokenForDisplay(option.total, option.code)
    : `0 ${option.code}`;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row justify-between items-center px-4 py-3 rounded-2xl bg-background-tertiary"
    >
      <View className="flex-row items-center flex-1 mr-4">
        <TokenIcon token={token} />
        <View className="ml-4 flex-1">
          <Text md primary medium numberOfLines={1}>
            {primaryText}
          </Text>
          <Text sm secondary medium numberOfLines={1}>
            {balanceText}
          </Text>
        </View>
      </View>
      {option.apy === null ? (
        // No fresh oracle price for this reserve -- not represented in the
        // design at all. Falls back to the SDS `Badge`'s neutral variant
        // rather than inventing an unspecified pill style for a state the
        // design doesn't define.
        <Badge variant="secondary" size="sm">
          {formatRate(option.apy)}
        </Badge>
      ) : (
        // The design's APY pill is a solid `green/10` fill with `green/4`
        // text -- confirmed by sampling the Figma render's pixels
        // (fill #3cb179, text #113123) against `global.css`'s dark-theme
        // `--color-green-10`/`--color-green-4`, which match exactly. SDS
        // `Badge`'s "success" variant is `lime`, a yellow-green that doesn't
        // match this teal-green, so this pill is built directly from the
        // `green` theme scale instead of `Badge`.
        //
        // No trailing "*": the redesign's disclaimer ("APY may change based on
        // protocol conditions.") is standalone prose, not a footnote keyed to
        // a marker on each figure.
        <View className="items-center justify-center px-3 py-1.5 rounded-full bg-green-10">
          <Text sm medium color={themeColors.green[4]}>
            {formatRate(option.apy)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default EarnTokenRow;
