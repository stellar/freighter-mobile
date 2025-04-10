import { BalanceRow } from "components/BalanceRow";
import { NETWORKS } from "config/constants";
import { PricedBalance } from "config/types";
import { useBalancesList } from "hooks/useBalancesList";
import React, { ReactNode } from "react";
import { ScrollView } from "react-native";

interface SimpleBalancesListProps {
  publicKey: string;
  network: NETWORKS;
  renderRightContent?: (balance: PricedBalance) => ReactNode;
  rightSectionWidth?: number;
}

/**
 * SimpleBalancesList Component
 *
 * A simplified version of the balances list that just renders the balance rows
 * without any container, title, or pull-to-refresh functionality.
 * Suitable for embedding in other scrollable containers.
 *
 * Features:
 * - Displays regular tokens and liquidity pool tokens
 * - Customizable right content through renderRightContent prop
 * - No pull-to-refresh or loading states
 *
 * @param {SimpleBalancesListProps} props - Component props
 * @returns {JSX.Element} A list of balance rows
 */
export const SimpleBalancesList: React.FC<SimpleBalancesListProps> = ({
  publicKey,
  network,
  renderRightContent,
  rightSectionWidth,
}) => {
  const { balanceItems } = useBalancesList({
    publicKey,
    network,
    shouldPoll: false,
  });

  if (!balanceItems.length) {
    return null;
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical={false}
      testID="simple-balances-list"
    >
      {balanceItems.map((item) => (
        <BalanceRow
          key={item.id}
          balance={item}
          rightContent={renderRightContent?.(item)}
          rightSectionWidth={rightSectionWidth}
        />
      ))}
    </ScrollView>
  );
};
