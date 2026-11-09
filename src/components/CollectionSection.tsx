import { CollapsibleCollectionHeader } from "components/CollapsibleCollectionHeader";
import { CollectibleImage } from "components/CollectibleImage";
import Icon from "components/sds/Icon";
import { DEFAULT_PADDING, DEFAULT_PRESS_DELAY } from "config/constants";
import { Collectible, Collection } from "ducks/collectibles";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";

/**
 * Opacity applied to hidden collectibles so they read as dimmed in the grid.
 */
export const HIDDEN_COLLECTIBLE_OPACITY = 0.25;

interface CollectionSectionProps {
  /** The collection to render (header + grid of its items). */
  collection: Collection;
  /** Called when a collectible tile is pressed. */
  onCollectiblePress?: (args: {
    collectionAddress: string;
    tokenId: string;
  }) => void;
  /** Optional test ID for the section wrapper. */
  testID?: string;
}

/**
 * Splits a list into consecutive pairs so the grid can render rows of two.
 */
const chunkIntoPairs = <T,>(items: T[]): T[][] => {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2));
  }
  return rows;
};

/**
 * CollectionSection Component
 *
 * Renders a single collectibles collection as a collapsible 2-column grid:
 * - A header row (name + count badge + chevron) that toggles expand/collapse.
 * - A grid of square tiles laid out two-per-row; an odd final item keeps its
 *   half-width via an invisible spacer.
 * - Hidden collectibles are dimmed and marked with an eye-off overlay.
 *
 * Collapse state is local and in-memory (default expanded) and resets when the
 * screen is left.
 *
 * Figma puts 8pt between a collection's header and its grid and between the
 * grid's rows, and 16pt between the tiles of a row; the tiles are rounded
 * 12pt. They are arbitrary-value classes (`mt-[8px]`, `gap-[8px]`,
 * `gap-[16px]`, `rounded-[12px]`), because NativeWind's rem is 14 here:
 * `gap-4` would come out at 14pt, not 16.
 *
 * The 16pt between two collections is not here: Figma leaves none after the
 * last one, so CollectiblesGrid spaces them with a gap, and whatever follows
 * the grid (Home's Add collectible button) sits 12pt from the last collection.
 */
export const CollectionSection: React.FC<CollectionSectionProps> = ({
  collection,
  onCollectiblePress,
  testID,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  const renderTile = (item: Collectible) => {
    const itemLabel = item.name || `${item.collectionName} #${item.tokenId}`;

    return (
      <TouchableOpacity
        key={item.tokenId}
        className="flex-1 aspect-square rounded-[12px] overflow-hidden"
        delayPressIn={DEFAULT_PRESS_DELAY}
        testID={`collectible-tile-${item.tokenId}`}
        accessibilityRole="button"
        accessibilityLabel={
          item.isHidden
            ? t("collectiblesGrid.itemHiddenLabel", { name: itemLabel })
            : itemLabel
        }
        onPress={() =>
          onCollectiblePress?.({
            collectionAddress: item.collectionAddress,
            tokenId: item.tokenId,
          })
        }
      >
        <View
          className="w-full h-full"
          style={
            item.isHidden ? { opacity: HIDDEN_COLLECTIBLE_OPACITY } : undefined
          }
        >
          <CollectibleImage imageUri={item.image} placeholderIconSize={45} />
        </View>
        {item.isHidden && (
          <View
            className="absolute inset-0 items-center justify-center z-10"
            pointerEvents="none"
            testID={`collectible-hidden-overlay-${item.tokenId}`}
          >
            <Icon.EyeOff size={20} color={themeColors.text.primary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const rows = chunkIntoPairs(collection.items);

  return (
    <View
      testID={testID}
      style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
    >
      <CollapsibleCollectionHeader
        collectionName={collection.collectionName}
        count={collection.items.length}
        isExpanded={isExpanded}
        onToggle={toggleExpanded}
        titlePrimary
        testID={`collection-header-${collection.collectionAddress}`}
      />

      {isExpanded && (
        <View className="gap-[8px] mt-[8px]">
          {rows.map((row) => (
            <View key={row[0].tokenId} className="flex-row gap-[16px]">
              {row.map(renderTile)}
              {row.length === 1 && (
                <View className="flex-1" testID="collection-grid-spacer" />
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

CollectionSection.displayName = "CollectionSection";
