import { NETWORKS } from "config/constants";
import { useVerifiedTokensStore } from "ducks/verifiedTokens";
import { fetchVerifiedTokens } from "services/verified-token-lists";
import { TokenListReponseItem } from "services/verified-token-lists/types";

jest.mock("services/verified-token-lists");

const mockFetchVerifiedTokens = fetchVerifiedTokens as jest.MockedFunction<
  typeof fetchVerifiedTokens
>;

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
    // Reset store state
    useVerifiedTokensStore.setState({
      verifiedTokensByNetwork: {
        [NETWORKS.PUBLIC]: [],
        [NETWORKS.TESTNET]: [],
        [NETWORKS.FUTURENET]: [],
      },
      lastFetchedByNetwork: {
        [NETWORKS.PUBLIC]: null,
        [NETWORKS.TESTNET]: null,
        [NETWORKS.FUTURENET]: null,
      },
    });
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
      const state = useVerifiedTokensStore.getState();
      expect(state.verifiedTokensByNetwork[NETWORKS.PUBLIC]).toEqual(
        mockVerifiedTokens,
      );
      expect(state.lastFetchedByNetwork[NETWORKS.PUBLIC]).not.toBeNull();
    });

    it("returns cached tokens if cache is fresh", async () => {
      const now = Date.now();
      mockFetchVerifiedTokens.mockResolvedValue(mockVerifiedTokens);

      // First call - fetch and cache
      const { getVerifiedTokens } = useVerifiedTokensStore.getState();
      await getVerifiedTokens({ network: NETWORKS.PUBLIC });

      // Set lastFetched to recent time (within TTL)
      useVerifiedTokensStore.setState({
        lastFetchedByNetwork: {
          [NETWORKS.PUBLIC]: now - 1000, // 1 second ago
          [NETWORKS.TESTNET]: null,
          [NETWORKS.FUTURENET]: null,
        },
      });

      // Second call - should use cache
      const result = await getVerifiedTokens({ network: NETWORKS.PUBLIC });

      expect(result).toEqual(mockVerifiedTokens);
      // Should not fetch again
      expect(mockFetchVerifiedTokens).toHaveBeenCalledTimes(1);
    });

    it("refetches tokens if cache is stale", async () => {
      const now = Date.now();
      const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

      mockFetchVerifiedTokens.mockResolvedValue(mockVerifiedTokens);

      // First call - fetch and cache
      const { getVerifiedTokens } = useVerifiedTokensStore.getState();
      await getVerifiedTokens({ network: NETWORKS.PUBLIC });

      // Set lastFetched to stale time (beyond TTL)
      useVerifiedTokensStore.setState({
        lastFetchedByNetwork: {
          [NETWORKS.PUBLIC]: now - CACHE_TTL_MS - 1000, // 24 hours + 1 second ago
          [NETWORKS.TESTNET]: null,
          [NETWORKS.FUTURENET]: null,
        },
      });

      // Second call - should refetch
      const result = await getVerifiedTokens({ network: NETWORKS.PUBLIC });

      expect(result).toEqual(mockVerifiedTokens);
      // Should fetch again
      expect(mockFetchVerifiedTokens).toHaveBeenCalledTimes(2);
    });

    it("refetches tokens when forceRefresh is true", async () => {
      const now = Date.now();
      mockFetchVerifiedTokens.mockResolvedValue(mockVerifiedTokens);

      // First call - fetch and cache
      const { getVerifiedTokens } = useVerifiedTokensStore.getState();
      await getVerifiedTokens({ network: NETWORKS.PUBLIC });

      // Set lastFetched to recent time
      useVerifiedTokensStore.setState({
        lastFetchedByNetwork: {
          [NETWORKS.PUBLIC]: now - 1000, // 1 second ago
          [NETWORKS.TESTNET]: null,
          [NETWORKS.FUTURENET]: null,
        },
      });

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
      const state = useVerifiedTokensStore.getState();
      expect(state.verifiedTokensByNetwork[NETWORKS.PUBLIC]).toEqual(
        mockVerifiedTokens,
      );
      expect(state.verifiedTokensByNetwork[NETWORKS.TESTNET]).toEqual(
        testnetTokens,
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
