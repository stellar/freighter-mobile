import Blockaid from "@blockaid/client";
import { NETWORKS, STORAGE_KEYS } from "config/constants";
import { useBlockaidTokenScansStore } from "ducks/blockaidTokenScans";
import { scanBulkTokens } from "services/blockaid/api";
import { dataStorage } from "services/storage/storageFactory";

jest.mock("services/blockaid/api");
jest.mock("services/storage/storageFactory");

const mockScanBulkTokens = scanBulkTokens as jest.MockedFunction<
  typeof scanBulkTokens
>;
const mockDataStorage = dataStorage as jest.Mocked<typeof dataStorage>;

const THIRTY_MINUTES = 30 * 60 * 1000;

// Minimal scan stub — cast so tests don't have to fill every Blockaid field.
const makeScan = (id: string) =>
  ({
    result_type: "Benign",
    id,
  }) as unknown as Blockaid.Token.TokenScanResponse;

const TOKEN_A = "USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const TOKEN_B = "AQUA-GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA";
const TOKEN_C =
  "XLM-GNATIVE00000000000000000000000000000000000000000000000000000";
const TOKEN_D = "FOO-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4FOOO";
const TOKEN_E =
  "BAR-GDEF456789012345678901234567890123456789012345678901234BARB";

const storageKey = `${STORAGE_KEYS.BLOCKAID_TOKEN_SCANS_PREFIX}${NETWORKS.PUBLIC}`;

describe("useBlockaidTokenScansStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataStorage.getItem.mockResolvedValue(null);
    mockDataStorage.setItem.mockResolvedValue();
  });

  describe("scanBulkWithCache", () => {
    it("calls scanBulkTokens for all tokens on first call (full cache miss) and writes results", async () => {
      const scanResults = {
        [TOKEN_A]: makeScan(TOKEN_A),
        [TOKEN_B]: makeScan(TOKEN_B),
        [TOKEN_C]: makeScan(TOKEN_C),
      };
      mockScanBulkTokens.mockResolvedValue({ results: scanResults });

      const { scanBulkWithCache } = useBlockaidTokenScansStore.getState();
      const result = await scanBulkWithCache({
        addressList: [TOKEN_A, TOKEN_B, TOKEN_C],
        network: NETWORKS.PUBLIC,
      });

      // All three tokens returned
      expect(result.results).toEqual(scanResults);
      // Service called once with all three
      expect(mockScanBulkTokens).toHaveBeenCalledTimes(1);
      expect(mockScanBulkTokens).toHaveBeenCalledWith({
        addressList: [TOKEN_A, TOKEN_B, TOKEN_C],
        network: NETWORKS.PUBLIC,
      });
      // Cache was written
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        storageKey,
        expect.any(String),
      );
      // Written cache should contain _cachedAt timestamps
      const writtenValue = JSON.parse(mockDataStorage.setItem.mock.calls[0][1]);
      expect(writtenValue[TOKEN_A]).toHaveProperty("_cachedAt");
      expect(writtenValue[TOKEN_B]).toHaveProperty("_cachedAt");
      expect(writtenValue[TOKEN_C]).toHaveProperty("_cachedAt");
    });

    it("returns cached results on second call within TTL without calling scanBulkTokens", async () => {
      const now = Date.now();
      const cachedEntry = { ...makeScan(TOKEN_A), _cachedAt: now - 1000 };
      const networkCache = { [TOKEN_A]: cachedEntry };

      // Storage returns fresh cache
      mockDataStorage.getItem.mockResolvedValueOnce(
        JSON.stringify(networkCache),
      );

      const { scanBulkWithCache } = useBlockaidTokenScansStore.getState();
      const result = await scanBulkWithCache({
        addressList: [TOKEN_A],
        network: NETWORKS.PUBLIC,
      });

      // Result should equal the cached scan (without _cachedAt)
      expect(result.results[TOKEN_A]).toEqual(makeScan(TOKEN_A));
      // _cachedAt must NOT leak into results
      expect(result.results[TOKEN_A]).not.toHaveProperty("_cachedAt");
      // Service must NOT be called
      expect(mockScanBulkTokens).not.toHaveBeenCalled();
    });

    it("makes ONE scanBulkTokens call for only the missing tokens in a partial hit scenario", async () => {
      const now = Date.now();

      // 5 tokens in cache (fresh)
      const cachedTokens = [TOKEN_A, TOKEN_B, TOKEN_C];
      const networkCache: Record<
        string,
        ReturnType<typeof makeScan> & { _cachedAt: number }
      > = cachedTokens.reduce(
        (acc, t) => ({
          ...acc,
          [t]: { ...makeScan(t), _cachedAt: now - 1000 },
        }),
        {},
      );

      mockDataStorage.getItem.mockResolvedValueOnce(
        JSON.stringify(networkCache),
      );

      // 3 new tokens the service returns
      const newTokens = [TOKEN_D, TOKEN_E];
      const freshScans: Record<string, Blockaid.Token.TokenScanResponse> = {
        [TOKEN_D]: makeScan(TOKEN_D),
        [TOKEN_E]: makeScan(TOKEN_E),
      };
      mockScanBulkTokens.mockResolvedValue({ results: freshScans });

      const allTokens = [...cachedTokens, ...newTokens];

      const { scanBulkWithCache } = useBlockaidTokenScansStore.getState();
      const result = await scanBulkWithCache({
        addressList: allTokens,
        network: NETWORKS.PUBLIC,
      });

      // Service called ONCE for only the 2 missing tokens
      expect(mockScanBulkTokens).toHaveBeenCalledTimes(1);
      expect(mockScanBulkTokens).toHaveBeenCalledWith({
        addressList: newTokens,
        network: NETWORKS.PUBLIC,
      });

      // Result contains all 5 tokens
      expect(Object.keys(result.results)).toHaveLength(allTokens.length);
      cachedTokens.forEach((t) => {
        expect(result.results[t]).toEqual(makeScan(t));
      });
      newTokens.forEach((t) => {
        expect(result.results[t]).toEqual(freshScans[t]);
      });
    });

    it("treats stale cache entries (TTL expired) as misses and re-fetches them", async () => {
      const now = Date.now();
      const staleEntry = {
        ...makeScan(TOKEN_A),
        _cachedAt: now - THIRTY_MINUTES - 1000,
      };
      const networkCache = { [TOKEN_A]: staleEntry };

      mockDataStorage.getItem.mockResolvedValueOnce(
        JSON.stringify(networkCache),
      );

      const freshScan = makeScan(TOKEN_A);
      mockScanBulkTokens.mockResolvedValue({
        results: { [TOKEN_A]: freshScan },
      });

      const { scanBulkWithCache } = useBlockaidTokenScansStore.getState();
      const result = await scanBulkWithCache({
        addressList: [TOKEN_A],
        network: NETWORKS.PUBLIC,
      });

      // Token was stale → service was called
      expect(mockScanBulkTokens).toHaveBeenCalledTimes(1);
      expect(mockScanBulkTokens).toHaveBeenCalledWith({
        addressList: [TOKEN_A],
        network: NETWORKS.PUBLIC,
      });
      expect(result.results[TOKEN_A]).toEqual(freshScan);
    });

    it("returns cached hits gracefully when scanBulkTokens throws (service down)", async () => {
      const now = Date.now();
      // TOKEN_A is cached; TOKEN_B is new
      const networkCache = {
        [TOKEN_A]: { ...makeScan(TOKEN_A), _cachedAt: now - 1000 },
      };
      mockDataStorage.getItem.mockResolvedValueOnce(
        JSON.stringify(networkCache),
      );
      mockScanBulkTokens.mockRejectedValue(new Error("Service unavailable"));

      const { scanBulkWithCache } = useBlockaidTokenScansStore.getState();
      const result = await scanBulkWithCache({
        addressList: [TOKEN_A, TOKEN_B],
        network: NETWORKS.PUBLIC,
      });

      // TOKEN_A returned from cache
      expect(result.results[TOKEN_A]).toEqual(makeScan(TOKEN_A));
      // TOKEN_B not present (service failed)
      expect(result.results[TOKEN_B]).toBeUndefined();
      // No crash
    });

    it("bypasses cache and fetches all tokens when forceRefresh is true", async () => {
      const now = Date.now();
      // TOKEN_A is fresh in cache
      const networkCache = {
        [TOKEN_A]: { ...makeScan(TOKEN_A), _cachedAt: now - 1000 },
      };
      mockDataStorage.getItem.mockResolvedValueOnce(
        JSON.stringify(networkCache),
      );

      const freshScan = makeScan(TOKEN_A);
      mockScanBulkTokens.mockResolvedValue({
        results: { [TOKEN_A]: freshScan },
      });

      const { scanBulkWithCache } = useBlockaidTokenScansStore.getState();
      const result = await scanBulkWithCache({
        addressList: [TOKEN_A],
        network: NETWORKS.PUBLIC,
        forceRefresh: true,
      });

      // Service was called despite fresh cache
      expect(mockScanBulkTokens).toHaveBeenCalledTimes(1);
      expect(mockScanBulkTokens).toHaveBeenCalledWith({
        addressList: [TOKEN_A],
        network: NETWORKS.PUBLIC,
      });
      expect(result.results[TOKEN_A]).toEqual(freshScan);
    });
  });

  describe("readScansFor", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("returns empty hits + all addresses missing when cache is absent", async () => {
      (dataStorage.getItem as jest.Mock).mockResolvedValue(null);
      const result = await useBlockaidTokenScansStore
        .getState()
        .readScansFor(NETWORKS.PUBLIC, ["A-G1", "B-G2"]);
      expect(result.hits).toEqual({});
      expect(result.missing).toEqual(["A-G1", "B-G2"]);
    });

    it("returns fresh hits and reports stale entries as missing", async () => {
      const now = Date.now();
      const cache = {
        "A-G1": { result_type: "Benign", _cachedAt: now - 1000 }, // fresh
        "B-G2": {
          result_type: "Benign",
          _cachedAt: now - 31 * 60 * 1000,
        }, // stale (>30 min)
      };
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(cache),
      );

      const result = await useBlockaidTokenScansStore
        .getState()
        .readScansFor(NETWORKS.PUBLIC, ["A-G1", "B-G2", "C-G3"]);

      expect(Object.keys(result.hits)).toEqual(["A-G1"]);
      expect(result.missing.sort()).toEqual(["B-G2", "C-G3"]);
    });

    it("strips the _cachedAt field from returned hits", async () => {
      const now = Date.now();
      const cache = {
        "A-G1": { result_type: "Benign", _cachedAt: now - 1000 },
      };
      (dataStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(cache),
      );

      const result = await useBlockaidTokenScansStore
        .getState()
        .readScansFor(NETWORKS.PUBLIC, ["A-G1"]);

      expect(result.hits["A-G1"]).not.toHaveProperty("_cachedAt");
    });

    it("uses the per-network storage key", async () => {
      (dataStorage.getItem as jest.Mock).mockResolvedValue(null);
      await useBlockaidTokenScansStore
        .getState()
        .readScansFor(NETWORKS.TESTNET, []);
      const calls = (dataStorage.getItem as jest.Mock).mock.calls.map(
        (c) => c[0],
      );
      expect(
        calls.some((k: string) =>
          k.includes(STORAGE_KEYS.BLOCKAID_TOKEN_SCANS_PREFIX),
        ),
      ).toBe(true);
      expect(calls.some((k: string) => k.includes("TESTNET"))).toBe(true);
    });
  });
});
