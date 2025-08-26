import { useCollectiblesStore } from "ducks/collectibles";
import { useMemo } from "react";

/**
 * Custom hook for managing and processing collectibles data
 *
 * This hook provides:
 * - Access to collections state from the store
 * - Utility functions for finding specific collections and collectibles
 * - Memoized data processing for performance optimization
 *
 * @returns {Object} Object containing collections data, state, and utility functions
 * @returns {Collection[]} returns.collections - Array of collections
 * @returns {boolean} returns.isLoading - Loading state indicator
 * @returns {string|null} returns.error - Error message if any
 * @returns {Function} returns.getCollectionByCollectionAddress - Function to find collection by address
 * @returns {Function} returns.getCollectible - Function to find collectible by collection address and token ID
 * @returns {Function} returns.fetchCollectibles - Function to fetch collectibles data
 * @returns {Function} returns.clearError - Function to clear error state
 */
export const useCollectibles = () => {
  const { collections, isLoading, error, fetchCollectibles, clearError } =
    useCollectiblesStore();

  /**
   * Utility function to find a collection by its collection address
   *
   * @param {string} collectionAddress - The collection address to search for
   * @returns {Collection|undefined} The found collection or undefined if not found
   */
  const getCollection = useMemo(
    () => (collectionAddress: string) =>
      collections.find(
        (collection) => collection.collectionAddress === collectionAddress,
      ),
    [collections],
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
      }) => {
        const collection = collections.find(
          (col) => col.collectionAddress === collectionAddress,
        );
        return collection?.items.find(
          (item) => item.tokenId === tokenId,
        );
      },
    [collections],
  );

  return {
    // Data
    collections,

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
