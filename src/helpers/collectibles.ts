import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import {
  CollectiblesStorage,
  CollectibleContract,
  CollectibleMetadata,
} from "config/types";
import type { Collection, Collectible } from "ducks/collectibles";
import { t } from "i18next";
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
 * Checks if a collectible is hidden based on the hidden collectibles contracts
 *
 * @param collectionAddress The collection address of the collectible
 * @param tokenId The token ID of the collectible
 * @param hiddenCollectiblesContracts Optional array of hidden collectible contracts
 * @returns True if the collectible is hidden, false otherwise
 */
const isCollectibleHidden = (
  collectionAddress: string,
  tokenId: string,
  hiddenCollectiblesContracts?: CollectibleContract[],
): boolean => {
  if (!hiddenCollectiblesContracts?.length) {
    return false;
  }

  return hiddenCollectiblesContracts.some(
    (hiddenCollectibleContract) =>
      hiddenCollectibleContract.contractId === collectionAddress &&
      hiddenCollectibleContract.tokenIds.includes(tokenId),
  );
};

/**
 * Transforms backend collectibles collections to frontend Collection interface
 *
 * @param backendCollections The backend collections
 * @param hiddenCollectiblesContracts Optional array of hidden collectible contracts to set isHidden flag
 * @returns Promise resolving to transformed frontend collections
 */
export const transformBackendCollections = async (
  backendCollections: BackendCollection[],
  hiddenCollectiblesContracts?: CollectibleContract[],
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

              // Check if collectible is hidden
              const isHidden = isCollectibleHidden(
                collection.address,
                collectible.token_id,
                hiddenCollectiblesContracts,
              );

              // Transform backend metadata to frontend Collectible interface
              return {
                collectionAddress: collection.address,
                collectionName: collection.name,
                tokenId: collectible.token_id,
                name:
                  metadata.name ||
                  t("collectibles.fallbacks.tokenName", {
                    tokenId: collectible.token_id,
                  }),
                image: metadata.image,
                description: metadata.description,
                externalUrl: metadata.external_url,
                traits: (metadata.attributes || []).map((trait) => ({
                  name:
                    trait.trait_type ||
                    t("collectibles.fallbacks.unknownTrait"),
                  value: trait.value === undefined ? "" : trait.value,
                })),
                isHidden,
              };
            } catch (error) {
              logger.error(
                "transformBackendCollections",
                `Failed to fetch metadata for token ${collectible.token_id}:`,
                error,
              );

              // Check if collectible is hidden (for fallback case too)
              const isHidden = isCollectibleHidden(
                collection.address,
                collectible.token_id,
                hiddenCollectiblesContracts,
              );

              // Return fallback collectible if metadata fetch fails
              return {
                collectionAddress: collection.address,
                collectionName: collection.name,
                tokenId: collectible.token_id,
                name: t("collectibles.fallbacks.tokenName", {
                  tokenId: collectible.token_id,
                }),
                image: "",
                description: t("collectibles.fallbacks.descriptionUnavailable"),
                externalUrl: "",
                traits: [],
                isHidden,
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

/**
 * Helper to get hidden collectibles storage from storage
 * @returns The current hidden collectibles storage, or an empty object if none exists
 */
export const getHiddenCollectiblesStorage =
  async (): Promise<CollectiblesStorage> => {
    const storageData = await dataStorage.getItem(
      STORAGE_KEYS.HIDDEN_COLLECTIBLES_LIST,
    );
    if (!storageData) {
      return {};
    }

    try {
      return JSON.parse(storageData) as CollectiblesStorage;
    } catch (e) {
      logger.error(
        "getHiddenCollectiblesStorage",
        "Error parsing hidden collectibles storage",
        e,
      );
      return {};
    }
  };

/**
 * Helper to save hidden collectibles storage to storage
 * @param storage The updated storage to save
 */
export const saveHiddenCollectiblesStorage = async (
  storage: CollectiblesStorage,
): Promise<void> => {
  await dataStorage.setItem(
    STORAGE_KEYS.HIDDEN_COLLECTIBLES_LIST,
    JSON.stringify(storage),
  );
};

/**
 * Retrieves hidden collectible contracts from local storage
 *
 * @param params The network and publicKey to retrieve contracts for
 * @returns An array of hidden collectible contracts for the specified network and publicKey
 */
export const retrieveHiddenCollectibles = async (params: {
  network: string;
  publicKey: string;
}): Promise<CollectibleContract[]> => {
  const { network, publicKey } = params;

  try {
    const storage = await getHiddenCollectiblesStorage();
    return storage?.[publicKey]?.[network] ?? [];
  } catch (error) {
    logger.error(
      "retrieveHiddenCollectibles",
      "Error retrieving hidden collectibles:",
      error,
    );
    return [];
  }
};

/**
 * Adds a single collectible to hidden collectibles storage
 *
 * @param params The parameters for hiding a collectible
 * @param params.network The network of the collectible
 * @param params.publicKey The public key of the account
 * @param params.contractId The contract ID of the collectible
 * @param params.tokenId The token ID of the collectible
 * @returns Promise that resolves when the collectible is hidden
 */
export const addHiddenCollectibleToStorage = async (params: {
  network: string;
  publicKey: string;
  contractId: string;
  tokenId: string;
}): Promise<void> => {
  const { network, publicKey, contractId, tokenId } = params;

  try {
    const storage = await getHiddenCollectiblesStorage();

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
    await saveHiddenCollectiblesStorage(storage);
  } catch (error) {
    logger.error(
      "addHiddenCollectibleToStorage",
      "Error adding hidden collectible to storage",
      error,
    );
    throw error;
  }
};

/**
 * Removes a single collectible from hidden collectibles storage
 *
 * @param params The parameters for unhiding a collectible
 * @param params.network The network of the collectible
 * @param params.publicKey The public key of the account
 * @param params.contractId The contract ID of the collectible
 * @param params.tokenId The token ID of the collectible
 * @returns Promise that resolves when the collectible is unhidden
 */
export const removeHiddenCollectibleFromStorage = async (params: {
  network: string;
  publicKey: string;
  contractId: string;
  tokenId: string;
}): Promise<void> => {
  const { network, publicKey, contractId, tokenId } = params;

  try {
    const storage = await getHiddenCollectiblesStorage();

    const collectibleStorage = storage[publicKey]?.[network];

    // Throw an error here in case we find nothing in the storage
    if (!collectibleStorage) {
      throw new Error(
        `Cannot remove hidden collectible: storage not found for publicKey "${publicKey}" and network "${network}"`,
      );
    }

    // Find the contract
    const contractIndex = collectibleStorage.findIndex(
      (contract) => contract.contractId === contractId,
    );

    if (contractIndex >= 0) {
      const contract = collectibleStorage[contractIndex];

      // Remove the token ID
      contract.tokenIds = contract.tokenIds.filter((id) => id !== tokenId);

      // If no more token IDs, remove the contract
      if (contract.tokenIds.length === 0) {
        collectibleStorage.splice(contractIndex, 1);
      }

      // If no more contracts for this network, clean up
      if (collectibleStorage.length === 0) {
        delete storage[publicKey][network];
      }

      // If no more networks for this public key, clean up
      if (Object.keys(storage[publicKey]).length === 0) {
        delete storage[publicKey];
      }

      // Save back to storage
      await saveHiddenCollectiblesStorage(storage);
    }
  } catch (error) {
    logger.error(
      "removeHiddenCollectibleFromStorage",
      "Error removing hidden collectible from storage",
      error,
    );
    throw error;
  }
};
