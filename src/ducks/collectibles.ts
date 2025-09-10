import { logger } from "config/logger";
import {
  retrieveCollectiblesContracts,
  addCollectibleToStorage,
  removeCollectibleFromStorage,
  transformBackendCollections,
} from "helpers/collectibles";
import { t } from "i18next";
import {
  fetchCollectibles as apiFetchCollectibles,
  BackendCollectionError,
  BackendCollection,
} from "services/backend";
import { create } from "zustand";

/**
 * Represents a trait/attribute of a collectible NFT
 * @interface CollectibleTrait
 */
export interface CollectibleTrait {
  /** The name of the trait (e.g., "Color", "Rarity") */
  name: string;
  /** The value of the trait (e.g., "Blue", "Legendary") */
  value: string | number;
}

/**
 * Represents a single collectible NFT item
 * @interface Collectible
 */
export interface Collectible {
  /** Unique identifier for the collection this collectible belongs to */
  collectionAddress: string;
  /** Human-readable name of the collection */
  collectionName: string;
  /** Unique identifier for this specific collectible within the collection */
  tokenId: string;
  /** Human-readable name of the collectible */
  name?: string;
  /** URL to the collectible's image */
  image?: string;
  /** Detailed description of the collectible */
  description?: string;
  /** External URL for more information about the collectible */
  externalUrl?: string;
  /** Array of traits/attributes that define this collectible */
  traits?: CollectibleTrait[];
}

/**
 * Represents a collection of collectibles grouped by collection address
 * @interface Collection
 */
export interface Collection {
  /** Unique identifier for the collection */
  collectionAddress: string;
  /** Human-readable name of the collection */
  collectionName: string;
  /** Symbol/ticker for the collection */
  collectionSymbol: string;
  /** Array of collectibles belonging to this collection */
  items: Collectible[];
  /** Total count of collectibles in this collection */
  count: number;
}

/**
 * State interface for the collectibles Zustand store
 * @interface CollectiblesState
 */
interface CollectiblesState {
  /** Array of collections */
  collections: Collection[];
  /** Loading state indicator */
  isLoading: boolean;
  /** Error message if fetch fails */
  error: string | null;
  /** Function to fetch collectibles from API */
  fetchCollectibles: (params: {
    publicKey: string;
    network: string;
  }) => Promise<void>;
  /** Function to add a single collectible after validation */
  addCollectible: (params: {
    publicKey: string;
    network: string;
    contractId: string;
    tokenId: string;
  }) => Promise<void>;
  /** Function to remove a single collectible from local storage */
  removeCollectible: (params: {
    publicKey: string;
    network: string;
    contractId: string;
    tokenId: string;
  }) => Promise<void>;
  /** Function to check if a collectible already exists */
  checkCollectibleExists: (params: {
    contractId: string;
    tokenId: string;
  }) => boolean;
  /** Function to clear any error state */
  clearError: () => void;
  /** Function to find a collection by its collection address */
  getCollection: (collectionAddress: string) => Collection | undefined;
  /** Function to find a specific collectible by its collection address and token ID */
  getCollectible: (params: {
    collectionAddress: string;
    tokenId: string;
  }) => Collectible | undefined;
}

/*
// Dummy data to test the collectibles UI
const dummyCollections: Collection[] = [
  // Stellar Frogs Collection
  {
    collectionAddress: "CAS3J7GYLGXMF6TDJBBYYSE3HW6BBSMLNUQ34T6TZMYMW2EVH34XOWMA", // Using XLM contract address for testing
    collectionName: "Stellar Frogs",
    collectionSymbol: "SFROG",
    count: 3,
    items: [
      {
        collectionAddress: "CAS3J7GYLGXMF6TDJBBYYSE3HW6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
        collectionName: "Stellar Frogs",
        tokenId: "1",
        name: "welcomingfrog.xlm",
        image: "https://nftcalendar.io/storage/uploads/events/2023/5/NeToOQbYtaJILHMnkigEAsA6ckKYe2GAA4ppAOSp.jpg",
        description: "A 3D blue and purple frog with a smooth, shiny texture, standing upright with arms outstretched in a friendly, welcoming gesture. The frog is set against a dark, gradient background.",
        externalUrl: "https://nftcalendar.io/event/hairy-frog/",
        traits: [
          { name: "Color", value: "Blue/Purple" },
          { name: "Texture", value: "Smooth" },
          { name: "Pose", value: "Outstretched Arms" },
          { name: "Mood", value: "Welcoming" },
          { name: "Background", value: "Dark Gradient" },
        ],
      },
      {
        collectionAddress: "CAS3J7GYLGXMF6TDJBBYYSE3HW6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
        collectionName: "Stellar Frogs",
        tokenId: "2",
        name: "pepethebot.xlm",
        image: "https://nftcalendar.io/storage/uploads/2024/06/02/pepe-the-bot_ml4cWknXFrF3K3U1.jpeg",
        description: "A vibrant green frog with a wide smile, large expressive eyes, and a humanoid posture, set against a dark background. The frog's appearance is reminiscent of the popular Pepe meme.",
        externalUrl: "https://nftcalendar.io/event/pepe-the-bot/",
        traits: [
          { name: "Color", value: "Bright Green" },
          { name: "Expression", value: "Smiling" },
          { name: "Eyes", value: "Large" },
          { name: "Background", value: "Dark" },
          { name: "Theme", value: "Meme" },
          { name: "Rarity", value: "Epic" },
        ],
      },
      {
        collectionAddress: "CAS3J7GYLGXMF6TDJBBYYSE3HW6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
        collectionName: "Stellar Frogs",
        tokenId: "3",
        name: "princepepe.xlm",
        image: "https://nftcalendar.io/storage/uploads/events/2023/8/5kFeYwNfhpUST3TsSoLxm7FaGY1ljwLRgfZ5gQnV.jpg",
        description: "A green frog with a golden crown, red lips, and a blue background, evoking a royal and whimsical appearance.",
        externalUrl: "https://nftcalendar.io/event/prince-pepe/",
        traits: [
          { name: "Color", value: "Green" },
          { name: "Accessory", value: "Golden Crown" },
          { name: "Mouth", value: "Red Lips" },
          { name: "Background", value: "Blue" },
          { name: "Theme", value: "Royal" },
          { name: "Rarity", value: "Legendary" },
        ],
      },
    ],
  },
  // Soroban Domains Collection
  {
    collectionAddress: "CCCSorobanDomainsCollection",
    collectionName: "Soroban Domains",
    collectionSymbol: "SDOM",
    count: 2,
    items: [
      {
        collectionAddress: "CCCSorobanDomainsCollection",
        collectionName: "Soroban Domains",
        tokenId: "102510",
        name: "charles.xlm",
        image: "https://nftcalendar.io/storage/uploads/events/2025/7/Hdqv6YNVErVCmYlwobFVYfS5BiH19ferUgQova7Z.webp",
        description: "The protocol to register your Soroban username",
        externalUrl: "https://app.sorobandomains.org/domains/charles.xlm",
        traits: [
          { name: "Name", value: "charles" },
          { name: "Length", value: 7 },
          { name: "Character", value: "Alphanumeric" },
        ],
      },
      {
        collectionAddress: "CCCSorobanDomainsCollection",
        collectionName: "Soroban Domains",
        tokenId: "102589",
        name: "cassio.xlm",
        image: "https://nftcalendar.io/storage/uploads/events/2025/7/MkaASwOL8VA3I5B2iIfCcNGT29vGBp4YZIJgmjzq.jpg",
        description: "Cassio's Soroban username",
        externalUrl: "https://app.sorobandomains.org/domains/cassio.xlm",
        traits: [
          { name: "Name", value: "cassio" },
          { name: "Length", value: 6 },
          { name: "Character", value: "Alphanumeric" },
          { name: "Type", value: "Domain" },
        ],
      },
    ],
  },
  // Future Monkeys Collection
  {
    collectionAddress: "CCCFutureMonkeysCollection",
    collectionName: "Future Monkeys",
    collectionSymbol: "FMONK",
    count: 1,
    items: [
      {
        collectionAddress: "CCCFutureMonkeysCollection",
        collectionName: "Future Monkeys",
        tokenId: "111",
        name: "blueauramonkey.xlm",
        image: "https://nftcalendar.io/storage/uploads/events/2025/3/oUfeUrSj3KcVnjColyfnS5ICYuqzDbiuqQP4qLIz.png",
        description: "A 3D-rendered blue and purple monkey with a glossy, reflective coat, sitting upright and facing forward. The monkey has large, expressive eyes and is surrounded by a glowing purple aura. The background is a soft, dark gradient that accentuates the vibrant colors of the monkey.",
        externalUrl: "https://nftcalendar.io/event/future-monkeys/",
        traits: [
          { name: "Species", value: "Monkey" },
          { name: "Color", value: "Blue and Purple" },
          { name: "Coat", value: "Glossy" },
          { name: "Aura", value: "Glowing Purple" },
          { name: "Eyes", value: "Large" },
          { name: "Background", value: "Soft Dark Gradient" },
        ],
      },
    ],
  },
];
*/

/**
 * Zustand store for managing collectibles state
 *
 * Provides state management for:
 * - Collections data
 * - Loading states
 * - Error handling
 * - Data fetching operations
 * - Local storage synchronization
 *
 * @example
 * ```ts
 * const { collections, fetchCollectibles, addCollectible } = useCollectiblesStore();
 *
 * // Fetch collectibles for an account
 * await fetchCollectibles({
 *   publicKey: "GCMTT4N6CZ5CU7JTKDLVUCDK4JZVFQCRUVQJ7BMKYSJWCSIDG3BIW4PH",
 *   network: "PUBLIC"
 * });
 *
 * // Add a new collectible
 * await addCollectible({
 *   publicKey: "GCMTT4N6CZ5CU7JTKDLVUCDK4JZVFQCRUVQJ7BMKYSJWCSIDG3BIW4PH",
 *   network: "PUBLIC",
 *   contractId: "CCBWOUL7XW5XSWD3UKL76VWLLFCSZP4D4GUSCFBHUQCEAW23QVKJZ7ON",
 *   tokenId: "123"
 * });
 * ```
 *
 * @returns {CollectiblesState} The collectibles store state and actions
 */
export const useCollectiblesStore = create<CollectiblesState>((set, get) => ({
  collections: [],
  isLoading: false,
  error: null,

  /**
   * Fetches collectibles from the API and updates the store
   *
   * Retrieves collectibles from local storage contracts and fetches their metadata
   * from the backend API. Filters out error collections and only includes collectibles
   * owned by the specified public key.
   *
   * @param {Object} params - Parameters for fetching collectibles
   * @param {string} params.publicKey - The public key of the account to fetch collectibles for
   * @param {string} params.network - The network to query (mainnet/testnet)
   * @returns {Promise<void>} Promise that resolves when fetch completes
   * @throws {Error} When API request fails or data transformation fails
   *
   * @example
   * ```ts
   * await fetchCollectibles({
   *   publicKey: "GCMTT4N6CZ5CU7JTKDLVUCDK4JZVFQCRUVQJ7BMKYSJWCSIDG3BIW4PH",
   *   network: "PUBLIC"
   * });
   * ```
   */
  fetchCollectibles: async ({
    publicKey,
    network,
  }: {
    publicKey: string;
    network: string;
  }) => {
    set({ isLoading: true });

    try {
      // Retrieve collectible contracts from local storage
      const collectiblesContracts = await retrieveCollectiblesContracts({
        network,
        publicKey,
      });

      // Transform local storage data to API format
      const contracts = collectiblesContracts.map((contract) => ({
        id: contract.contractId,
        token_ids: contract.tokenIds,
      }));

      // Fetch collectibles from API using stored contracts
      const collections = await apiFetchCollectibles({
        owner: publicKey,
        contracts,
      });

      // Filter collections that are an error
      const errorCollections = collections.filter(
        (collection) => "error" in collection,
      );
      if (errorCollections.length > 0) {
        errorCollections.forEach((errorCollection) => {
          const { error } = errorCollection;

          // Let's silently log the backend errors so we keep track of it on Sentry
          if (
            error.tokens &&
            Array.isArray(error.tokens) &&
            error.tokens.length > 0
          ) {
            error.tokens.forEach((token) => {
              logger.error(
                "fetchCollectibles",
                `Error in token ${token.token_id} of collection ${error.collection_address}`,
                token.error_message,
              );
            });
          } else {
            logger.error(
              "fetchCollectibles",
              `Error in collection ${error.collection_address}`,
              error.error_message,
            );
          }
        });
      }

      // Filter collections that are owned by the publicKey
      const backendCollections = collections.filter(
        (collection) => "collection" in collection,
      );
      const ownedCollections = backendCollections
        .map(({ collection }) => ({
          // Add collectibles that are owned by the publicKey
          collection: {
            ...collection,
            collectibles: (collection.collectibles || []).filter(
              (item) => item?.owner === publicKey,
            ),
          },
        }))
        .filter(({ collection }) => collection.collectibles.length > 0);

      // Transform backend collections to frontend Collection interface
      const transformedCollections =
        await transformBackendCollections(ownedCollections);

      // Set the transformed collections
      set({
        collections: transformedCollections,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch collectibles",
        isLoading: false,
      });
    }
  },

  /**
   * Adds a single collectible to the store and local storage after validation
   *
   * Validates the collectible exists and is owned by the specified public key,
   * then adds it to local storage and refreshes the collections.
   *
   * @param {Object} params - Parameters for adding a collectible
   * @param {string} params.publicKey - The public key of the account owning the collectible
   * @param {string} params.network - The network of the collectible
   * @param {string} params.contractId - The contract ID of the collectible
   * @param {string} params.tokenId - The token ID of the collectible
   * @returns {Promise<void>} Promise that resolves when add completes
   * @throws {Error} When parameters are invalid, collectible doesn't exist, or API fails
   *
   * @example
   * ```ts
   * await addCollectible({
   *   publicKey: "GCMTT4N6CZ5CU7JTKDLVUCDK4JZVFQCRUVQJ7BMKYSJWCSIDG3BIW4PH",
   *   network: "PUBLIC",
   *   contractId: "CCBWOUL7XW5XSWD3UKL76VWLLFCSZP4D4GUSCFBHUQCEAW23QVKJZ7ON",
   *   tokenId: "123"
   * });
   * ```
   */
  addCollectible: async ({
    publicKey,
    network,
    contractId,
    tokenId,
  }: {
    publicKey: string;
    network: string;
    contractId: string;
    tokenId: string;
  }) => {
    set({ isLoading: true, error: null });

    try {
      // Fetch the single collectible from the API
      const collections = await apiFetchCollectibles({
        owner: publicKey,
        contracts: [
          {
            id: contractId,
            token_ids: [tokenId],
          },
        ],
      });

      const collectibleError = collections?.find(
        (c) => "error" in c && c.error.collection_address === contractId,
      ) as BackendCollectionError;
      if (collectibleError) {
        const collectionErrorMessage = collectibleError.error.error_message;
        const tokenErrorMessage = collectibleError.error.tokens?.find(
          (tk) => tk.token_id === tokenId,
        )?.error_message;

        // Let's log the backend error so we keep track of it on Sentry
        logger.error(
          "addCollectible",
          "Failed to add collectible",
          tokenErrorMessage ||
            collectionErrorMessage ||
            "Failed to add collectible.",
        );

        throw new Error(t("collectibles.errors.invalidAddressOrTokenId"));
      }

      const collection = collections?.find(
        (c) => "collection" in c && c.collection.address === contractId,
      ) as BackendCollection;
      // Validate that we receive a collection for the given address
      if (!collection) {
        throw new Error(t("collectibles.errors.collectionNotFound"));
      }

      const collectible = collection.collection.collectibles.find(
        (c) => c.token_id === tokenId && c.owner === publicKey,
      );
      // Validate that the collectible is owned by the public key
      if (!collectible) {
        throw new Error(t("collectibles.errors.notOwnedByUser"));
      }

      // Save the collectible to local storage
      await addCollectibleToStorage({
        network,
        publicKey,
        contractId,
        tokenId,
      });

      // Re-fetch collections to include the new collectible
      await get().fetchCollectibles({ publicKey, network });

      set({ isLoading: false, error: null });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : t("collectibles.errors.failedToAdd"),
        isLoading: false,
      });

      throw error;
    }
  },

  /**
   * Removes a single collectible from local storage and updates the store
   *
   * Removes the collectible from local storage and refreshes the collections
   * to reflect the removal.
   *
   * @param {Object} params - Parameters for removing a collectible
   * @param {string} params.publicKey - The public key of the account owning the collectible
   * @param {string} params.network - The network of the collectible
   * @param {string} params.contractId - The contract ID of the collectible
   * @param {string} params.tokenId - The token ID of the collectible
   * @returns {Promise<void>} Promise that resolves when remove completes
   * @throws {Error} When parameters are invalid or storage operation fails
   *
   * @example
   * ```ts
   * await removeCollectible({
   *   publicKey: "GCMTT4N6CZ5CU7JTKDLVUCDK4JZVFQCRUVQJ7BMKYSJWCSIDG3BIW4PH",
   *   network: "PUBLIC",
   *   contractId: "CCBWOUL7XW5XSWD3UKL76VWLLFCSZP4D4GUSCFBHUQCEAW23QVKJZ7ON",
   *   tokenId: "123"
   * });
   * ```
   */
  removeCollectible: async ({
    publicKey,
    network,
    contractId,
    tokenId,
  }: {
    publicKey: string;
    network: string;
    contractId: string;
    tokenId: string;
  }) => {
    set({ isLoading: true, error: null });

    try {
      // Remove the collectible from local storage
      await removeCollectibleFromStorage({
        network,
        publicKey,
        contractId,
        tokenId,
      });

      // Re-fetch collections to reflect the removal
      await get().fetchCollectibles({ publicKey, network });

      set({ isLoading: false, error: null });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : t("collectibles.errors.failedToRemove"),
        isLoading: false,
      });
    }
  },

  /**
   * Checks if a collectible already exists in the current collections
   *
   * Searches through all collections to find a collectible with the specified
   * contract ID and token ID.
   *
   * @param {Object} params - Parameters for checking collectible existence
   * @param {string} params.contractId - The contract ID of the collectible
   * @param {string} params.tokenId - The token ID of the collectible
   * @returns {boolean} True if the collectible exists, false otherwise
   *
   * @example
   * ```ts
   * const exists = checkCollectibleExists({
   *   contractId: "CCBWOUL7XW5XSWD3UKL76VWLLFCSZP4D4GUSCFBHUQCEAW23QVKJZ7ON",
   *   tokenId: "123"
   * });
   * ```
   */
  checkCollectibleExists: ({
    contractId,
    tokenId,
  }: {
    contractId: string;
    tokenId: string;
  }): boolean => {
    const state = get();

    // Check if the collectible exists in the current collections
    const existingCollectible = state.collections
      .find((collection) => collection.collectionAddress === contractId)
      ?.items.find((item) => item.tokenId === tokenId);

    return !!existingCollectible;
  },

  /**
   * Clears any error state from the store
   *
   * Resets the error field to null, removing any error messages.
   *
   * @example
   * ```ts
   * clearError(); // Clears any existing error state
   * ```
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * Finds a collection by its collection address
   *
   * Searches through all collections to find one with the specified address.
   *
   * @param {string} collectionAddress - The address of the collection to find
   * @returns {Collection | undefined} The collection if found, otherwise undefined
   *
   * @example
   * ```ts
   * const collection = getCollection("CCBWOUL7XW5XSWD3UKL76VWLLFCSZP4D4GUSCFBHUQCEAW23QVKJZ7ON");
   * if (collection) {
   *   console.log(`Found collection: ${collection.collectionName}`);
   * }
   * ```
   */
  getCollection: (collectionAddress: string) =>
    get().collections.find(
      (collection) => collection.collectionAddress === collectionAddress,
    ),

  /**
   * Finds a specific collectible by its collection address and token ID
   *
   * Searches through all collections to find a collectible with the specified
   * collection address and token ID.
   *
   * @param {Object} params - Parameters for finding a collectible
   * @param {string} params.collectionAddress - The address of the collection
   * @param {string} params.tokenId - The token ID of the collectible
   * @returns {Collectible | undefined} The collectible if found, otherwise undefined
   *
   * @example
   * ```ts
   * const collectible = getCollectible({
   *   collectionAddress: "CCBWOUL7XW5XSWD3UKL76VWLLFCSZP4D4GUSCFBHUQCEAW23QVKJZ7ON",
   *   tokenId: "123"
   * });
   * if (collectible) {
   *   console.log(`Found collectible: ${collectible.name}`);
   * }
   * ```
   */
  getCollectible: ({
    collectionAddress,
    tokenId,
  }: {
    collectionAddress: string;
    tokenId: string;
  }) =>
    get()
      .collections.find(
        (collection) => collection.collectionAddress === collectionAddress,
      )
      ?.items.find((item) => item.tokenId === tokenId),
}));
