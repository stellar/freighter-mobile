import { CollectionSection } from "components/CollectionSection";
import { DefaultListFooter } from "components/DefaultListFooter";
import { EmptyState } from "components/EmptyState";
import Spinner from "components/Spinner";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
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
   * Renders an "Add collectible" action inside the empty state. Home turns it
   * on while its tokens tab shows an empty state, so both tabs offer the same
   * kind of button. Off by default — other callers have no pill to match.
   */
  showEmptyStateCta?: boolean;
  /** Press handler for the CTA; it only renders when one is provided. */
  onAddCollectiblePress?: () => void;
}

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
    showEmptyStateCta = false,
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

    const shouldShowEmptyStateCta =
      showEmptyStateCta && Boolean(onAddCollectiblePress);

    // Same variant/size as the tokens CTA. Shared by the empty AND error views:
    // an error replaces the empty state, so leaving it out there would strand
    // the tab with no way to add anything while a fetch is failing.
    const addCollectibleCta = shouldShowEmptyStateCta ? (
      <Button
        secondary
        xl
        onPress={onAddCollectiblePress}
        testID="add-collectible-empty-state-button"
      >
        {t("collectiblesGrid.addCollectibleButton")}
      </Button>
    ) : null;

    const renderErrorView = () => (
      <View className="flex-1">
        <View
          className="pt-4"
          style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
        >
          <Text md secondary>
            {t("collectiblesGrid.error")}
          </Text>
        </View>
        {/* Matches EmptyState's 24px gap so the action sits the same distance
        from the text in both views. */}
        {addCollectibleCta ? (
          <View className="mt-6 items-center">{addCollectibleCta}</View>
        ) : null}
      </View>
    );

    const renderEmptyView = () => (
      <View className="flex-1">
        <EmptyState
          Icon={Icon.Image01}
          title={t("collectiblesGrid.empty")}
          description={t("collectiblesGrid.emptyDescription")}
          testID="collectibles-empty-state"
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

      return (
        <View>
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
