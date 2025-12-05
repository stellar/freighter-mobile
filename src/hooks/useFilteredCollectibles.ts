import type { Collection } from "ducks/collectibles";
import { useCollectiblesStore } from "ducks/collectibles";
import { useMemo } from "react";

/**
 * Hook to filter and separate collectibles into visible and hidden collections.
 *
 * This hook accesses the collectibles store directly and maintains separate state
 * for visible and hidden collectibles, allowing components to use either set
 * independently without filtering logic in the view layer.
 *
 * Automatically reacts to changes in the collectibles store and recomputes
 * the filtered collections accordingly.
 *
 * @returns {Object} Object containing visibleCollectibles and hiddenCollectibles
 *
 * @example
 * ```tsx
 * const { visibleCollectibles, hiddenCollectibles } = useFilteredCollectibles();
 *
 * // Display only visible collectibles (default)
 * <CollectiblesGrid type={CollectibleFilterType.VISIBLE} />
 *
 * // Display only hidden collectibles
 * <CollectiblesGrid type={CollectibleFilterType.HIDDEN} />
 * ```
 */
export const useFilteredCollectibles = (): {
  visibleCollectibles: Collection[];
  hiddenCollectibles: Collection[];
} => {
  // Access collections directly from the store
  const collections = useCollectiblesStore((state) => state.collections);

  const { visibleCollectibles, hiddenCollectibles } = useMemo(() => {
    // Separate visible and hidden collectibles
    const visible: Collection[] = [];
    const hidden: Collection[] = [];

    collections.forEach((collection) => {
      // Filter visible items (not hidden)
      const visibleItems = collection.items.filter((item) => !item.isHidden);

      // Filter hidden items
      const hiddenItems = collection.items.filter(
        (item) => item.isHidden === true,
      );

      // Only include collections that have items
      if (visibleItems.length > 0) {
        visible.push({
          ...collection,
          items: visibleItems,
          count: visibleItems.length,
        });
      }

      if (hiddenItems.length > 0) {
        hidden.push({
          ...collection,
          items: hiddenItems,
          count: hiddenItems.length,
        });
      }
    });

    return {
      visibleCollectibles: visible,
      hiddenCollectibles: hidden,
    };
  }, [collections]);

  return { visibleCollectibles, hiddenCollectibles };
};
