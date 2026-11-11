import Blockaid from "@blockaid/client";
import BigNumber from "bignumber.js";
import { TokenIcon } from "components/TokenIcon";
import {
  TOKEN_ROW_GAP,
  TOKEN_ROW_SECONDARY_LINE_STYLE,
  TOKEN_ROW_VERTICAL_PADDING,
} from "components/TokenRowStyle";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  DEFAULT_PRESS_DELAY,
  POSITIVE_PRICE_CHANGE_THRESHOLD,
} from "config/constants";
import { PricedBalance } from "config/types";
import { useDebugStore } from "ducks/debug";
import { isLiquidityPool } from "helpers/balances";
import { px } from "helpers/dimensions";
import {
  formatBalanceAmount,
  formatFiatAmount,
  formatPercentageAmount,
} from "helpers/formatAmount";
import useColors from "hooks/useColors";
import React, { ReactNode } from "react";
import { TouchableOpacity, View } from "react-native";
import { assessTokenSecurity } from "services/blockaid/helper";
import styled from "styled-components/native";

const BalanceRowContainer = styled.View`
  flex-direction: row;
  width: 100%;
  justify-content: space-between;
  align-items: center;
  padding-top: ${px(TOKEN_ROW_VERTICAL_PADDING)};
  padding-bottom: ${px(TOKEN_ROW_VERTICAL_PADDING)};
`;

const LeftSection = styled.View`
  flex-direction: row;
  align-items: center;
  flex: 1;
  margin-right: ${px(TOKEN_ROW_GAP)};
`;

const TokenTextContainer = styled.View`
  flex-direction: column;
  margin-left: ${px(TOKEN_ROW_GAP)};
  flex: 1;
`;

interface RightSectionProps {
  width: number;
}

const RightSection = styled.View<RightSectionProps>`
  flex-direction: column;
  align-items: flex-end;
  width: ${({ width }: RightSectionProps) => px(width)};
`;

interface BalanceRowProps {
  balance: PricedBalance;
  scanResult?: Blockaid.TokenBulk.TokenBulkScanResponse.Results;
  rightContent?: ReactNode;
  rightSectionWidth?: number;
  onPress?: () => void;
  isSingleRow?: boolean;
  customTextContent?: string;
  spendableAmount?: BigNumber;
  testID?: string;
}

const getBlockaidDataFromBalance = (
  balance: PricedBalance,
): Blockaid.TokenBulk.TokenBulkScanResponse.Results | undefined => {
  if ("blockaidData" in balance && balance.blockaidData) {
    return balance.blockaidData as Blockaid.TokenBulk.TokenBulkScanResponse.Results;
  }
  return undefined;
};

export const DefaultRightContent: React.FC<{ balance: PricedBalance }> = ({
  balance,
}) => {
  const { themeColors } = useColors();
  const isLP = isLiquidityPool(balance);
  const width = isLP ? 20 : 115;

  return (
    <RightSection width={width} testID="right-section">
      {balance.fiatTotal ? (
        <>
          <Text md semiBold numberOfLines={1}>
            {formatFiatAmount(balance.fiatTotal)}
          </Text>
          <Text
            sm
            medium
            color={
              balance.percentagePriceChange24h?.gte(
                POSITIVE_PRICE_CHANGE_THRESHOLD,
              )
                ? themeColors.green[10]
                : themeColors.text.secondary
            }
            style={TOKEN_ROW_SECONDARY_LINE_STYLE}
          >
            {formatPercentageAmount(balance.percentagePriceChange24h)}
          </Text>
        </>
      ) : (
        <Text sm medium secondary>
          --
        </Text>
      )}
    </RightSection>
  );
};

const renderContent = (
  children: ReactNode,
  onPress?: () => void,
  isSingleRow?: boolean,
  testID?: string,
) => {
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        delayPressIn={isSingleRow ? 0 : DEFAULT_PRESS_DELAY}
        testID={testID}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return children;
};

export const BalanceRow: React.FC<BalanceRowProps> = ({
  balance,
  scanResult: scanResultFromProps,
  customTextContent,
  rightContent,
  rightSectionWidth,
  onPress,
  isSingleRow = false,
  spendableAmount,
  testID,
}) => {
  const { overriddenBlockaidResponse } = useDebugStore();

  const scanResultFromBalance = getBlockaidDataFromBalance(balance);
  const scanResult = scanResultFromBalance || scanResultFromProps;

  const { isMalicious, isSuspicious } = assessTokenSecurity(
    scanResult,
    overriddenBlockaidResponse,
  );
  return renderContent(
    <BalanceRowContainer>
      <LeftSection>
        <View className="relative z-0">
          <TokenIcon token={balance} />
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
        <TokenTextContainer>
          <Text md semiBold numberOfLines={1}>
            {balance.displayName}
          </Text>
          <Text
            sm
            medium
            secondary
            numberOfLines={1}
            style={TOKEN_ROW_SECONDARY_LINE_STYLE}
          >
            {customTextContent ||
              formatBalanceAmount(balance, balance.tokenCode, spendableAmount)}
          </Text>
        </TokenTextContainer>
      </LeftSection>
      {rightContent ? (
        <RightSection width={rightSectionWidth || 115}>
          {rightContent}
        </RightSection>
      ) : (
        <DefaultRightContent balance={balance} />
      )}
    </BalanceRowContainer>,
    onPress,
    isSingleRow,
    testID,
  );
};
