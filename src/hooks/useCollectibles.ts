import { Collection, useCollectiblesStore } from "ducks/collectibles";
import { useMemo } from "react";

export const useCollectibles = () => {
  const { collectibles, isLoading, error, fetchCollectibles, clearError } =
    useCollectiblesStore();

  // Group collections by collection address
  const groupedCollections = useMemo(() => {
    const grouped = collectibles.reduce<Record<string, Collection>>(
      (collections, collectible) => {
        const address = collectible.collectionAddress;

        /* eslint-disable no-param-reassign */
        if (!collections[address]) {
          collections[address] = {
            collectionAddress: collectible.collectionAddress,
            collectionName: collectible.collectionName,
            items: [],
            count: 0,
          };
        }

        collections[address].items.push(collectible);
        collections[address].count += 1;
        /* eslint-enable no-param-reassign */

        return collections;
      },
      {},
    );

    return Object.values(grouped);
  }, [collectibles]);

  // Get collection by collection address
  const getCollectionByCollectionAddress = useMemo(
    () => (collectionAddress: string) =>
      groupedCollections.find(
        (collection) => collection.collectionAddress === collectionAddress,
      ),
    [groupedCollections],
  );

  // Get a specific collectible by token ID
  const getCollectibleByTokenId = useMemo(
    () => (tokenId: string) =>
      collectibles.find((collectible) => collectible.tokenId === tokenId),
    [collectibles],
  );

  return {
    // Data
    collectibles,
    collections: groupedCollections,

    // State
    isLoading,
    error,

    // Utility functions
    getCollectionByCollectionAddress,
    getCollectibleByTokenId,

    // Actions
    fetchCollectibles,
    clearError,
  };
};
