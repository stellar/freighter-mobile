import { Collection, useCollectiblesStore } from "ducks/collectibles";
import { useMemo } from "react";

/**
 * Custom hook for managing and processing collectibles data
 *
 * This hook provides:
 * - Access to collectibles state from the store
 * - Grouped collections by collection address
 * - Utility functions for finding specific collections and collectibles
 * - Memoized data processing for performance optimization
 *
 * @returns {Object} Object containing collectibles data, state, and utility functions
 * @returns {Collectible[]} returns.collectibles - Array of all collectibles
 * @returns {Collection[]} returns.collections - Collections grouped by address
 * @returns {boolean} returns.isLoading - Loading state indicator
 * @returns {string|null} returns.error - Error message if any
 * @returns {Function} returns.getCollectionByCollectionAddress - Function to find collection by address
 * @returns {Function} returns.getCollectible - Function to find collectible by collection address and token ID
 * @returns {Function} returns.fetchCollectibles - Function to fetch collectibles data
 * @returns {Function} returns.clearError - Function to clear error state
 */
export const useCollectibles = () => {
  const { collectibles, isLoading, error, fetchCollectibles, clearError } =
    useCollectiblesStore();

  /**
   * Groups collectibles by collection address into Collection objects
   *
   * Each collection contains:
   * - collectionAddress: The unique identifier for the collection
   * - collectionName: Human-readable name of the collection
   * - items: Array of collectibles belonging to this collection
   * - count: Total number of collectibles in the collection
   */
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

  /**
   * Utility function to find a collection by its collection address
   *
   * @param {string} collectionAddress - The collection address to search for
   * @returns {Collection|undefined} The found collection or undefined if not found
   */
  const getCollection = useMemo(
    () => (collectionAddress: string) =>
      groupedCollections.find(
        (collection) => collection.collectionAddress === collectionAddress,
      ),
    [groupedCollections],
  );

  /**
   * Utility function to find a specific collectible by its collection address and token ID
   *
   * @param {Object} params - The parameters object
   * @param {string} params.collectionAddress - The collection address to search for
   * @param {string} params.tokenId - The token ID to search for
   * @returns {Collectible|undefined} The found collectible or undefined if not found
   */
  const getCollectible = useMemo(
    () =>
      ({
        collectionAddress,
        tokenId,
      }: {
        collectionAddress: string;
        tokenId: string;
      }) =>
        collectibles.find(
          (collectible) =>
            collectible.collectionAddress === collectionAddress &&
            collectible.tokenId === tokenId,
        ),
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
    getCollection,
    getCollectible,

    // Actions
    fetchCollectibles,
    clearError,
  };
};
