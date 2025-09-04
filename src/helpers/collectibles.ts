import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import {
  CollectiblesStorage,
  CollectibleContract,
  CollectibleMetadata,
} from "config/types";
import type { Collection, Collectible } from "ducks/collectibles";
import { BackendCollection } from "services/backend";
import { dataStorage } from "services/storage/storageFactory";

/**
 * Helper to get CollectiblesStorage from storage
 * @returns The current collectibles storage, or an empty object if none exists
 */
export const getCollectiblesStorage =
  async (): Promise<CollectiblesStorage> => {
    const storageData = await dataStorage.getItem(
      STORAGE_KEYS.COLLECTIBLES_LIST,
    );
    if (!storageData) {
      return {};
    }

    try {
      return JSON.parse(storageData) as CollectiblesStorage;
    } catch (e) {
      logger.error(
        "getCollectiblesStorage",
        "Error parsing collectibles storage",
        e,
      );
      return {};
    }
  };

/**
 * Helper to save CollectiblesStorage to storage
 * @param storage The updated storage to save
 */
export const saveCollectiblesStorage = async (
  storage: CollectiblesStorage,
): Promise<void> => {
  // The thrown error here should be caught by the caller
  await dataStorage.setItem(
    STORAGE_KEYS.COLLECTIBLES_LIST,
    JSON.stringify(storage),
  );
};

/**
 * Retrieves collectible contracts from local storage
 *
 * @param params The network and publicKey to retrieve contracts for
 * @returns An array of collectible contracts for the specified network and publicKey
 */
export const retrieveCollectiblesContracts = async (params: {
  network: string;
  publicKey: string;
}): Promise<CollectibleContract[]> => {
  const { network, publicKey } = params;

  try {
    const storage = await getCollectiblesStorage();
    return storage?.[publicKey]?.[network] ?? [];
  } catch (error) {
    // Log error but don't break the flow - return empty array instead
    logger.error(
      "retrieveCollectiblesContracts",
      "Error retrieving collectibles contracts:",
      error,
    );
    return [];
  }
};

/**
 * Adds a single collectible to storage
 *
 * @param params The parameters for adding a collectible
 * @param params.network The network of the collectible
 * @param params.publicKey The public key of the account
 * @param params.contractId The contract ID of the collectible
 * @param params.tokenId The token ID of the collectible
 * @returns Promise that resolves when the collectible is added
 */
export const addCollectibleToStorage = async (params: {
  network: string;
  publicKey: string;
  contractId: string;
  tokenId: string;
}): Promise<void> => {
  const { network, publicKey, contractId, tokenId } = params;

  try {
    // Get current storage
    const storage = await getCollectiblesStorage();

    // Initialize nested structure if needed
    if (!storage[publicKey]) {
      storage[publicKey] = {};
    }

    if (!storage[publicKey][network]) {
      storage[publicKey][network] = [];
    }

    // Check if contract already exists
    const existingContract = storage[publicKey][network].find(
      (contract) => contract.contractId === contractId,
    );

    // Contract exists, add token ID if not already present
    if (existingContract) {
      if (!existingContract.tokenIds.includes(tokenId)) {
        existingContract.tokenIds.push(tokenId);
      }
    } else {
      // Contract doesn't exist, create new entry
      storage[publicKey][network].push({
        contractId,
        tokenIds: [tokenId],
      });
    }

    // Save back to storage
    await saveCollectiblesStorage(storage);
  } catch (error) {
    logger.error(
      "addCollectibleToStorage",
      "Error adding collectible to storage",
      error,
    );
    throw error;
  }
};

/**
 * Removes a single collectible from storage
 *
 * @param params The parameters for removing a collectible
 * @param params.network The network of the collectible
 * @param params.publicKey The public key of the account
 * @param params.contractId The contract ID of the collectible
 * @param params.tokenId The token ID of the collectible
 * @returns Promise that resolves when the collectible is removed
 */
export const removeCollectibleFromStorage = async (params: {
  network: string;
  publicKey: string;
  contractId: string;
  tokenId: string;
}): Promise<void> => {
  const { network, publicKey, contractId, tokenId } = params;

  try {
    // Get current storage
    const storage = await getCollectiblesStorage();

    // Check if the user has any collectibles for this network
    if (!storage[publicKey] || !storage[publicKey][network]) {
      return;
    }

    // Find the contract
    const contractIndex = storage[publicKey][network].findIndex(
      (contract) => contract.contractId === contractId,
    );

    if (contractIndex >= 0) {
      const contract = storage[publicKey][network][contractIndex];

      // Remove the token ID
      contract.tokenIds = contract.tokenIds.filter((id) => id !== tokenId);

      // If no more token IDs, remove the contract
      if (contract.tokenIds.length === 0) {
        storage[publicKey][network].splice(contractIndex, 1);
      }

      // If no more contracts for this network, clean up
      if (storage[publicKey][network].length === 0) {
        delete storage[publicKey][network];
      }

      // If no more networks for this public key, clean up
      if (Object.keys(storage[publicKey]).length === 0) {
        delete storage[publicKey];
      }

      // Save back to storage
      await saveCollectiblesStorage(storage);
    }
  } catch (error) {
    logger.error(
      "removeCollectibleFromStorage",
      "Error removing collectible from storage",
      error,
    );
    throw error;
  }
};

/**
 * Transforms backend collectibles collections to frontend Collection interface
 *
 * @param backendCollections The backend collections
 * @returns Promise resolving to transformed frontend collections
 */
export const transformBackendCollections = async (
  backendCollections: BackendCollection[],
): Promise<Collection[]> => {
  try {
    const transformedCollections: Collection[] = await Promise.all(
      backendCollections.map(async ({ collection }) => {
        const collectibles: Collectible[] = await Promise.all(
          collection.collectibles.map(async (collectible) => {
            try {
              // Fetch metadata from token_uri
              const response = await fetch(collectible.token_uri);
              if (!response.ok) {
                throw new Error(
                  `Failed to fetch metadata: ${response.statusText}`,
                );
              }

              const metadata = (await response.json()) as CollectibleMetadata;

              // Transform backend metadata to frontend Collectible interface
              return {
                collectionAddress: collection.address,
                collectionName: collection.name,
                tokenId: collectible.token_id,
                name: metadata.name || `Token #${collectible.token_id}`, // TODO: add translations
                image: metadata.image || "",
                description: metadata.description || "",
                externalUrl: metadata.external_url || "",
                traits: (metadata.attributes || []).map((trait) => ({
                  name: trait.trait_type || "Unknown", // TODO: add translations
                  value: trait.value === undefined ? "" : trait.value,
                })),
              };
            } catch (error) {
              logger.error(
                "transformBackendCollections",
                `Failed to fetch metadata for token ${collectible.token_id}:`,
                error,
              );

              // Return fallback collectible if metadata fetch fails
              return {
                collectionAddress: collection.address,
                collectionName: collection.name,
                tokenId: collectible.token_id,
                name: `Token #${collectible.token_id}`, // TODO: add translations
                image: "",
                description: "Description unavailable", // TODO: add translations
                externalUrl: "",
                traits: [],
              };
            }
          }),
        );

        return {
          collectionAddress: collection.address,
          collectionName: collection.name,
          collectionSymbol: collection.symbol,
          count: collectibles.length,
          items: collectibles,
        };
      }),
    );

    return transformedCollections;
  } catch (error) {
    logger.error(
      "transformBackendCollections",
      "Error transforming backend collections:",
      error,
    );
    throw error;
  }
};
