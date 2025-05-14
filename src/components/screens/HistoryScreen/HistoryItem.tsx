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
}) => {
  const { network } = networkDetails;
  const { themeColors } = useColors();
  const [isLoading, setIsLoading] = useState(true);
  const [historyItem, setHistoryItem] = useState<any>(null);

  // Load history item data on component mount or when dependencies change
  useEffect(() => {
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

        setHistoryItem(historyItemData);
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
      }
    };

    buildHistoryItem();
  }, [
    operation,
    accountBalances,
    publicKey,
    networkDetails,
    network,
    themeColors,
  ]);

  // Show loading spinner while data is being fetched
  if (isLoading) {
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
        handleTransactionDetails(historyItem.transactionDetails);
      }}
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
