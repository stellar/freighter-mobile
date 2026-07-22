import { CollapsibleCollectionHeader } from "components/CollapsibleCollectionHeader";
import { CollectibleImage } from "components/CollectibleImage";
import { Text } from "components/sds/Typography";
import { DEFAULT_PRESS_DELAY } from "config/constants";
import { Collection } from "ducks/collectibles";
import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";

interface SendCollectibleCollectionProps {
  /** The collection to render (collapsible header + vertical list of items). */
  collection: Collection;
  /** Called when a collectible row is pressed. */
  onCollectiblePress?: (args: {
    collectionAddress: string;
    tokenId: string;
  }) => void;
}

/**
 * SendCollectibleCollection Component
 *
 * Renders a single collectibles collection in the Send flow as a collapsible
 * section: the shared collapsible header (name + count badge + chevron) over a
 * single vertical list of collectible rows (thumbnail + name). Collapse state is
 * local and in-memory (default expanded).
 */
export const SendCollectibleCollection: React.FC<
  SendCollectibleCollectionProps
> = ({ collection, onCollectiblePress }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  return (
    <View className="mt-3">
      <CollapsibleCollectionHeader
        collectionName={collection.collectionName}
        count={collection.items.length}
        isExpanded={isExpanded}
        onToggle={toggleExpanded}
        testID={`send-collection-header-${collection.collectionAddress}`}
        showDivider
      />

      {isExpanded && (
        <View className="mt-3">
          {collection.items.map((item) => (
            <TouchableOpacity
              key={`${item.collectionAddress}-${item.tokenId}`}
              className="flex-row items-center gap-4 py-3"
              delayPressIn={DEFAULT_PRESS_DELAY}
              testID={`send-collectible-row-${item.tokenId}`}
              onPress={() =>
                onCollectiblePress?.({
                  collectionAddress: item.collectionAddress,
                  tokenId: item.tokenId,
                })
              }
            >
              <View className="w-[40px] h-[40px] rounded-[8px] overflow-hidden bg-background-tertiary">
                <CollectibleImage
                  imageUri={item.image}
                  placeholderIconSize={20}
                />
              </View>

              <Text md medium numberOfLines={1} style={{ flexShrink: 1 }}>
                {item.name || `${collection.collectionName} #${item.tokenId}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

SendCollectibleCollection.displayName = "SendCollectibleCollection";
