import { CollectibleImage } from "components/CollectibleImage";
import { DefaultListFooter } from "components/DefaultListFooter";
import Spinner from "components/Spinner";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING, DEFAULT_PRESS_DELAY } from "config/constants";
import {
  Collectible,
  Collection,
  useCollectiblesStore,
} from "ducks/collectibles";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback, useEffect, useState } from "react";
import { TouchableOpacity, View, FlatList } from "react-native";

/**
 * Props for the CollectiblesGrid component
 */
interface CollectiblesGridProps {
  /** Callback function triggered when a collectible item is pressed */
  onCollectiblePress?: ({
    collectionAddress,
    tokenId,
  }: {
    collectionAddress: string;
    tokenId: string;
  }) => void;
}

/**
 * CollectiblesGrid Component
 *
 * A component that displays collectibles organized by collections in a grid layout.
 * Features include:
 * - Groups collectibles by collection
 * - Displays collection names with item counts
 * - Shows collectible images in a horizontal scrollable grid
 * - Handles loading and empty states
 * - Pull-to-refresh functionality
 * - Responsive grid layout with proper spacing
 * - Memoized rendering for performance optimization
 *
 * The component automatically fetches collectibles data on mount and provides
 * a refresh mechanism for users to update the data manually.
 *
 * @param {CollectiblesGridProps} props - Component props
 * @param {Function} [props.onCollectiblePress] - Callback function when a collectible is pressed
 * @returns {JSX.Element} The collectibles grid component
 */
export const CollectiblesGrid: React.FC<CollectiblesGridProps> = React.memo(
  ({ onCollectiblePress }) => {
    const { t } = useAppTranslation();
    const { themeColors } = useColors();
    const [isMounted, setIsMounted] = useState(false);
    const { collections, isLoading, error } = useCollectiblesStore();

    useEffect(() => {
      setIsMounted(true);
    }, []);

    const renderCollectibleItem = useCallback(
      ({ item }: { item: Collectible }) => (
        <TouchableOpacity
          className="w-[165px] h-[165px] rounded-2xl overflow-hidden mr-6"
          delayPressIn={DEFAULT_PRESS_DELAY}
          onPress={() =>
            onCollectiblePress?.({
              collectionAddress: item.collectionAddress,
              tokenId: item.tokenId,
            })
          }
        >
          <CollectibleImage imageUri={item.image} placeholderIconSize={45} />
        </TouchableOpacity>
      ),
      [onCollectiblePress],
    );

    const renderCollection = useCallback(
      // eslint-disable-next-line react/no-unused-prop-types
      ({ item }: { item: Collection }) => (
        <View className="mb-6">
          <View
            className="flex-row items-center gap-2 mb-3"
            style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
          >
            <Icon.Grid01 size={20} color={themeColors.text.secondary} />
            <Text medium secondary style={{ flex: 1 }}>
              {item.collectionName}
            </Text>
            <Text medium secondary>
              {item.count}
            </Text>
          </View>
          <FlatList
            data={item.items}
            renderItem={renderCollectibleItem}
            keyExtractor={(collectible) => collectible.tokenId}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: pxValue(DEFAULT_PADDING),
            }}
          />
        </View>
      ),
      [renderCollectibleItem, themeColors.text.secondary],
    );

    // only show spinner on initial load, as spinner is shown in the parent component
    if (isLoading && !isMounted) {
      return (
        <View className="flex-1 items-center justify-center mb-10">
          <Spinner
            testID="collectibles-grid-spinner"
            size="large"
            color={themeColors.secondary}
          />
        </View>
      );
    }

    return (
      <FlatList
        data={collections}
        renderItem={renderCollection}
        keyExtractor={(collection) => collection.collectionAddress}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        ListFooterComponent={DefaultListFooter}
        ListEmptyComponent={
          <View className="flex-1">
            {error ? (
              <View
                className="pt-4"
                style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
              >
                <Text md secondary>
                  {t("collectiblesGrid.error")}
                </Text>
              </View>
            ) : (
              <View
                className="flex-row items-center justify-center pt-5 gap-2"
                style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
              >
                <Icon.Grid01 size={20} color={themeColors.text.secondary} />
                <Text md medium secondary>
                  {t("collectiblesGrid.empty")}
                </Text>
              </View>
            )}
          </View>
        }
      />
    );
  },
);

CollectiblesGrid.displayName = "CollectiblesGrid";
