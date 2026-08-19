import BigNumber from "bignumber.js";
import { TokenIcon } from "components/TokenIcon";
import { formatRate } from "components/screens/EarnScreen/helpers";
import { EarnTokenOption } from "components/screens/EarnScreen/hooks/useEarnTokens";
import { Badge } from "components/sds/Badge";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { Balance, Token } from "config/types";
import { formatTokenForDisplay } from "helpers/formatAmount";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export interface EarnTokenRowProps {
  option: EarnTokenOption;
  onPress: () => void;
  /** Forwarded to the row's TouchableOpacity so e2e flows can tap a specific token. */
  testID?: string;
}

/**
 * Single row for the Earn token picker: icon + code + held total on the
 * left, the pool's headline APY badge on the right.
 *
 * Modeled on `SwapTokenRow` — same layout classes and press handling — but
 * simpler: Earn has no context menu / security-scan variants to switch on.
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

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row justify-between items-center mb-6"
    >
      <View className="flex-row items-center flex-1 mr-4">
        <TokenIcon token={token} />
        <View className="ml-4 flex-1">
          <Text md primary medium numberOfLines={1}>
            {option.code}
          </Text>
          {isHeld && (
            <Text sm secondary medium numberOfLines={1}>
              {formatTokenForDisplay(option.total, option.code)}
            </Text>
          )}
        </View>
      </View>
      <Badge variant={option.apy === null ? "secondary" : "success"} size="sm">
        {formatRate(option.apy)}
      </Badge>
    </TouchableOpacity>
  );
};

export default EarnTokenRow;
