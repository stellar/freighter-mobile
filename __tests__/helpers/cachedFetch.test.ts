import { cachedFetch, readCachedValue } from "helpers/cachedFetch";
import { dataStorage } from "services/storage/storageFactory";

jest.mock("services/storage/storageFactory");

const mockDataStorage = dataStorage as jest.Mocked<typeof dataStorage>;

// Time constants for tests
const THIRTY_MINUTES = 30 * 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;

describe("cachedFetch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset storage mocks
    mockDataStorage.getItem.mockResolvedValue(null);
    mockDataStorage.setItem.mockResolvedValue();
  });

  describe("URL-based fetching", () => {
    const mockResponse = { data: "test" };
    const storageKey = "test-key";

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it("fetches and caches data on first call", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await cachedFetch({
        urlOrFn: "https://api.example.com/data",
        storageKey,
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/data",
        undefined,
      );
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        storageKey,
        JSON.stringify(mockResponse),
      );
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        `${storageKey}_date`,
        expect.any(String),
      );
    });

    it("returns cached data if cache is fresh", async () => {
      const now = Date.now();
      const cachedData = { cached: "data" };

      // Mock cached data
      mockDataStorage.getItem
        .mockResolvedValueOnce(now.toString()) // cached date
        .mockResolvedValueOnce(JSON.stringify(cachedData)); // cached result

      const result = await cachedFetch({
        urlOrFn: "https://api.example.com/data",
        storageKey,
        ttlMs: THIRTY_MINUTES,
      });

      expect(result).toEqual(cachedData);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("refetches if cache is stale", async () => {
      const now = Date.now();
      const staleTime = now - THIRTY_MINUTES - 1000; // 1 second past TTL
      const newResponse = { new: "data" };

      // Mock stale cached data
      mockDataStorage.getItem
        .mockResolvedValueOnce(staleTime.toString()) // stale cached date
        .mockResolvedValueOnce(JSON.stringify({ old: "data" })); // old cached result

      (global.fetch as jest.Mock).mockResolvedValue({
        json: () => Promise.resolve(newResponse),
      });

      const result = await cachedFetch({
        urlOrFn: "https://api.example.com/data",
        storageKey,
        ttlMs: THIRTY_MINUTES,
      });

      expect(result).toEqual(newResponse);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("uses custom fetch options", async () => {
      const fetchOptions: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });

      await cachedFetch({
        urlOrFn: "https://api.example.com/data",
        storageKey,
        options: fetchOptions,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/data",
        fetchOptions,
      );
    });

    it("throws error on fetch failure", async () => {
      const error = new Error("Network error");
      (global.fetch as jest.Mock).mockRejectedValue(error);

      await expect(
        cachedFetch({
          urlOrFn: "https://api.example.com/data",
          storageKey,
        }),
      ).rejects.toThrow("Network error");
    });
  });

  describe("Function-based fetching", () => {
    const storageKey = "test-key";
    const mockData = { result: "test" };

    it("calls function and caches result on first call", async () => {
      const mockFn = jest.fn().mockResolvedValue(mockData);

      const result = await cachedFetch({
        urlOrFn: mockFn,
        storageKey,
      });

      expect(result).toEqual(mockData);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        storageKey,
        JSON.stringify(mockData),
      );
      expect(mockDataStorage.setItem).toHaveBeenCalledWith(
        `${storageKey}_date`,
        expect.any(String),
      );
    });

    it("returns cached data if cache is fresh", async () => {
      const now = Date.now();
      const cachedData = { cached: "data" };
      const mockFn = jest.fn().mockResolvedValue(mockData);

      // Mock cached data
      mockDataStorage.getItem
        .mockResolvedValueOnce(now.toString()) // cached date
        .mockResolvedValueOnce(JSON.stringify(cachedData)); // cached result

      const result = await cachedFetch({
        urlOrFn: mockFn,
        storageKey,
        ttlMs: THIRTY_MINUTES,
      });

      expect(result).toEqual(cachedData);
      expect(mockFn).not.toHaveBeenCalled();
    });

    it("refetches if cache is stale", async () => {
      const now = Date.now();
      const staleTime = now - THIRTY_MINUTES - 1000; // 1 second past TTL
      const newData = { new: "data" };
      const mockFn = jest.fn().mockResolvedValue(newData);

      // Mock stale cached data
      mockDataStorage.getItem
        .mockResolvedValueOnce(staleTime.toString()) // stale cached date
        .mockResolvedValueOnce(JSON.stringify({ old: "data" })); // old cached result

      const result = await cachedFetch({
        urlOrFn: mockFn,
        storageKey,
        ttlMs: THIRTY_MINUTES,
      });

      expect(result).toEqual(newData);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("forces refresh when forceRefresh is true", async () => {
      const now = Date.now();
      const cachedData = { cached: "data" };
      const newData = { new: "data" };
      const mockFn = jest.fn().mockResolvedValue(newData);

      // Mock fresh cached data
      mockDataStorage.getItem
        .mockResolvedValueOnce(now.toString()) // fresh cached date
        .mockResolvedValueOnce(JSON.stringify(cachedData)); // cached result

      const result = await cachedFetch({
        urlOrFn: mockFn,
        storageKey,
        ttlMs: THIRTY_MINUTES,
        forceRefresh: true,
      });

      expect(result).toEqual(newData);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("returns cached data on error during stale-reload (function mode, !forceRefresh)", async () => {
      // Stale cache (older than TTL) but no explicit refresh request:
      // the fetch fails and we gracefully fall back to the cached
      // value rather than surface an error to a passive caller.
      const cachedData = { cached: "data" };
      const error = new Error("Function error");
      const mockFn = jest.fn().mockRejectedValue(error);

      const staleTime = Date.now() - THIRTY_MINUTES - 1000;
      mockDataStorage.getItem
        .mockResolvedValueOnce(staleTime.toString()) // cached date (stale)
        .mockResolvedValueOnce(JSON.stringify(cachedData)); // cached result

      const result = await cachedFetch({
        urlOrFn: mockFn,
        storageKey,
        ttlMs: THIRTY_MINUTES,
      });

      expect(result).toEqual(cachedData);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("throws on forceRefresh failure even when cached data exists (function mode)", async () => {
      // Pull-to-refresh and other explicit forceRefresh callers need to
      // see the failure (e.g. to toast "couldn't refresh"). Silently
      // returning the stale cache contradicts the user's intent.
      const now = Date.now();
      const cachedData = { cached: "data" };
      const error = new Error("Function error");
      const mockFn = jest.fn().mockRejectedValue(error);

      mockDataStorage.getItem
        .mockResolvedValueOnce(now.toString())
        .mockResolvedValueOnce(JSON.stringify(cachedData));

      await expect(
        cachedFetch({
          urlOrFn: mockFn,
          storageKey,
          ttlMs: THIRTY_MINUTES,
          forceRefresh: true,
        }),
      ).rejects.toThrow("Function error");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("throws error if no cached data available on function error", async () => {
      const error = new Error("Function error");
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(
        cachedFetch({
          urlOrFn: mockFn,
          storageKey,
          forceRefresh: true,
        }),
      ).rejects.toThrow("Function error");
    });

    it("uses custom TTL", async () => {
      const customTtl = FIVE_MINUTES;
      const now = Date.now();
      const staleTime = now - customTtl - 1000; // Just past TTL
      const mockFn = jest.fn().mockResolvedValue(mockData);

      // Mock stale cached data
      mockDataStorage.getItem
        .mockResolvedValueOnce(staleTime.toString())
        .mockResolvedValueOnce(JSON.stringify({ old: "data" }));

      await cachedFetch({
        urlOrFn: mockFn,
        storageKey,
        ttlMs: customTtl,
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("uses default TTL when not specified", async () => {
      const now = Date.now();
      const freshTime = now - 1000; // 1 second ago (within default TTL)
      const cachedData = { cached: "data" };
      const mockFn = jest.fn().mockResolvedValue(mockData);

      // Mock fresh cached data
      mockDataStorage.getItem
        .mockResolvedValueOnce(freshTime.toString())
        .mockResolvedValueOnce(JSON.stringify(cachedData));

      const result = await cachedFetch({
        urlOrFn: mockFn,
        storageKey,
      });

      expect(result).toEqual(cachedData);
      expect(mockFn).not.toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("handles empty cache gracefully", async () => {
      const mockFn = jest.fn().mockResolvedValue({ data: "test" });

      const result = await cachedFetch({
        urlOrFn: mockFn,
        storageKey: "empty-cache-key",
      });

      expect(result).toEqual({ data: "test" });
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("handles invalid JSON in cache gracefully", async () => {
      const now = Date.now();
      const mockFn = jest.fn().mockResolvedValue({ data: "test" });

      // Mock invalid JSON
      mockDataStorage.getItem
        .mockResolvedValueOnce(now.toString())
        .mockResolvedValueOnce("invalid json");

      const result = await cachedFetch({
        urlOrFn: mockFn,
        storageKey: "invalid-json-key",
        ttlMs: THIRTY_MINUTES,
      });

      expect(result).toEqual({ data: "test" });
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("handles missing date cache", async () => {
      const mockFn = jest.fn().mockResolvedValue({ data: "test" });

      // Mock missing date but existing data
      mockDataStorage.getItem
        .mockResolvedValueOnce(null) // No date
        .mockResolvedValueOnce(JSON.stringify({ cached: "data" }));

      const result = await cachedFetch({
        urlOrFn: mockFn,
        storageKey: "no-date-key",
      });

      expect(result).toEqual({ data: "test" });
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});

describe("readCachedValue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (dataStorage.getItem as jest.Mock).mockResolvedValue(null);
    (dataStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns null when the date key is missing", async () => {
    (dataStorage.getItem as jest.Mock).mockResolvedValue(null);
    const result = await readCachedValue("missing-key");
    expect(result).toBeNull();
  });

  it("returns null when the date is unparseable (0 or NaN)", async () => {
    (dataStorage.getItem as jest.Mock).mockImplementation((k: string) =>
      Promise.resolve(k.endsWith("_date") ? "0" : '{"x":1}'),
    );
    expect(await readCachedValue("key")).toBeNull();
  });

  it("returns null when the value is missing even if the date is present", async () => {
    (dataStorage.getItem as jest.Mock).mockImplementation((k: string) =>
      Promise.resolve(k.endsWith("_date") ? String(Date.now()) : null),
    );
    expect(await readCachedValue("key")).toBeNull();
  });

  it("returns null when the cached JSON is malformed", async () => {
    (dataStorage.getItem as jest.Mock).mockImplementation((k: string) =>
      Promise.resolve(k.endsWith("_date") ? String(Date.now()) : "not json"),
    );
    expect(await readCachedValue("key")).toBeNull();
  });

  it("returns parsed data + age when both keys are present and well-formed", async () => {
    const cachedAt = Date.now() - 5000; // 5 seconds ago
    (dataStorage.getItem as jest.Mock).mockImplementation((k: string) =>
      Promise.resolve(k.endsWith("_date") ? String(cachedAt) : '{"foo":"bar"}'),
    );
    const result = await readCachedValue<{ foo: string }>("key");
    expect(result?.data).toEqual({ foo: "bar" });
    expect(result?.age).toBeGreaterThanOrEqual(5000);
    expect(result?.age).toBeLessThan(10_000);
  });
});
