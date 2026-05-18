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
import { SectionList, TouchableOpacity, View } from "react-native";

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
  // Collectibles loading/error state is owned by collectibles store;
  // token balances manage loading inside BalancesList.
  const isLoading = useCollectiblesStore((state) => state.isLoading);
  const error = useCollectiblesStore((state) => state.error);
  const { visibleCollectibles } = useFilteredCollectibles();

  const collectibleSections = visibleCollectibles.map((collection) => ({
    title: collection.collectionName,
    collectionAddress: collection.collectionAddress,
    data: collection.items,
  }));

  const renderCollectiblesEmptyState = () => {
    if (isLoading) {
      return (
        <View className="items-center justify-center py-6">
          <Spinner
            testID="collectibles-inline-spinner"
            size="small"
            color={themeColors.secondary}
          />
        </View>
      );
    }

    if (error) {
      return (
        <View className="py-2">
          <Text md secondary>
            {t("collectiblesGrid.error")}
          </Text>
        </View>
      );
    }

    return (
      <View className="flex-row items-center gap-2 py-2">
        <Icon.Grid01 size={16} color={themeColors.text.secondary} />
        <Text md medium secondary>
          {t("collectiblesGrid.empty")}
        </Text>
      </View>
    );
  };

  return (
    <SectionList
      className="flex-1"
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: pxValue(DEFAULT_PADDING),
        flexGrow: 1,
      }}
      // Keep token balances visible in the header while collectibles are loading/error;
      // only the collectibles sections switch to empty/error/loading states.
      sections={isLoading || !!error ? [] : collectibleSections}
      keyExtractor={(item) => `${item.collectionAddress}-${item.tokenId}`}
      ListHeaderComponent={
        <View>
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

          <View className="flex-row items-center gap-2 mt-8 mb-3">
            <Icon.Image01 size={16} color={themeColors.text.secondary} />
            <Text medium secondary>
              {t("collectiblesGrid.title")}
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={renderCollectiblesEmptyState()}
      renderSectionHeader={({ section }) => (
        <View className="flex-row items-center gap-[12px] mb-3 mt-3">
          <Text md secondary numberOfLines={1}>
            {section.title}
          </Text>
          <View className="flex-1 h-[1px] bg-gray-3" />
          <Text md secondary>
            {section.data.length}
          </Text>
        </View>
      )}
      renderItem={({ item, section }) => (
        <TouchableOpacity
          className="flex-row items-center gap-4 py-3"
          onPress={() =>
            onCollectiblePress?.({
              collectionAddress: item.collectionAddress,
              tokenId: item.tokenId,
            })
          }
        >
          <View className="w-[40px] h-[40px] rounded-[8px] overflow-hidden bg-background-tertiary">
            <CollectibleImage imageUri={item.image} placeholderIconSize={20} />
          </View>

          <Text md medium numberOfLines={1} style={{ flexShrink: 1 }}>
            {item.name || `${section.title} #${item.tokenId}`}
          </Text>
        </TouchableOpacity>
      )}
      ListFooterComponent={<View className="pb-4" />}
    />
  );
};
