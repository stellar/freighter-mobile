/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import Spinner from "components/Spinner";
import { HistoryItemProps } from "components/screens/HistoryScreen";
import {
  renderIconComponent,
  renderActionIcon,
} from "components/screens/HistoryScreen/helpers";
import { mapHistoryItemData } from "components/screens/HistoryScreen/mappers";
import { Text } from "components/sds/Typography";
import { DEFAULT_PRESS_DELAY } from "config/constants";
import useColors from "hooks/useColors";
import React, { useEffect, useState } from "react";
import { View, TouchableOpacity } from "react-native";

/**
 * Component to display a single transaction history item
 */
const HistoryItem: React.FC<HistoryItemProps> = ({
  accountBalances,
  operation,
  publicKey,
  networkDetails,
  handleTransactionDetails,
  handleV2TransactionDetails,
  historyItemData: preBuiltHistoryItemData,
}) => {
  const { network } = networkDetails;
  const { themeColors } = useColors();
  // THROWAWAY: preBuiltHistoryItemData is the v2 adapter's escape hatch
  // (mappers/v2Entry.tsx) — when present, this component renders it
  // directly and never runs the mapHistoryItemData effect below, which
  // reads a v1 Horizon operation that doesn't exist for a v2 entry. Goes
  // away with the adapter in Phase B.
  const [isLoading, setIsLoading] = useState(true);
  const [mappedHistoryItem, setMappedHistoryItem] = useState<any>(null);

  // Load history item data on component mount or when dependencies change
  useEffect(() => {
    if (preBuiltHistoryItemData) {
      return;
    }

    const buildHistoryItem = async () => {
      try {
        const historyItemData = await mapHistoryItemData({
          operation,
          accountBalances,
          publicKey,
          networkDetails,
          network,
          themeColors,
        });

        setMappedHistoryItem(historyItemData);
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
      }
    };

    buildHistoryItem();
  }, [
    preBuiltHistoryItemData,
    operation,
    accountBalances,
    publicKey,
    networkDetails,
    network,
    themeColors,
  ]);

  const historyItem = preBuiltHistoryItemData ?? mappedHistoryItem;

  // Show loading spinner while data is being fetched (never true for the
  // pre-built v2 path, which has its data synchronously on first render)
  if (!preBuiltHistoryItemData && isLoading) {
    return (
      <View className="flex-0 items-start py-2">
        <Spinner size="small" />
      </View>
    );
  }

  // Return null if no history item data was loaded
  if (!historyItem) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={() => {
        // v2 rows carry a historyEntry instead of transactionDetails (see
        // mappers/v2Entry.tsx) — the v1 detail sheet reads a Horizon
        // operation the v2 model doesn't carry, so a v2 row opens the v2
        // sheet via a different handler instead.
        if (historyItem.historyEntry) {
          handleV2TransactionDetails(historyItem.historyEntry);
          return;
        }

        if (!historyItem.transactionDetails) {
          return;
        }

        handleTransactionDetails(historyItem.transactionDetails);
      }}
      delayPressIn={DEFAULT_PRESS_DELAY}
      className="mb-4 flex-row justify-between items-center flex-0"
    >
      <View className="flex-row items-center flex-1">
        {renderIconComponent({
          iconComponent: historyItem.IconComponent,
          themeColors,
        })}
        <View className="ml-4 flex-1 mr-2">
          <Text md primary medium numberOfLines={1}>
            {historyItem.rowText}
          </Text>
          <View className="flex-row items-center gap-1">
            {renderActionIcon({
              actionIcon: historyItem.ActionIconComponent,
              themeColors,
            })}
            <Text sm secondary numberOfLines={1}>
              {historyItem.actionText}
            </Text>
          </View>
        </View>
      </View>
      <View className="items-end justify-center">
        {historyItem.amountText && (
          <Text
            md
            primary
            numberOfLines={1}
            color={
              historyItem.isAddingFunds
                ? themeColors.status.success
                : themeColors.text.primary
            }
          >
            {historyItem.amountText}
          </Text>
        )}
        <Text sm secondary numberOfLines={1}>
          {historyItem.dateText}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default HistoryItem;
