import { CollectionSection } from "components/CollectionSection";
import { DefaultListFooter } from "components/DefaultListFooter";
import { EmptyState } from "components/EmptyState";
import Spinner from "components/Spinner";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING, DEFAULT_REFRESH_DELAY } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { Collection, useCollectiblesStore } from "ducks/collectibles";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useFilteredCollectibles } from "hooks/useFilteredCollectibles";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useCallback, useState } from "react";
import { View, FlatList, RefreshControl } from "react-native";

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
  /** Whether to disable internal scrolling (for use in parent ScrollView) */
  disableInnerScrolling?: boolean;
  /**
   * Press handler for the Add Collectible button in the empty card and the
   * error view. The button only renders when one is provided.
   */
  onAddCollectiblePress?: () => void;
}

/**
 * The 16pt Figma leaves between two collections, for the scrolling list; the
 * non-scrolling one gets it from a gap on its container instead. Neither
 * leaves any after the last collection.
 */
const CollectionSeparator: React.FC = () => (
  <View className="h-[16px]" testID="collection-separator" />
);

/**
 * CollectiblesGrid Component
 *
 * A component that displays collectibles organized by collections in a grid layout.
 * Features include:
 * - Groups collectibles by collection
 * - Renders each collection as a collapsible 2-column vertical grid (via CollectionSection)
 * - Displays collection names with item counts and an expand/collapse chevron
 * - Handles loading and empty states
 * - Pull-to-refresh functionality
 * - Responsive grid layout with proper spacing
 * - Memoized rendering for performance optimization
 * - Leaves out hidden collectibles; the Add collectible screen's "Show
 *   hidden" sheet is where those are listed and unhidden
 *
 * The component automatically fetches collectibles data on mount and provides
 * a refresh mechanism for users to update the data manually. It uses the
 * `useFilteredCollectibles` hook to drop the hidden collectibles.
 *
 * @param {CollectiblesGridProps} props - Component props
 * @param {Function} [props.onCollectiblePress] - Callback function when a collectible is pressed
 * @param {boolean} [props.disableInnerScrolling] - Whether to disable internal scrolling (for use in parent ScrollView)
 * @returns {JSX.Element} The collectibles grid component
 */
export const CollectiblesGrid: React.FC<CollectiblesGridProps> = React.memo(
  ({
    onCollectiblePress,
    disableInnerScrolling = false,
    onAddCollectiblePress,
  }) => {
    const { t } = useAppTranslation();
    const { themeColors } = useColors();
    const { account } = useGetActiveAccount();
    const { network } = useAuthenticationStore();
    const { isLoading, error, fetchCollectibles } = useCollectiblesStore();

    // Hidden collectibles live in the Add collectible screen's sheet instead
    const { visibleCollectibles: filteredCollections } =
      useFilteredCollectibles();

    // Local state for managing refresh UI only
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = useCallback(() => {
      if (account?.publicKey && network) {
        setIsRefreshing(true);

        // Start fetching collectibles immediately
        fetchCollectibles({ publicKey: account.publicKey, network });

        // Add a minimum delay to prevent UI flickering
        new Promise((resolve) => {
          setTimeout(resolve, DEFAULT_REFRESH_DELAY);
        }).finally(() => {
          setIsRefreshing(false);
        });
      }
    }, [fetchCollectibles, account?.publicKey, network]);

    const renderCollection = useCallback(
      // eslint-disable-next-line react/no-unused-prop-types
      ({ item }: { item: Collection }) => (
        <CollectionSection
          key={item.collectionAddress}
          collection={item}
          onCollectiblePress={onCollectiblePress}
          testID={`collection-section-${item.collectionAddress}`}
        />
      ),
      [onCollectiblePress],
    );

    // During initial loading, show spinner without refresh capability
    if (isLoading && !isRefreshing) {
      return (
        <View className="flex-1 items-center justify-center mb-10">
          <Spinner
            testID="collectibles-grid-spinner"
            size="large"
            color={themeColors.foreground.primary}
          />
        </View>
      );
    }

    // Figma puts it in the empty card (?node-id=372-11772), funded or not,
    // the same pill as the tokens card's Add XLM. The error view shares it: an
    // error replaces the empty card, so leaving it out there would strand the
    // tab with no way to add anything while a fetch is failing.
    const addCollectibleCta = onAddCollectiblePress ? (
      <Button
        secondary
        lg
        onPress={onAddCollectiblePress}
        testID="add-collectible-empty-state-button"
      >
        {t("collectiblesGrid.emptyButton")}
      </Button>
    ) : null;

    // The error and empty views are as tall as their content, so Home's inline
    // Add collectible button follows them instead of sitting at the bottom of
    // the screen. Only the spinner fills the space, to sit centred in it.
    const renderErrorView = () => (
      <View>
        <View
          className="pt-4"
          style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
        >
          <Text md secondary>
            {t("collectiblesGrid.error")}
          </Text>
        </View>
        {/* The error view keeps its own layout; only its button follows the
        empty card's. */}
        {addCollectibleCta ? (
          <View className="mt-6 items-center">{addCollectibleCta}</View>
        ) : null}
      </View>
    );

    const renderEmptyView = () => (
      <View>
        <EmptyState
          title={t("collectiblesGrid.empty")}
          description={t("collectiblesGrid.emptyDescription")}
          testID="collectibles-empty-state"
          contentPaddingHorizontal={32}
          // Figma has the card 16pt from the screen's edges and 8pt under the
          // tab row. The grid is full width, and its contents start 12pt under
          // the row (TokensCollectiblesTabs), so the card starts 4pt above.
          style={{ marginHorizontal: pxValue(16), marginTop: -pxValue(4) }}
        >
          {/* EmptyState's own gap supplies the spacing here. */}
          {addCollectibleCta}
        </EmptyState>
      </View>
    );

    // When inner scrolling is disabled, render collections directly without FlatList
    if (disableInnerScrolling) {
      if (error) {
        return renderErrorView();
      }

      if (!filteredCollections.length) {
        return renderEmptyView();
      }

      // A gap, not a margin on each collection: Figma leaves none after the
      // last one. No flex either: the container is as tall as its collections,
      // so what follows (Home's inline Add collectible button) sits under the
      // last one. The empty and error views are as tall as their content too;
      // only the loading spinner fills the space, to sit centred in it.
      return (
        <View className="gap-[16px]">
          {filteredCollections.map((collection) =>
            renderCollection({ item: collection }),
          )}
        </View>
      );
    }

    // For all other states, wrap content in FlatList with RefreshControl
    return (
      <FlatList
        data={filteredCollections}
        renderItem={renderCollection}
        keyExtractor={(collection) => collection.collectionAddress}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        ItemSeparatorComponent={CollectionSeparator}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={themeColors.secondary}
            onRefresh={handleRefresh}
          />
        }
        ListFooterComponent={DefaultListFooter}
        ListEmptyComponent={error ? renderErrorView() : renderEmptyView()}
      />
    );
  },
);

CollectiblesGrid.displayName = "CollectiblesGrid";
