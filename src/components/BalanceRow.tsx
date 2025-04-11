import { AssetIcon } from "components/AssetIcon";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { PricedBalance } from "config/types";
import { isLiquidityPool } from "helpers/balances";
import { px } from "helpers/dimensions";
import {
  formatAssetAmount,
  formatFiatAmount,
  formatPercentageAmount,
} from "helpers/formatAmount";
import React, { ReactNode } from "react";
import styled from "styled-components/native";

const BalanceRowContainer = styled.View`
  flex-direction: row;
  width: 100%;
  height: ${px(44)};
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${px(24)};
`;

const LeftSection = styled.View`
  flex-direction: row;
  align-items: center;
  flex: 1;
  margin-right: ${px(16)};
`;

const AssetTextContainer = styled.View`
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
}

export const DefaultRightContent: React.FC<{ balance: PricedBalance }> = ({
  balance,
}) => {
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
              balance.percentagePriceChange24h?.gt(0)
                ? THEME.colors.status.success
                : THEME.colors.text.secondary
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

export const BalanceRow: React.FC<BalanceRowProps> = ({
  balance,
  rightContent,
  rightSectionWidth,
}) => (
  <BalanceRowContainer>
    <LeftSection>
      <AssetIcon token={balance} />
      <AssetTextContainer>
        <Text medium numberOfLines={1}>
          {balance.displayName}
        </Text>
        <Text sm medium secondary numberOfLines={1}>
          {formatAssetAmount(balance.total, balance.tokenCode)}
        </Text>
      </AssetTextContainer>
    </LeftSection>
    {rightContent ? (
      <RightSection width={rightSectionWidth || 115}>
        {rightContent}
      </RightSection>
    ) : (
      <DefaultRightContent balance={balance} />
    )}
  </BalanceRowContainer>
);
