import { NETWORKS, STORAGE_KEYS } from "config/constants";
import { SearchTokenResponse } from "config/types";
import { useTrendingTokensStore } from "ducks/trendingTokens";
import { fetchTrendingAssets } from "services/stellarExpert";
import { dataStorage } from "services/storage/storageFactory";

jest.mock("services/stellarExpert");
jest.mock("services/storage/storageFactory");

const mockFetchTrendingAssets = fetchTrendingAssets as jest.MockedFunction<
  typeof fetchTrendingAssets
>;
const mockDataStorage = dataStorage as jest.Mocked<typeof dataStorage>;

const THIRTY_MINUTES = 30 * 60 * 1000;

const mockRecord = {
  asset: "USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN-1",
  supply: "1000000",
  traded_amount: 500000,
  payments_amount: 300000,
  payments: 100,
  trades: 200,
  trustlines: [100, 200, 300],
  price: 1.0,
  created: 1000000,
  domain: "circle.com",
  rating: {
    age: 5,
    activity: 8,
    trustlines: 9,
    liquidity: 7,
    volume7d: 8,
    interop: 6,
    average: 7.2,
  },
  paging_token: 1,
  tomlInfo: {
    code: "USDC",
    issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    image: "usdc.png",
  },
};

const mockLinks = {
  self: { href: "https://api.stellar.expert/explorer/public/asset?page=1" },
  prev: { href: "https://api.stellar.expert/explorer/public/asset?page=0" },
  next: { href: "https://api.stellar.expert/explorer/public/asset?page=2" },
};

const mockResponse: SearchTokenResponse = {
  _embedded: { records: [mockRecord] },
  _links: mockLinks,
};

describe("useTrendingTokensStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataStorage.getItem.mockResolvedValue(null);
    mockDataStorage.setItem.mockResolvedValue();
  });

  describe("getTrendingTokens", () => {
    it("fetches from service, writes to storage, and returns response on first call (cache miss)", async () => {
      mockFetchTrendingAssets.mockResolvedValue(mockResponse);

      const { getTrendingTokens } = useTrendingTokensStore.getState();
      const result = await getTrendingTokens({ network: NETWORKS.PUBLIC });

      expect(result).toEqual(mockResponse);
      expect(mockFetchTrendingAssets).toHaveBeenCalledTimes(1);
      expect(mockFetchTrendingAssets).toHaveBeenCalledWith({
        network: NETWORKS.PUBLIC,
      });

      // Verify data was written to storage
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        `${STORAGE_KEYS.TRENDING_TOKENS_PREFIX}${NETWORKS.PUBLIC}`,
        JSON.stringify(mockResponse),
      );
      // Verify timestamp was written
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        `${STORAGE_KEYS.TRENDING_TOKENS_PREFIX}${NETWORKS.PUBLIC}_date`,
        expect.any(String),
      );
    });

    it("reads from storage on second call within TTL (cache hit — no service call)", async () => {
      const now = Date.now();

      // Prime the mock: fresh cache entry (1 second old)
      mockDataStorage.getItem
        .mockResolvedValueOnce((now - 1000).toString()) // cached date
        .mockResolvedValueOnce(JSON.stringify(mockResponse)); // cached result

      const { getTrendingTokens } = useTrendingTokensStore.getState();
      const result = await getTrendingTokens({ network: NETWORKS.PUBLIC });

      expect(result).toEqual(mockResponse);
      // Service must NOT be called when cache is fresh
      expect(mockFetchTrendingAssets).not.toHaveBeenCalled();
    });

    it("re-fetches when cache is stale (TTL elapsed)", async () => {
      const now = Date.now();
      const staleDate = (now - THIRTY_MINUTES - 1000).toString();

      // Stale cache
      mockDataStorage.getItem
        .mockResolvedValueOnce(staleDate) // stale timestamp
        .mockResolvedValueOnce(JSON.stringify(mockResponse)); // stale cached result

      mockFetchTrendingAssets.mockResolvedValue(mockResponse);

      const { getTrendingTokens } = useTrendingTokensStore.getState();
      const result = await getTrendingTokens({ network: NETWORKS.PUBLIC });

      expect(result).toEqual(mockResponse);
      expect(mockFetchTrendingAssets).toHaveBeenCalledTimes(1);
    });

    it("re-fetches when forceRefresh is true, even with a fresh cache", async () => {
      const now = Date.now();

      // Fresh cache
      mockDataStorage.getItem
        .mockResolvedValueOnce((now - 1000).toString()) // fresh timestamp
        .mockResolvedValueOnce(JSON.stringify(mockResponse)); // cached result

      mockFetchTrendingAssets.mockResolvedValue(mockResponse);

      const { getTrendingTokens } = useTrendingTokensStore.getState();
      const result = await getTrendingTokens({
        network: NETWORKS.PUBLIC,
        forceRefresh: true,
      });

      expect(result).toEqual(mockResponse);
      // Must re-fetch even though cache is fresh
      expect(mockFetchTrendingAssets).toHaveBeenCalledTimes(1);
    });

    it("returns null and does NOT write to storage when service returns null (network down + no cache)", async () => {
      // No cached data
      mockDataStorage.getItem.mockResolvedValue(null);
      // Service returns null (network down)
      mockFetchTrendingAssets.mockResolvedValue(null);

      const { getTrendingTokens } = useTrendingTokensStore.getState();
      const result = await getTrendingTokens({ network: NETWORKS.PUBLIC });

      expect(result).toBeNull();
      // Cache must NOT be poisoned with null
      expect(mockDataStorage.setItem).not.toHaveBeenCalledWith(
        `${STORAGE_KEYS.TRENDING_TOKENS_PREFIX}${NETWORKS.PUBLIC}`,
        JSON.stringify(null),
      );
    });

    it("caches per network (PUBLIC and TESTNET are independent)", async () => {
      const testnetResponse: SearchTokenResponse = {
        _embedded: { records: [] },
        _links: mockLinks,
      };

      mockFetchTrendingAssets
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(testnetResponse);

      const { getTrendingTokens } = useTrendingTokensStore.getState();

      const publicResult = await getTrendingTokens({
        network: NETWORKS.PUBLIC,
      });
      const testnetResult = await getTrendingTokens({
        network: NETWORKS.TESTNET,
      });

      expect(publicResult).toEqual(mockResponse);
      expect(testnetResult).toEqual(testnetResponse);
      expect(mockFetchTrendingAssets).toHaveBeenCalledTimes(2);

      // Ensure separate storage keys are used
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        `${STORAGE_KEYS.TRENDING_TOKENS_PREFIX}${NETWORKS.PUBLIC}`,
        JSON.stringify(mockResponse),
      );
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        `${STORAGE_KEYS.TRENDING_TOKENS_PREFIX}${NETWORKS.TESTNET}`,
        JSON.stringify(testnetResponse),
      );
    });
  });
});
