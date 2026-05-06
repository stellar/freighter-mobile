import { BalancesList } from "components/BalancesList";
import { CollectibleImage } from "components/CollectibleImage";
import Spinner from "components/Spinner";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  DEFAULT_PADDING,
  NETWORKS,
  TransactionContext,
} from "config/constants";
import { useCollectiblesStore } from "ducks/collectibles";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useFilteredCollectibles } from "hooks/useFilteredCollectibles";
import React from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";

interface TokensCollectiblesInlineProps {
  publicKey: string;
  network: NETWORKS;
  onTokenPress?: (tokenId: string) => void;
  onCollectiblePress?: ({
    collectionAddress,
    tokenId,
  }: {
    collectionAddress: string;
    tokenId: string;
  }) => void;
  showSpendableAmount?: boolean;
  feeContext?: TransactionContext;
  balanceRowTestIDPrefix?: string;
}

export const TokensCollectiblesInline: React.FC<
  TokensCollectiblesInlineProps
> = ({
  publicKey,
  network,
  onTokenPress,
  onCollectiblePress,
  showSpendableAmount = false,
  feeContext = TransactionContext.Send,
  balanceRowTestIDPrefix,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const isLoading = useCollectiblesStore((state) => state.isLoading);
  const error = useCollectiblesStore((state) => state.error);
  const { visibleCollectibles } = useFilteredCollectibles();

  let collectiblesContent: React.ReactNode;

  if (isLoading) {
    collectiblesContent = (
      <View className="items-center justify-center py-6">
        <Spinner
          testID="collectibles-inline-spinner"
          size="small"
          color={themeColors.secondary}
        />
      </View>
    );
  } else if (error) {
    collectiblesContent = (
      <View className="py-2">
        <Text md secondary>
          {t("collectiblesGrid.error")}
        </Text>
      </View>
    );
  } else if (visibleCollectibles.length === 0) {
    collectiblesContent = (
      <View className="flex-row items-center gap-2 py-2">
        <Icon.Grid01 size={16} color={themeColors.text.secondary} />
        <Text md medium secondary>
          {t("collectiblesGrid.empty")}
        </Text>
      </View>
    );
  } else {
    collectiblesContent = (
      <View className="pb-4">
        {visibleCollectibles.map((collection) => (
          <View key={collection.collectionAddress} className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2 flex-1 min-w-0">
                <Icon.Grid01 size={14} color={themeColors.text.secondary} />
                <Text md secondary numberOfLines={1} style={{ flexShrink: 1 }}>
                  {collection.collectionName}
                </Text>
              </View>
              <Text md secondary>
                {collection.items.length}
              </Text>
            </View>

            {collection.items.map((item) => (
              <TouchableOpacity
                key={`${item.collectionAddress}-${item.tokenId}`}
                className="flex-row items-center gap-4 py-3"
                onPress={() =>
                  onCollectiblePress?.({
                    collectionAddress: item.collectionAddress,
                    tokenId: item.tokenId,
                  })
                }
              >
                <View className="w-[44px] h-[44px] rounded-[10px] overflow-hidden bg-background-tertiary">
                  <CollectibleImage
                    imageUri={item.image}
                    placeholderIconSize={20}
                  />
                </View>

                <Text lg medium numberOfLines={1} style={{ flexShrink: 1 }}>
                  {item.name || `${collection.collectionName} #${item.tokenId}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
    >
      <View className="flex-row items-center gap-2 mb-3">
        <Icon.Coins03 size={16} color={themeColors.text.secondary} />
        <Text medium secondary>
          {t("balancesList.title")}
        </Text>
      </View>

      <BalancesList
        publicKey={publicKey}
        network={network}
        onTokenPress={onTokenPress}
        disableInnerScrolling
        showSpendableAmount={showSpendableAmount}
        feeContext={feeContext}
        balanceRowTestIDPrefix={balanceRowTestIDPrefix}
      />

      <View className="flex-row items-center gap-2 mt-6 mb-3">
        <Icon.Image01 size={16} color={themeColors.text.secondary} />
        <Text medium secondary>
          {t("collectiblesGrid.title")}
        </Text>
      </View>

      {collectiblesContent}
    </ScrollView>
  );
};
