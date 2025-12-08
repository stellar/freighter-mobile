import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import {
  addCollectibleToStorage,
  addHiddenCollectibleToStorage,
  getCollectiblesStorage,
  getHiddenCollectiblesStorage,
  removeCollectibleFromStorage,
  removeHiddenCollectibleFromStorage,
  retrieveCollectiblesContracts,
  retrieveHiddenCollectibles,
  saveCollectiblesStorage,
  saveHiddenCollectiblesStorage,
  transformBackendCollections,
} from "helpers/collectibles";
import { dataStorage } from "services/storage/storageFactory";

// Mock dependencies
jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("services/storage/storageFactory", () => ({
  dataStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock("i18next", () => ({
  t: jest.fn((key: string, options?: any) => {
    const translations: Record<string, string> = {
      "collectibles.fallbacks.tokenName": `Token #${options?.tokenId || ""}`,
      "collectibles.fallbacks.unknownTrait": "Unknown",
      "collectibles.fallbacks.descriptionUnavailable":
        "Description unavailable",
    };
    return translations[key] || key;
  }),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe("collectibles helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getCollectiblesStorage", () => {
    it("returns empty object when no storage data exists", async () => {
      (dataStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await getCollectiblesStorage();

      expect(result).toEqual({});
      expect(dataStorage.getItem).toHaveBeenCalledWith(
        STORAGE_KEYS.COLLECTIBLES_LIST,
      );
    });

    it("returns parsed storage data when valid JSON exists", async () => {
      const mockStorage = { "test-key": { testnet: [] } };
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockStorage),
      );

      const result = await getCollectiblesStorage();

      expect(result).toEqual(mockStorage);
    });

    it("returns empty object and logs error when JSON parsing fails", async () => {
      (dataStorage.getItem as jest.Mock).mockResolvedValue("invalid-json");

      const result = await getCollectiblesStorage();

      expect(result).toEqual({});
      expect(logger.error).toHaveBeenCalledWith(
        "getCollectiblesStorage",
        "Error parsing collectibles storage",
        expect.any(Error),
      );
    });
  });

  describe("saveCollectiblesStorage", () => {
    it("saves storage data as JSON string", async () => {
      const mockStorage = { "test-key": { testnet: [] } };
      (dataStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await saveCollectiblesStorage(mockStorage);

      expect(dataStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.COLLECTIBLES_LIST,
        JSON.stringify(mockStorage),
      );
    });
  });

  describe("retrieveCollectiblesContracts", () => {
    it("returns contracts for existing publicKey and network", async () => {
      const mockContracts = [
        { contractId: "contract1", tokenIds: ["token1", "token2"] },
        { contractId: "contract2", tokenIds: ["token3"] },
      ];
      const mockStorage = {
        "test-public-key": {
          testnet: mockContracts,
        },
      };
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockStorage),
      );

      const result = await retrieveCollectiblesContracts({
        network: "testnet",
        publicKey: "test-public-key",
      });

      expect(result).toEqual(mockContracts);
    });

    it("returns empty array when publicKey does not exist", async () => {
      const mockStorage = {};
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockStorage),
      );

      const result = await retrieveCollectiblesContracts({
        network: "testnet",
        publicKey: "non-existent-key",
      });

      expect(result).toEqual([]);
    });

    it("returns empty array when network does not exist", async () => {
      const mockStorage = {
        "test-public-key": {
          mainnet: [],
        },
      };
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockStorage),
      );

      const result = await retrieveCollectiblesContracts({
        network: "testnet",
        publicKey: "test-public-key",
      });

      expect(result).toEqual([]);
    });

    it("returns empty array and logs error when storage access fails", async () => {
      (dataStorage.getItem as jest.Mock).mockRejectedValue(
        new Error("Storage error"),
      );

      const result = await retrieveCollectiblesContracts({
        network: "testnet",
        publicKey: "test-public-key",
      });

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        "retrieveCollectiblesContracts",
        "Error retrieving collectibles contracts:",
        expect.any(Error),
      );
    });
  });

  describe("addCollectibleToStorage", () => {
    it("adds new contract when it does not exist", async () => {
      const mockStorage = {};
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockStorage),
      );
      (dataStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await addCollectibleToStorage({
        network: "testnet",
        publicKey: "test-public-key",
        contractId: "contract1",
        tokenId: "token1",
      });

      const expectedStorage = {
        "test-public-key": {
          testnet: [{ contractId: "contract1", tokenIds: ["token1"] }],
        },
      };

      expect(dataStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.COLLECTIBLES_LIST,
        JSON.stringify(expectedStorage),
      );
    });

    it("adds tokenId to existing contract", async () => {
      const mockStorage = {
        "test-public-key": {
          testnet: [{ contractId: "contract1", tokenIds: ["token1"] }],
        },
      };
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockStorage),
      );
      (dataStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await addCollectibleToStorage({
        network: "testnet",
        publicKey: "test-public-key",
        contractId: "contract1",
        tokenId: "token2",
      });

      const expectedStorage = {
        "test-public-key": {
          testnet: [
            { contractId: "contract1", tokenIds: ["token1", "token2"] },
          ],
        },
      };

      expect(dataStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.COLLECTIBLES_LIST,
        JSON.stringify(expectedStorage),
      );
    });

    it("does not add duplicate tokenId", async () => {
      const mockStorage = {
        "test-public-key": {
          testnet: [{ contractId: "contract1", tokenIds: ["token1"] }],
        },
      };
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockStorage),
      );
      (dataStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await addCollectibleToStorage({
        network: "testnet",
        publicKey: "test-public-key",
        contractId: "contract1",
        tokenId: "token1", // Same tokenId
      });

      const expectedStorage = {
        "test-public-key": {
          testnet: [{ contractId: "contract1", tokenIds: ["token1"] }],
        },
      };

      expect(dataStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.COLLECTIBLES_LIST,
        JSON.stringify(expectedStorage),
      );
    });

    it("throws error when storage operation fails", async () => {
      (dataStorage.getItem as jest.Mock).mockRejectedValue(
        new Error("Storage error"),
      );

      await expect(
        addCollectibleToStorage({
          network: "testnet",
          publicKey: "test-public-key",
          contractId: "contract1",
          tokenId: "token1",
        }),
      ).rejects.toThrow("Storage error");

      expect(logger.error).toHaveBeenCalledWith(
        "addCollectibleToStorage",
        "Error adding collectible to storage",
        expect.any(Error),
      );
    });
  });

  describe("removeCollectibleFromStorage", () => {
    it("removes tokenId from existing contract", async () => {
      const mockStorage = {
        "test-public-key": {
          testnet: [
            { contractId: "contract1", tokenIds: ["token1", "token2"] },
          ],
        },
      };
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockStorage),
      );
      (dataStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await removeCollectibleFromStorage({
        network: "testnet",
        publicKey: "test-public-key",
        contractId: "contract1",
        tokenId: "token1",
      });

      const expectedStorage = {
        "test-public-key": {
          testnet: [{ contractId: "contract1", tokenIds: ["token2"] }],
        },
      };

      expect(dataStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.COLLECTIBLES_LIST,
        JSON.stringify(expectedStorage),
      );
    });

    it("removes entire contract when no tokenIds remain", async () => {
      const mockStorage = {
        "test-public-key": {
          testnet: [{ contractId: "contract1", tokenIds: ["token1"] }],
          mainnet: [{ contractId: "contract2", tokenIds: ["token2"] }], // Keep another network
        },
      };
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockStorage),
      );
      (dataStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await removeCollectibleFromStorage({
        network: "testnet",
        publicKey: "test-public-key",
        contractId: "contract1",
        tokenId: "token1",
      });

      const expectedStorage = {
        "test-public-key": {
          mainnet: [{ contractId: "contract2", tokenIds: ["token2"] }],
        },
      };

      expect(dataStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.COLLECTIBLES_LIST,
        JSON.stringify(expectedStorage),
      );
    });

    it("removes entire publicKey when no networks remain", async () => {
      const mockStorage = {
        "test-public-key": {
          testnet: [{ contractId: "contract1", tokenIds: ["token1"] }],
        },
      };
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockStorage),
      );
      (dataStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await removeCollectibleFromStorage({
        network: "testnet",
        publicKey: "test-public-key",
        contractId: "contract1",
        tokenId: "token1",
      });

      const expectedStorage = {};

      expect(dataStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.COLLECTIBLES_LIST,
        JSON.stringify(expectedStorage),
      );
    });

    it("does nothing when publicKey does not exist", async () => {
      const mockStorage = {};
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockStorage),
      );

      await removeCollectibleFromStorage({
        network: "testnet",
        publicKey: "non-existent-key",
        contractId: "contract1",
        tokenId: "token1",
      });

      expect(dataStorage.setItem).not.toHaveBeenCalled();
    });

    it("does nothing when network does not exist", async () => {
      const mockStorage = {
        "test-public-key": {
          mainnet: [],
        },
      };
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockStorage),
      );

      await removeCollectibleFromStorage({
        network: "testnet",
        publicKey: "test-public-key",
        contractId: "contract1",
        tokenId: "token1",
      });

      expect(dataStorage.setItem).not.toHaveBeenCalled();
    });

    it("does nothing when contract does not exist", async () => {
      const mockStorage = {
        "test-public-key": {
          testnet: [{ contractId: "contract2", tokenIds: ["token1"] }],
        },
      };
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockStorage),
      );

      await removeCollectibleFromStorage({
        network: "testnet",
        publicKey: "test-public-key",
        contractId: "contract1", // Non-existent contract
        tokenId: "token1",
      });

      expect(dataStorage.setItem).not.toHaveBeenCalled();
    });

    it("throws error when storage operation fails", async () => {
      (dataStorage.getItem as jest.Mock).mockRejectedValue(
        new Error("Storage error"),
      );

      await expect(
        removeCollectibleFromStorage({
          network: "testnet",
          publicKey: "test-public-key",
          contractId: "contract1",
          tokenId: "token1",
        }),
      ).rejects.toThrow("Storage error");

      expect(logger.error).toHaveBeenCalledWith(
        "removeCollectibleFromStorage",
        "Error removing collectible from storage",
        expect.any(Error),
      );
    });
  });

  describe("transformBackendCollections", () => {
    const mockBackendCollections = [
      {
        collection: {
          address: "collection1",
          name: "Test Collection",
          symbol: "TC",
          collectibles: [
            {
              owner: "test-owner-address",
              token_id: "token1",
              token_uri: "https://example.com/metadata1.json",
            },
            {
              owner: "test-owner-address",
              token_id: "token2",
              token_uri: "https://example.com/metadata2.json",
            },
          ],
        },
      },
    ];

    const mockMetadata = {
      name: "Test NFT",
      description: "A test NFT",
      image: "https://example.com/image.jpg",
      external_url: "https://example.com/external",
      attributes: [
        { trait_type: "Color", value: "Blue" },
        { trait_type: "Rarity", value: "Common" },
      ],
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockMetadata),
      });
    });

    it("transforms backend collections to frontend format", async () => {
      const result = await transformBackendCollections(mockBackendCollections);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        collectionAddress: "collection1",
        collectionName: "Test Collection",
        collectionSymbol: "TC",
        count: 2,
        items: [
          {
            collectionAddress: "collection1",
            collectionName: "Test Collection",
            tokenId: "token1",
            name: "Test NFT",
            image: "https://example.com/image.jpg",
            description: "A test NFT",
            externalUrl: "https://example.com/external",
            traits: [
              { name: "Color", value: "Blue" },
              { name: "Rarity", value: "Common" },
            ],
            isHidden: false,
          },
          {
            collectionAddress: "collection1",
            collectionName: "Test Collection",
            tokenId: "token2",
            name: "Test NFT",
            image: "https://example.com/image.jpg",
            description: "A test NFT",
            externalUrl: "https://example.com/external",
            traits: [
              { name: "Color", value: "Blue" },
              { name: "Rarity", value: "Common" },
            ],
            isHidden: false,
          },
        ],
      });
    });

    it("handles metadata fetch failure with fallback", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const result = await transformBackendCollections(mockBackendCollections);

      expect(result[0].items[0]).toEqual({
        collectionAddress: "collection1",
        collectionName: "Test Collection",
        tokenId: "token1",
        name: "Token #token1",
        image: "",
        description: "Description unavailable",
        externalUrl: "",
        traits: [],
        isHidden: false,
      });

      expect(logger.error).toHaveBeenCalledWith(
        "transformBackendCollections",
        "Failed to fetch metadata for token token1:",
        expect.any(Error),
      );
    });

    it("handles missing metadata fields with fallbacks", async () => {
      const incompleteMetadata = {
        image: "https://example.com/image.jpg",
        attributes: [
          { value: "Blue" }, // Missing trait_type
          { trait_type: "Rarity" }, // Missing value
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(incompleteMetadata),
      });

      const result = await transformBackendCollections(mockBackendCollections);

      expect(result[0].items[0]).toEqual({
        collectionAddress: "collection1",
        collectionName: "Test Collection",
        tokenId: "token1",
        name: "Token #token1", // Fallback name
        image: "https://example.com/image.jpg",
        description: undefined,
        externalUrl: undefined,
        traits: [
          { name: "Unknown", value: "Blue" }, // Fallback trait_type
          { name: "Rarity", value: "" }, // Empty value for missing value
        ],
        isHidden: false,
      });
    });

    it("handles HTTP error responses", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: "Not Found",
      });

      const result = await transformBackendCollections(mockBackendCollections);

      expect(result[0].items[0]).toEqual({
        collectionAddress: "collection1",
        collectionName: "Test Collection",
        tokenId: "token1",
        name: "Token #token1",
        image: "",
        description: "Description unavailable",
        externalUrl: "",
        traits: [],
        isHidden: false,
      });

      expect(logger.error).toHaveBeenCalledWith(
        "transformBackendCollections",
        "Failed to fetch metadata for token token1:",
        expect.any(Error),
      );
    });

    it("throws error when transformation fails", async () => {
      // @ts-expect-error Testing invalid input type
      await expect(transformBackendCollections(null)).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        "transformBackendCollections",
        "Error transforming backend collections:",
        expect.any(Error),
      );
    });

    it("sets isHidden to true when collectible is in hidden list", async () => {
      const hiddenCollectiblesContracts = [
        {
          contractId: "collection1",
          tokenIds: ["token1"],
        },
      ];

      const result = await transformBackendCollections(
        mockBackendCollections,
        hiddenCollectiblesContracts,
      );

      expect(result[0].items[0].isHidden).toBe(true);
      expect(result[0].items[1].isHidden).toBe(false);
    });

    it("sets isHidden to false when no hidden collectibles provided", async () => {
      const result = await transformBackendCollections(
        mockBackendCollections,
        undefined,
      );

      expect(result[0].items[0].isHidden).toBe(false);
      expect(result[0].items[1].isHidden).toBe(false);
    });
  });

  describe("hidden collectibles storage", () => {
    describe("getHiddenCollectiblesStorage", () => {
      it("returns empty object when no storage data exists", async () => {
        (dataStorage.getItem as jest.Mock).mockResolvedValue(null);

        const result = await getHiddenCollectiblesStorage();

        expect(result).toEqual({});
        expect(dataStorage.getItem).toHaveBeenCalledWith(
          STORAGE_KEYS.HIDDEN_COLLECTIBLES_LIST,
        );
      });

      it("returns parsed storage data when valid JSON exists", async () => {
        const mockStorage = { "test-key": { testnet: [] } };
        (dataStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify(mockStorage),
        );

        const result = await getHiddenCollectiblesStorage();

        expect(result).toEqual(mockStorage);
      });

      it("returns empty object and logs error when JSON parsing fails", async () => {
        (dataStorage.getItem as jest.Mock).mockResolvedValue("invalid-json");

        const result = await getHiddenCollectiblesStorage();

        expect(result).toEqual({});
        expect(logger.error).toHaveBeenCalledWith(
          "getHiddenCollectiblesStorage",
          "Error parsing hidden collectibles storage",
          expect.any(Error),
        );
      });
    });

    describe("saveHiddenCollectiblesStorage", () => {
      it("saves storage data as JSON string", async () => {
        const mockStorage = { "test-key": { testnet: [] } };
        (dataStorage.setItem as jest.Mock).mockResolvedValue(undefined);

        await saveHiddenCollectiblesStorage(mockStorage);

        expect(dataStorage.setItem).toHaveBeenCalledWith(
          STORAGE_KEYS.HIDDEN_COLLECTIBLES_LIST,
          JSON.stringify(mockStorage),
        );
      });
    });

    describe("retrieveHiddenCollectibles", () => {
      it("returns hidden collectibles for existing publicKey and network", async () => {
        const mockHiddenCollectibles = [
          { contractId: "contract1", tokenIds: ["token1", "token2"] },
          { contractId: "contract2", tokenIds: ["token3"] },
        ];
        const mockStorage = {
          "test-public-key": {
            testnet: mockHiddenCollectibles,
          },
        };
        (dataStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify(mockStorage),
        );

        const result = await retrieveHiddenCollectibles({
          network: "testnet",
          publicKey: "test-public-key",
        });

        expect(result).toEqual(mockHiddenCollectibles);
      });

      it("returns empty array when publicKey does not exist", async () => {
        const mockStorage = {};
        (dataStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify(mockStorage),
        );

        const result = await retrieveHiddenCollectibles({
          network: "testnet",
          publicKey: "non-existent-key",
        });

        expect(result).toEqual([]);
      });

      it("returns empty array and logs error when storage access fails", async () => {
        (dataStorage.getItem as jest.Mock).mockRejectedValue(
          new Error("Storage error"),
        );

        const result = await retrieveHiddenCollectibles({
          network: "testnet",
          publicKey: "test-public-key",
        });

        expect(result).toEqual([]);
        expect(logger.error).toHaveBeenCalledWith(
          "retrieveHiddenCollectibles",
          "Error retrieving hidden collectibles:",
          expect.any(Error),
        );
      });
    });

    describe("addHiddenCollectibleToStorage", () => {
      it("adds new hidden collectible when contract does not exist", async () => {
        const mockStorage = {};
        (dataStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify(mockStorage),
        );
        (dataStorage.setItem as jest.Mock).mockResolvedValue(undefined);

        await addHiddenCollectibleToStorage({
          network: "testnet",
          publicKey: "test-public-key",
          contractId: "contract1",
          tokenId: "token1",
        });

        const expectedStorage = {
          "test-public-key": {
            testnet: [{ contractId: "contract1", tokenIds: ["token1"] }],
          },
        };

        expect(dataStorage.setItem).toHaveBeenCalledWith(
          STORAGE_KEYS.HIDDEN_COLLECTIBLES_LIST,
          JSON.stringify(expectedStorage),
        );
      });

      it("adds tokenId to existing hidden contract", async () => {
        const mockStorage = {
          "test-public-key": {
            testnet: [{ contractId: "contract1", tokenIds: ["token1"] }],
          },
        };
        (dataStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify(mockStorage),
        );
        (dataStorage.setItem as jest.Mock).mockResolvedValue(undefined);

        await addHiddenCollectibleToStorage({
          network: "testnet",
          publicKey: "test-public-key",
          contractId: "contract1",
          tokenId: "token2",
        });

        const expectedStorage = {
          "test-public-key": {
            testnet: [
              { contractId: "contract1", tokenIds: ["token1", "token2"] },
            ],
          },
        };

        expect(dataStorage.setItem).toHaveBeenCalledWith(
          STORAGE_KEYS.HIDDEN_COLLECTIBLES_LIST,
          JSON.stringify(expectedStorage),
        );
      });

      it("does not add duplicate tokenId", async () => {
        const mockStorage = {
          "test-public-key": {
            testnet: [{ contractId: "contract1", tokenIds: ["token1"] }],
          },
        };
        (dataStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify(mockStorage),
        );
        (dataStorage.setItem as jest.Mock).mockResolvedValue(undefined);

        await addHiddenCollectibleToStorage({
          network: "testnet",
          publicKey: "test-public-key",
          contractId: "contract1",
          tokenId: "token1",
        });

        const expectedStorage = {
          "test-public-key": {
            testnet: [{ contractId: "contract1", tokenIds: ["token1"] }],
          },
        };

        expect(dataStorage.setItem).toHaveBeenCalledWith(
          STORAGE_KEYS.HIDDEN_COLLECTIBLES_LIST,
          JSON.stringify(expectedStorage),
        );
      });
    });

    describe("removeHiddenCollectibleFromStorage", () => {
      it("removes tokenId from existing hidden contract", async () => {
        const mockStorage = {
          "test-public-key": {
            testnet: [
              { contractId: "contract1", tokenIds: ["token1", "token2"] },
            ],
          },
        };
        (dataStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify(mockStorage),
        );
        (dataStorage.setItem as jest.Mock).mockResolvedValue(undefined);

        await removeHiddenCollectibleFromStorage({
          network: "testnet",
          publicKey: "test-public-key",
          contractId: "contract1",
          tokenId: "token1",
        });

        const expectedStorage = {
          "test-public-key": {
            testnet: [{ contractId: "contract1", tokenIds: ["token2"] }],
          },
        };

        expect(dataStorage.setItem).toHaveBeenCalledWith(
          STORAGE_KEYS.HIDDEN_COLLECTIBLES_LIST,
          JSON.stringify(expectedStorage),
        );
      });

      it("throws error when publicKey does not exist", async () => {
        const mockStorage = {};
        (dataStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify(mockStorage),
        );

        await expect(
          removeHiddenCollectibleFromStorage({
            network: "testnet",
            publicKey: "non-existent-key",
            contractId: "contract1",
            tokenId: "token1",
          }),
        ).rejects.toThrow(
          'Cannot remove hidden collectible: storage not found for publicKey "non-existent-key" and network "testnet"',
        );

        expect(dataStorage.setItem).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
          "removeHiddenCollectibleFromStorage",
          "Error removing hidden collectible from storage",
          expect.any(Error),
        );
      });
    });
  });
});
