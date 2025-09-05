import { TokenIcon } from "components/TokenIcon";
import { Text } from "components/sds/Typography";
import {
  DEFAULT_PRESS_DELAY,
  POSITIVE_PRICE_CHANGE_THRESHOLD,
} from "config/constants";
import { PricedBalance } from "config/types";
import { isLiquidityPool } from "helpers/balances";
import { px } from "helpers/dimensions";
import {
  formatTokenAmount,
  formatFiatAmount,
  formatPercentageAmount,
} from "helpers/formatAmount";
import useColors from "hooks/useColors";
import React, { ReactNode } from "react";
import { TouchableOpacity } from "react-native";
import styled from "styled-components/native";

const BalanceRowContainer = styled.View<{ isSingleRow?: boolean }>`
  flex-direction: row;
  width: 100%;
  height: ${px(44)};
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ isSingleRow }: { isSingleRow?: boolean }) =>
    isSingleRow ? 0 : px(24)};
`;

const LeftSection = styled.View`
  flex-direction: row;
  align-items: center;
  flex: 1;
  margin-right: ${px(16)};
`;

const TokenTextContainer = styled.View`
  flex-direction: column;
  margin-left: ${px(16)};
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
  rightContent?: ReactNode;
  rightSectionWidth?: number;
  onPress?: () => void;
  isSingleRow?: boolean;
  customTextContent?: string;
}

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
          <Text medium numberOfLines={1}>
            {formatFiatAmount(balance.fiatTotal)}
          </Text>
          <Text
            sm
            medium
            color={
              balance.percentagePriceChange24h?.gte(
                POSITIVE_PRICE_CHANGE_THRESHOLD,
              )
                ? themeColors.status.success
                : themeColors.text.secondary
            }
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
) => {
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        delayPressIn={isSingleRow ? 0 : DEFAULT_PRESS_DELAY}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return children;
};

export const BalanceRow: React.FC<BalanceRowProps> = ({
  balance,
  customTextContent,
  rightContent,
  rightSectionWidth,
  onPress,
  isSingleRow = false,
}) =>
  renderContent(
    <BalanceRowContainer isSingleRow={isSingleRow}>
      <LeftSection>
        <TokenIcon token={balance} />
        <TokenTextContainer>
          <Text medium numberOfLines={1}>
            {balance.displayName}
          </Text>
          <Text sm medium secondary numberOfLines={1}>
            {customTextContent ||
              formatTokenAmount(balance.total, balance.tokenCode)}
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
  );
