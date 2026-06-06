import { TokenIcon } from "components/TokenIcon";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NativeToken, NonNativeToken } from "config/types";
import { formatTokenForDisplay } from "helpers/formatAmount";
import React from "react";
import { View } from "react-native";

/**
 * One row of the Sell/Receive summary on the swap review sheet. Render
 * shape is identical for both sides: a TokenIcon (with an optional
 * iconUrl forwarded by the destination side so non-held tokens still
 * show their search-row logo), an absolute-positioned AlertCircle
 * overlay when Blockaid flagged the asset, and a two-line
 * amount + fiat block.
 *
 * `isMalicious` takes precedence over `isSuspicious` for the badge
 * colour — same precedence as the rest of the swap UI.
 */
export const SwapReviewTokenRow: React.FC<{
  token: NonNativeToken | NativeToken;
  amount: string;
  symbol: string;
  fiatString: string;
  iconUrl?: string;
  isMalicious?: boolean;
  isSuspicious?: boolean;
}> = ({
  token,
  amount,
  symbol,
  fiatString,
  iconUrl,
  isMalicious,
  isSuspicious,
}) => (
  <View className="w-full flex-row items-center gap-4">
    <View className="relative">
      <TokenIcon token={token} iconUrl={iconUrl} />
      {(isMalicious || isSuspicious) && (
        <View className="absolute bottom-0 right-0 w-4 h-4 items-center justify-center z-10">
          <Icon.AlertCircle
            size={8}
            testID="alert-icon"
            themeColor={isMalicious ? "red" : "amber"}
            withBackground
          />
        </View>
      )}
    </View>
    <View className="flex-1">
      <Text xl medium>
        {formatTokenForDisplay(amount, symbol)}
      </Text>
      <Text md medium secondary>
        {fiatString}
      </Text>
    </View>
  </View>
);
