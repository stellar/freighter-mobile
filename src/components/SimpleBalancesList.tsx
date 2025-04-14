import { BalanceRow } from "components/BalanceRow";
import ManageAssetRightContent from "components/ManageAssetRightContent";
import { NETWORKS } from "config/constants";
import { useBalancesList } from "hooks/useBalancesList";
import React from "react";
import { ScrollView } from "react-native";

interface SimpleBalancesListProps {
  publicKey: string;
  network: NETWORKS;
  rightSectionWidth?: number;
  hideNativeAsset?: boolean;
  handleRemoveAsset: (assetId: string) => void;
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
  rightSectionWidth,
  hideNativeAsset,
  handleRemoveAsset,
}) => {
  const { balanceItems } = useBalancesList({
    publicKey,
    network,
    shouldPoll: false,
  });

  if (!balanceItems.length) {
    return null;
  }

  const filteredBalanceItems = balanceItems.filter(
    (item) => !hideNativeAsset || item.token.type !== "native",
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical={false}
      testID="simple-balances-list"
    >
      {filteredBalanceItems.map((item) => (
        <BalanceRow
          key={item.id}
          balance={item}
          rightContent={
            <ManageAssetRightContent
              asset={{
                id: item.id,
                isNative: item.token.type === "native",
              }}
              handleRemoveAsset={() => handleRemoveAsset(item.id)}
            />
          }
          rightSectionWidth={rightSectionWidth}
        />
      ))}
    </ScrollView>
  );
};
