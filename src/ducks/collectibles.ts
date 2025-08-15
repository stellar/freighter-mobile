import { create } from "zustand";

/**
 * Represents a trait/attribute of a collectible NFT
 */
export interface CollectibleTrait {
  /** The name of the trait (e.g., "Color", "Rarity") */
  name: string;
  /** The value of the trait (e.g., "Blue", "Legendary") */
  value: string | number;
}

/**
 * Represents a single collectible NFT item
 */
export interface Collectible {
  /** Unique identifier for the collection this collectible belongs to */
  collectionAddress: string;
  /** Human-readable name of the collection */
  collectionName: string;
  /** Unique identifier for this specific collectible within the collection */
  tokenId: string;
  /** Human-readable name of the collectible */
  name: string;
  /** URL to the collectible's image */
  image: string;
  /** Detailed description of the collectible */
  description: string;
  /** External URL for more information about the collectible */
  externalUrl: string;
  /** Array of traits/attributes that define this collectible */
  traits: CollectibleTrait[];
}

/**
 * Represents a collection of collectibles grouped by collection address
 */
export interface Collection {
  /** Unique identifier for the collection */
  collectionAddress: string;
  /** Human-readable name of the collection */
  collectionName: string;
  /** Array of collectibles belonging to this collection */
  items: Collectible[];
  /** Total count of collectibles in this collection */
  count: number;
}

/**
 * State interface for the collectibles Zustand store
 */
interface CollectiblesState {
  /** Array of all collectibles */
  collectibles: Collectible[];
  /** Loading state indicator */
  isLoading: boolean;
  /** Error message if fetch fails */
  error: string | null;
  /** Function to fetch collectibles from API */
  fetchCollectibles: () => Promise<void>;
  /** Function to clear any error state */
  clearError: () => void;
}

// Dummy data to test the collectibles UI
const dummyCollectibles: Collectible[] = [
  // Stellar Frogs Collection
  {
    collectionAddress: "GGGStellarFrogsCollection",
    collectionName: "Stellar Frogs",
    tokenId: "1",
    name: "welcomingfrog.xlm",
    image:
      "https://nftcalendar.io/storage/uploads/events/2023/5/NeToOQbYtaJILHMnkigEAsA6ckKYe2GAA4ppAOSp.jpg",
    description:
      "A 3D blue and purple frog with a smooth, shiny texture, standing upright with arms outstretched in a friendly, welcoming gesture. The frog is set against a dark, gradient background.",
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
    collectionAddress: "GGGStellarFrogsCollection",
    collectionName: "Stellar Frogs",
    tokenId: "2",
    name: "pepethebot.xlm",
    image:
      "https://nftcalendar.io/storage/uploads/2024/06/02/pepe-the-bot_ml4cWknXFrF3K3U1.jpeg",
    description:
      "A vibrant green frog with a wide smile, large expressive eyes, and a humanoid posture, set against a dark background. The frog's appearance is reminiscent of the popular Pepe meme.",
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
    collectionAddress: "GGGStellarFrogsCollection",
    collectionName: "Stellar Frogs",
    tokenId: "3",
    name: "princepepe.xlm",
    image:
      "https://nftcalendar.io/storage/uploads/events/2023/8/5kFeYwNfhpUST3TsSoLxm7FaGY1ljwLRgfZ5gQnV.jpg",
    description:
      "A green frog with a golden crown, red lips, and a blue background, evoking a royal and whimsical appearance.",
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
  // Soroban Domains Collection
  {
    collectionAddress: "GGGSorobanDomainsCollection",
    collectionName: "Soroban Domains",
    tokenId: "102510",
    name: "charles.xlm",
    image:
      "https://nftcalendar.io/storage/uploads/events/2025/7/Hdqv6YNVErVCmYlwobFVYfS5BiH19ferUgQova7Z.webp",
    description: "Charles' Soroban username",
    externalUrl: "https://app.sorobandomains.org/domains/charles.xlm",
    traits: [
      { name: "Name", value: "charles" },
      { name: "Length", value: 7 },
      { name: "Character", value: "Alphanumeric" },
      { name: "Type", value: "Domain" },
    ],
  },
  {
    collectionAddress: "GGGSorobanDomainsCollection",
    collectionName: "Soroban Domains",
    tokenId: "102589",
    name: "cassio.xlm",
    image:
      "https://nftcalendar.io/storage/uploads/events/2025/7/MkaASwOL8VA3I5B2iIfCcNGT29vGBp4YZIJgmjzq.jpg",
    description: "Cassio's Soroban username",
    externalUrl: "https://app.sorobandomains.org/domains/cassio.xlm",
    traits: [
      { name: "Name", value: "cassio" },
      { name: "Length", value: 6 },
      { name: "Character", value: "Alphanumeric" },
      { name: "Type", value: "Domain" },
    ],
  },
  // Future Monkeys Collection
  {
    collectionAddress: "GGGFutureMonkeysCollection",
    collectionName: "Future Monkeys",
    tokenId: "111",
    name: "blueauramonkey.xlm",
    image:
      "https://nftcalendar.io/storage/uploads/events/2025/3/oUfeUrSj3KcVnjColyfnS5ICYuqzDbiuqQP4qLIz.png",
    description:
      "A 3D-rendered blue and purple monkey with a glossy, reflective coat, sitting upright and facing forward. The monkey has large, expressive eyes and is surrounded by a glowing purple aura. The background is a soft, dark gradient that accentuates the vibrant colors of the monkey.",
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
];

/**
 * Zustand store for managing collectibles state
 *
 * Provides state management for:
 * - Collectibles data
 * - Loading states
 * - Error handling
 * - Data fetching operations
 */
export const useCollectiblesStore = create<CollectiblesState>((set) => ({
  collectibles: [],
  isLoading: false,
  error: null,

  /**
   * Fetches collectibles from the API
   *
   * Currently uses dummy data for development/testing.
   * TODO: Replace with actual API call to fetch real collectibles data.
   *
   * @returns {Promise<void>} Promise that resolves when fetch completes
   */
  fetchCollectibles: async () => {
    set({ isLoading: true, error: null });

    try {
      // Simulate API call delay
      // eslint-disable-next-line no-promise-executor-return
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // For now, return dummy data
      // TODO: Replace with actual API call
      set({
        collectibles: dummyCollectibles,
        isLoading: false,
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
   * Clears any error state from the store
   */
  clearError: () => {
    set({ error: null });
  },
}));
