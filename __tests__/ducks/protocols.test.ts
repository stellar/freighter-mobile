import { act, renderHook } from "@testing-library/react-native";
import { useProtocolsStore } from "ducks/protocols";
import { fetchProtocols } from "services/backend";

// Mock the backend service
jest.mock("services/backend", () => ({
  fetchProtocols: jest.fn(),
}));

const mockFetchProtocols = fetchProtocols as jest.MockedFunction<
  typeof fetchProtocols
>;

describe("Protocols Store", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Reset the store state
    const { result } = renderHook(() => useProtocolsStore());
    act(() => {
      result.current.protocols = [];
      result.current.isLoading = false;
      result.current.lastUpdated = null;
    });
  });

  describe("Initial State", () => {
    it("should have correct initial state", () => {
      const { result } = renderHook(() => useProtocolsStore());

      expect(result.current.protocols).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.lastUpdated).toBeNull();
      expect(typeof result.current.fetchProtocols).toBe("function");
    });
  });

  describe("fetchProtocols", () => {
    it("should fetch protocols successfully", async () => {
      const mockProtocols = [
        {
          description: "Test Protocol 1",
          iconUrl: "https://example.com/icon1.png",
          name: "TestProtocol1",
          websiteUrl: "https://test1.example.com",
          tags: ["test", "protocol"],
        },
        {
          description: "Test Protocol 2",
          iconUrl: "https://example.com/icon2.png",
          name: "TestProtocol2",
          websiteUrl: "https://test2.example.com",
          tags: ["test", "protocol"],
        },
      ];

      mockFetchProtocols.mockResolvedValue(mockProtocols);

      const { result } = renderHook(() => useProtocolsStore());

      await act(async () => {
        await result.current.fetchProtocols();
      });

      expect(mockFetchProtocols).toHaveBeenCalledTimes(1);
      expect(result.current.protocols).toEqual(mockProtocols);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.lastUpdated).toBeGreaterThan(0);
    });

    it("should handle loading state correctly", async () => {
      // Create a promise that we can control
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise<any>((resolve) => {
        resolvePromise = resolve;
      });

      mockFetchProtocols.mockReturnValue(pendingPromise);

      const { result } = renderHook(() => useProtocolsStore());

      // Start the fetch
      act(() => {
        result.current.fetchProtocols();
      });

      // Check that loading state is true
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        resolvePromise!([
          {
            description: "Test Protocol",
            iconUrl: "https://example.com/icon.png",
            name: "TestProtocol",
            websiteUrl: "https://test.example.com",
            tags: ["test"],
          },
        ]);
      });

      // Check that loading state is false after completion
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Network error");
      mockFetchProtocols.mockRejectedValue(error);

      const { result } = renderHook(() => useProtocolsStore());

      // Set some initial protocols to test that they're preserved on error
      act(() => {
        result.current.protocols = [
          {
            description: "Existing Protocol",
            iconUrl: "https://example.com/existing.png",
            name: "ExistingProtocol",
            websiteUrl: "https://existing.example.com",
            tags: ["existing"],
          },
        ];
      });

      await act(async () => {
        await result.current.fetchProtocols();
      });

      expect(mockFetchProtocols).toHaveBeenCalledTimes(1);
      // Should preserve existing protocols on error
      expect(result.current.protocols).toEqual([
        {
          description: "Existing Protocol",
          iconUrl: "https://example.com/existing.png",
          name: "ExistingProtocol",
          websiteUrl: "https://existing.example.com",
          tags: ["existing"],
        },
      ]);
      expect(result.current.isLoading).toBe(false);
    });

    it("should update lastUpdated timestamp on successful fetch", async () => {
      const mockProtocols = [
        {
          description: "Test Protocol",
          iconUrl: "https://example.com/icon.png",
          name: "TestProtocol",
          websiteUrl: "https://test.example.com",
          tags: ["test"],
        },
      ];

      mockFetchProtocols.mockResolvedValue(mockProtocols);

      const { result } = renderHook(() => useProtocolsStore());

      const beforeFetch = Date.now();

      await act(async () => {
        await result.current.fetchProtocols();
      });

      const afterFetch = Date.now();

      expect(result.current.lastUpdated).toBeGreaterThanOrEqual(beforeFetch);
      expect(result.current.lastUpdated).toBeLessThanOrEqual(afterFetch);
    });
  });

  describe("Store State Management", () => {
    it("should update protocols list on multiple fetches", async () => {
      const firstFetch = [
        {
          description: "First Protocol",
          iconUrl: "https://example.com/first.png",
          name: "FirstProtocol",
          websiteUrl: "https://first.example.com",
          tags: ["first"],
        },
      ];

      const secondFetch = [
        {
          description: "Second Protocol",
          iconUrl: "https://example.com/second.png",
          name: "SecondProtocol",
          websiteUrl: "https://second.example.com",
          tags: ["second"],
        },
      ];

      mockFetchProtocols
        .mockResolvedValueOnce(firstFetch)
        .mockResolvedValueOnce(secondFetch);

      const { result } = renderHook(() => useProtocolsStore());

      // First fetch
      await act(async () => {
        await result.current.fetchProtocols();
      });

      expect(result.current.protocols).toEqual(firstFetch);

      // Second fetch
      await act(async () => {
        await result.current.fetchProtocols();
      });

      expect(result.current.protocols).toEqual(secondFetch);
    });
  });
});
