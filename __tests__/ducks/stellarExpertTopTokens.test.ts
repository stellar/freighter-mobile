/* eslint-disable no-underscore-dangle */
import { NETWORKS, STORAGE_KEYS } from "config/constants";
import { SearchTokenResponse } from "config/types";
import { useStellarExpertTopTokensStore } from "ducks/stellarExpertTopTokens";
import { fetchTrendingAssets } from "services/stellarExpert";
import { dataStorage } from "services/storage/storageFactory";

jest.mock("services/stellarExpert");
jest.mock("services/storage/storageFactory");

const mockFetchTrendingAssets = fetchTrendingAssets as jest.MockedFunction<
  typeof fetchTrendingAssets
>;
const mockDataStorage = dataStorage as jest.Mocked<typeof dataStorage>;

const THIRTY_MINUTES = 30 * 60 * 1000;

// MIN_TRENDING_VOLUME7D in src/ducks/stellarExpertTopTokens.ts = 70_000_000_000
// (USD 7,000 with stellar.expert's 10^7 scaling). Tests use values either side
// of this threshold.
const VOLUME7D_ABOVE_THRESHOLD = 100_000_000_000; // ~$10,000
const VOLUME7D_BELOW_THRESHOLD = 50_000_000_000; //  ~$5,000

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
  volume7d: VOLUME7D_ABOVE_THRESHOLD,
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

describe("useStellarExpertTopTokensStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataStorage.getItem.mockResolvedValue(null);
    mockDataStorage.setItem.mockResolvedValue();
  });

  describe("getStellarExpertTopTokens", () => {
    it("fetches from service, writes to storage, and returns response on first call (cache miss)", async () => {
      mockFetchTrendingAssets.mockResolvedValue(mockResponse);

      const { getStellarExpertTopTokens } =
        useStellarExpertTopTokensStore.getState();
      const result = await getStellarExpertTopTokens({
        network: NETWORKS.PUBLIC,
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetchTrendingAssets).toHaveBeenCalledTimes(1);
      expect(mockFetchTrendingAssets).toHaveBeenCalledWith({
        network: NETWORKS.PUBLIC,
      });

      // Verify data was written to storage
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        `${STORAGE_KEYS.STELLAR_EXPERT_TOP_TOKENS_PREFIX}${NETWORKS.PUBLIC}`,
        JSON.stringify(mockResponse),
      );
      // Verify timestamp was written
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        `${STORAGE_KEYS.STELLAR_EXPERT_TOP_TOKENS_PREFIX}${NETWORKS.PUBLIC}_date`,
        expect.any(String),
      );
    });

    it("reads from storage on second call within TTL (cache hit — no service call)", async () => {
      const now = Date.now();

      // Prime the mock: fresh cache entry (1 second old)
      mockDataStorage.getItem
        .mockResolvedValueOnce((now - 1000).toString()) // cached date
        .mockResolvedValueOnce(JSON.stringify(mockResponse)); // cached result

      const { getStellarExpertTopTokens } =
        useStellarExpertTopTokensStore.getState();
      const result = await getStellarExpertTopTokens({
        network: NETWORKS.PUBLIC,
      });

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

      const { getStellarExpertTopTokens } =
        useStellarExpertTopTokensStore.getState();
      const result = await getStellarExpertTopTokens({
        network: NETWORKS.PUBLIC,
      });

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

      const { getStellarExpertTopTokens } =
        useStellarExpertTopTokensStore.getState();
      const result = await getStellarExpertTopTokens({
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

      const { getStellarExpertTopTokens } =
        useStellarExpertTopTokensStore.getState();
      const result = await getStellarExpertTopTokens({
        network: NETWORKS.PUBLIC,
      });

      expect(result).toBeNull();
      // Cache must NOT be poisoned with null
      expect(mockDataStorage.setItem).not.toHaveBeenCalledWith(
        `${STORAGE_KEYS.STELLAR_EXPERT_TOP_TOKENS_PREFIX}${NETWORKS.PUBLIC}`,
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

      const { getStellarExpertTopTokens } =
        useStellarExpertTopTokensStore.getState();

      const publicResult = await getStellarExpertTopTokens({
        network: NETWORKS.PUBLIC,
      });
      const testnetResult = await getStellarExpertTopTokens({
        network: NETWORKS.TESTNET,
      });

      expect(publicResult).toEqual(mockResponse);
      expect(testnetResult).toEqual(testnetResponse);
      expect(mockFetchTrendingAssets).toHaveBeenCalledTimes(2);

      // Ensure separate storage keys are used
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        `${STORAGE_KEYS.STELLAR_EXPERT_TOP_TOKENS_PREFIX}${NETWORKS.PUBLIC}`,
        JSON.stringify(mockResponse),
      );
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        `${STORAGE_KEYS.STELLAR_EXPERT_TOP_TOKENS_PREFIX}${NETWORKS.TESTNET}`,
        JSON.stringify(testnetResponse),
      );
    });
  });

  describe("readCache", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("returns null when no cache exists", async () => {
      (dataStorage.getItem as jest.Mock).mockResolvedValue(null);
      const result = await useStellarExpertTopTokensStore
        .getState()
        .readCache(NETWORKS.PUBLIC);
      expect(result).toBeNull();
    });

    it("returns { data, age } when cache exists", async () => {
      const cachedAt = Date.now() - 2000;
      const payload = {
        _embedded: { records: [{ asset: "XLM", domain: "stellar.org" }] },
        _links: {},
      };
      (dataStorage.getItem as jest.Mock).mockImplementation((k: string) =>
        Promise.resolve(
          k.endsWith("_date") ? String(cachedAt) : JSON.stringify(payload),
        ),
      );

      const result = await useStellarExpertTopTokensStore
        .getState()
        .readCache(NETWORKS.PUBLIC);

      expect(result?.data).toEqual(payload);
      expect(result?.age).toBeGreaterThanOrEqual(2000);
      expect(result?.age).toBeLessThan(5000);
    });

    it("uses the per-network storage key", async () => {
      (dataStorage.getItem as jest.Mock).mockResolvedValue(null);
      await useStellarExpertTopTokensStore
        .getState()
        .readCache(NETWORKS.TESTNET);
      const calls = (dataStorage.getItem as jest.Mock).mock.calls.map(
        (c) => c[0],
      );
      expect(
        calls.some((k: string) =>
          k.includes(`stellarExpertTopTokens_${NETWORKS.TESTNET}`),
        ),
      ).toBe(true);
    });
  });

  describe("low-volume filter (MIN_TRENDING_VOLUME7D)", () => {
    it("drops records with volume7d below the threshold", async () => {
      const lowVolumeRecord = {
        ...mockRecord,
        asset: "LOW-GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH-1",
        volume7d: VOLUME7D_BELOW_THRESHOLD,
      };
      mockFetchTrendingAssets.mockResolvedValue({
        ...mockResponse,
        _embedded: { records: [mockRecord, lowVolumeRecord] },
      });

      const { getStellarExpertTopTokens } =
        useStellarExpertTopTokensStore.getState();
      const result = await getStellarExpertTopTokens({
        network: NETWORKS.PUBLIC,
      });

      // Only the above-threshold record survives.
      expect(result?._embedded.records).toHaveLength(1);
      expect(result?._embedded.records[0]?.asset).toBe(mockRecord.asset);
    });

    it("drops records with no volume7d field", async () => {
      // Build a record without `volume7d` set at all. The optional shape on
      // SearchTokenResponse permits this; the duck should still exclude it
      // from the trending list.
      const withoutVolume7d = Object.fromEntries(
        Object.entries(mockRecord).filter(([key]) => key !== "volume7d"),
      ) as typeof mockRecord;
      mockFetchTrendingAssets.mockResolvedValue({
        ...mockResponse,
        _embedded: { records: [withoutVolume7d] },
      });

      const { getStellarExpertTopTokens } =
        useStellarExpertTopTokensStore.getState();
      const result = await getStellarExpertTopTokens({
        network: NETWORKS.PUBLIC,
      });

      expect(result?._embedded.records).toHaveLength(0);
    });

    it("writes the FILTERED payload to disk (cache holds the post-filter list)", async () => {
      const lowVolumeRecord = {
        ...mockRecord,
        asset: "LOW-GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH-1",
        volume7d: VOLUME7D_BELOW_THRESHOLD,
      };
      mockFetchTrendingAssets.mockResolvedValue({
        ...mockResponse,
        _embedded: { records: [mockRecord, lowVolumeRecord] },
      });

      const { getStellarExpertTopTokens } =
        useStellarExpertTopTokensStore.getState();
      await getStellarExpertTopTokens({ network: NETWORKS.PUBLIC });

      // The setItem for the result key should hold the filtered records,
      // not the raw API payload. Inspect the JSON write.
      const setItemCalls = mockDataStorage.setItem.mock.calls;
      const resultCall = setItemCalls.find(
        ([key]) =>
          key ===
          `${STORAGE_KEYS.STELLAR_EXPERT_TOP_TOKENS_PREFIX}${NETWORKS.PUBLIC}`,
      );
      expect(resultCall).toBeDefined();
      const written = JSON.parse(resultCall![1]);
      expect(written._embedded.records).toHaveLength(1);
      expect(written._embedded.records[0].asset).toBe(mockRecord.asset);
    });
  });
});
