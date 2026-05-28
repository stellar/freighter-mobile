import { TokenIcon } from "components/TokenIcon";
import Icon from "components/sds/Icon";
import { TokenSize } from "components/sds/Token";
import { Balance, Token } from "config/types";
import React from "react";
import { View } from "react-native";
import { SecurityLevel } from "services/blockaid/constants";

export interface TokenIconWithBadgeProps {
  /** The token or balance to display */
  token: Token | Balance;
  /** Optional size variant (defaults to "lg") */
  size?: TokenSize;
  /** Optional custom background color */
  backgroundColor?: string;
  /** Optional icon URL, takes precedence over cache */
  iconUrl?: string;
  /** Blockaid security level — drives the badge overlay */
  securityLevel?: SecurityLevel;
}

/**
 * TokenIcon with an optional Blockaid security badge overlay.
 *
 * The badge is rendered as a small AlertCircle icon at the bottom-right
 * of the token icon — red for MALICIOUS, amber for any other "not safe"
 * level (SUSPICIOUS, EXPECTED_TO_FAIL). No badge for SAFE, UNABLE_TO_SCAN,
 * or undefined.
 *
 * This matches the isSuspicious semantic in services/blockaid/helper.ts:
 * any level except SAFE / UNABLE_TO_SCAN / undefined surfaces a warning.
 *
 * Extracted from AddTokenScreen/TokenItem so the SwapScreen rows and
 * Sell/Receive controls can reuse the same overlay pattern.
 */
export const TokenIconWithBadge: React.FC<TokenIconWithBadgeProps> = ({
  securityLevel,
  ...iconProps
}) => {
  const isMalicious = securityLevel === SecurityLevel.MALICIOUS;
  // Match the `isSuspicious` semantic from services/blockaid/helper.ts:
  // any level other than SAFE / UNABLE_TO_SCAN / undefined gets a badge.
  const showBadge =
    securityLevel !== undefined &&
    securityLevel !== SecurityLevel.SAFE &&
    securityLevel !== SecurityLevel.UNABLE_TO_SCAN;

  return (
    <View className="relative z-0">
      <TokenIcon {...iconProps} />
      {showBadge && (
        <View
          testID="token-icon-badge"
          className="absolute bottom-0 right-0 w-4 h-4 items-center justify-center z-10"
        >
          <Icon.AlertCircle
            size={8}
            themeColor={isMalicious ? "red" : "amber"}
            withBackground
          />
        </View>
      )}
    </View>
  );
};

export default TokenIconWithBadge;
