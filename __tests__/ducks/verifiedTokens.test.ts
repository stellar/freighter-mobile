import { NETWORKS, STORAGE_KEYS } from "config/constants";
import { useVerifiedTokensStore } from "ducks/verifiedTokens";
import { dataStorage } from "services/storage/storageFactory";
import { fetchVerifiedTokens } from "services/verified-token-lists";
import { TokenListReponseItem } from "services/verified-token-lists/types";

jest.mock("services/verified-token-lists");
jest.mock("services/storage/storageFactory");

const mockFetchVerifiedTokens = fetchVerifiedTokens as jest.MockedFunction<
  typeof fetchVerifiedTokens
>;
const mockDataStorage = dataStorage as jest.Mocked<typeof dataStorage>;

// Time constants for tests
const THIRTY_MINUTES = 30 * 60 * 1000;

describe("useVerifiedTokensStore", () => {
  const mockVerifiedTokens: TokenListReponseItem[] = [
    {
      code: "USDC",
      issuer: "GABC123",
      contract: "C123",
      domain: "example.com",
      icon: "icon.png",
      decimals: 7,
    },
    {
      code: "USDT",
      issuer: "GDEF456",
      contract: "C456",
      domain: "example2.com",
      icon: "icon2.png",
      decimals: 7,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset storage mocks
    mockDataStorage.getItem.mockResolvedValue(null);
    mockDataStorage.setItem.mockResolvedValue();
  });

  describe("getVerifiedTokens", () => {
    it("fetches and caches tokens on first call", async () => {
      mockFetchVerifiedTokens.mockResolvedValue(mockVerifiedTokens);

      const { getVerifiedTokens } = useVerifiedTokensStore.getState();
      const result = await getVerifiedTokens({ network: NETWORKS.PUBLIC });

      expect(result).toEqual(mockVerifiedTokens);
      expect(mockFetchVerifiedTokens).toHaveBeenCalledTimes(1);
      expect(mockFetchVerifiedTokens).toHaveBeenCalledWith({
        tokenListsApiServices: expect.any(Object),
        network: NETWORKS.PUBLIC,
      });

      // Verify cache was updated
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        `${STORAGE_KEYS.VERIFIED_TOKENS_PREFIX}${NETWORKS.PUBLIC}`,
        JSON.stringify(mockVerifiedTokens),
      );
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        `${STORAGE_KEYS.VERIFIED_TOKENS_PREFIX}${NETWORKS.PUBLIC}_date`,
        expect.any(String),
      );
    });

    it("returns cached tokens if cache is fresh", async () => {
      const now = Date.now();

      // First call - fetch and cache
      mockFetchVerifiedTokens.mockResolvedValue(mockVerifiedTokens);
      const { getVerifiedTokens } = useVerifiedTokensStore.getState();
      await getVerifiedTokens({ network: NETWORKS.PUBLIC });

      // Mock cached data (fresh, within 30 min TTL)
      mockDataStorage.getItem
        .mockResolvedValueOnce((now - 1000).toString()) // cached date (1 second ago)
        .mockResolvedValueOnce(JSON.stringify(mockVerifiedTokens)); // cached result

      // Second call - should use cache
      const result = await getVerifiedTokens({ network: NETWORKS.PUBLIC });

      expect(result).toEqual(mockVerifiedTokens);
      // Should not fetch again
      expect(mockFetchVerifiedTokens).toHaveBeenCalledTimes(1);
    });

    it("refetches tokens if cache is stale", async () => {
      const now = Date.now();
      const CACHE_TTL_MS = THIRTY_MINUTES;

      // First call - fetch and cache
      mockFetchVerifiedTokens.mockResolvedValue(mockVerifiedTokens);
      const { getVerifiedTokens } = useVerifiedTokensStore.getState();
      await getVerifiedTokens({ network: NETWORKS.PUBLIC });

      // Mock stale cached data (beyond 30 min TTL)
      mockDataStorage.getItem
        .mockResolvedValueOnce((now - CACHE_TTL_MS - 1000).toString()) // stale date
        .mockResolvedValueOnce(JSON.stringify(mockVerifiedTokens)); // cached result

      // Second call - should refetch
      const result = await getVerifiedTokens({ network: NETWORKS.PUBLIC });

      expect(result).toEqual(mockVerifiedTokens);
      // Should fetch again
      expect(mockFetchVerifiedTokens).toHaveBeenCalledTimes(2);
    });

    it("refetches tokens when forceRefresh is true", async () => {
      const now = Date.now();

      // First call - fetch and cache
      mockFetchVerifiedTokens.mockResolvedValue(mockVerifiedTokens);
      const { getVerifiedTokens } = useVerifiedTokensStore.getState();
      await getVerifiedTokens({ network: NETWORKS.PUBLIC });

      // Mock fresh cached data
      mockDataStorage.getItem
        .mockResolvedValueOnce((now - 1000).toString()) // fresh date
        .mockResolvedValueOnce(JSON.stringify(mockVerifiedTokens)); // cached result

      // Second call with forceRefresh - should refetch
      const result = await getVerifiedTokens({
        network: NETWORKS.PUBLIC,
        forceRefresh: true,
      });

      expect(result).toEqual(mockVerifiedTokens);
      // Should fetch again despite fresh cache
      expect(mockFetchVerifiedTokens).toHaveBeenCalledTimes(2);
    });

    it("handles different networks separately", async () => {
      const testnetTokens: TokenListReponseItem[] = [
        {
          code: "TEST",
          issuer: "GTEST123",
          contract: "CTEST123",
          domain: "test.com",
          icon: "test-icon.png",
          decimals: 7,
        },
      ];

      mockFetchVerifiedTokens
        .mockResolvedValueOnce(mockVerifiedTokens)
        .mockResolvedValueOnce(testnetTokens);

      const { getVerifiedTokens } = useVerifiedTokensStore.getState();

      // Fetch for PUBLIC network
      const publicResult = await getVerifiedTokens({
        network: NETWORKS.PUBLIC,
      });
      expect(publicResult).toEqual(mockVerifiedTokens);

      // Fetch for TESTNET network
      const testnetResult = await getVerifiedTokens({
        network: NETWORKS.TESTNET,
      });
      expect(testnetResult).toEqual(testnetTokens);

      expect(mockFetchVerifiedTokens).toHaveBeenCalledTimes(2);
      expect(mockFetchVerifiedTokens).toHaveBeenNthCalledWith(1, {
        tokenListsApiServices: expect.any(Object),
        network: NETWORKS.PUBLIC,
      });
      expect(mockFetchVerifiedTokens).toHaveBeenNthCalledWith(2, {
        tokenListsApiServices: expect.any(Object),
        network: NETWORKS.TESTNET,
      });

      // Verify both networks are cached separately
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        `${STORAGE_KEYS.VERIFIED_TOKENS_PREFIX}${NETWORKS.PUBLIC}`,
        JSON.stringify(mockVerifiedTokens),
      );
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        `${STORAGE_KEYS.VERIFIED_TOKENS_PREFIX}${NETWORKS.TESTNET}`,
        JSON.stringify(testnetTokens),
      );
    });

    it("handles empty token list", async () => {
      mockFetchVerifiedTokens.mockResolvedValue([]);

      const { getVerifiedTokens } = useVerifiedTokensStore.getState();
      const result = await getVerifiedTokens({ network: NETWORKS.PUBLIC });

      expect(result).toEqual([]);
      expect(mockFetchVerifiedTokens).toHaveBeenCalledTimes(1);
    });

    it("handles fetch errors gracefully", async () => {
      const error = new Error("Network error");
      mockFetchVerifiedTokens.mockRejectedValue(error);

      const { getVerifiedTokens } = useVerifiedTokensStore.getState();

      await expect(
        getVerifiedTokens({ network: NETWORKS.PUBLIC }),
      ).rejects.toThrow("Network error");
    });
  });
});
