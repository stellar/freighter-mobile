import { act, renderHook } from "@testing-library/react-hooks";
import { useScanSite } from "hooks/useScanSite";
import * as backend from "services/backend";
import * as blockaidSDK from "services/blockaidSDK";
import type { ScanSiteParams, BlockAidScanSiteResult } from "types/blockaid";

// Mock dependencies
jest.mock("config/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("services/backend", () => ({
  scanSiteBackend: jest.fn(),
}));

jest.mock("services/blockaidSDK", () => ({
  scanSiteSDK: jest.fn(),
  isBlockaidSDKAvailable: jest.fn(),
}));

describe("useScanSite", () => {
  const mockScanSiteBackend = jest.mocked(backend.scanSiteBackend);
  const mockScanSiteSDK = jest.mocked(blockaidSDK.scanSiteSDK);
  const mockIsBlockaidSDKAvailable = jest.mocked(
    blockaidSDK.isBlockaidSDKAvailable,
  );

  // Sample test data
  const mockSiteParams: ScanSiteParams = {
    url: "https://example.com",
  };

  const mockSafeResponse: BlockAidScanSiteResult = {
    status: "safe",
    result_type: "benign",
    url: "https://example.com",
    is_reachable: true,
    is_web3_site: true,
    is_malicious: false,
    network_operations: ["eth_sendTransaction"],
    json_rpc_operations: ["eth_accounts"],
  };

  const mockMaliciousResponse: BlockAidScanSiteResult = {
    status: "malicious",
    result_type: "malicious",
    url: "https://malicious-site.com",
    is_reachable: true,
    is_web3_site: true,
    is_malicious: true,
    attack_types: { phishing: true },
    features: [
      {
        feature_id: "suspicious_domain",
        type: "warning",
        description: "Domain recently registered",
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBlockaidSDKAvailable.mockReturnValue(true);
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const { result } = renderHook(() => useScanSite());

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.refetch).toBe("function");
      expect(typeof result.current.scanSite).toBe("function");
    });
  });

  describe("scanSite function", () => {
    it("successfully scans a site using backend", async () => {
      mockScanSiteBackend.mockResolvedValue(mockSafeResponse);
      const { result } = renderHook(() => useScanSite());

      await act(async () => {
        await result.current.scanSite(mockSiteParams);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toEqual(mockSafeResponse);
      expect(mockScanSiteBackend).toHaveBeenCalledWith(mockSiteParams);
    });

    it("falls back to SDK when backend fails", async () => {
      mockScanSiteBackend.mockResolvedValue(null);
      mockScanSiteSDK.mockResolvedValue(mockSafeResponse);
      const { result } = renderHook(() => useScanSite());

      await act(async () => {
        await result.current.scanSite(mockSiteParams);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toEqual(mockSafeResponse);
      expect(mockScanSiteBackend).toHaveBeenCalledWith(mockSiteParams);
      expect(mockScanSiteSDK).toHaveBeenCalledWith(mockSiteParams);
    });

    it("sets loading state during scan", async () => {
      let resolvePromise: (value: BlockAidScanSiteResult | null) => void;
      const pendingPromise = new Promise<BlockAidScanSiteResult | null>(
        (resolve) => {
          resolvePromise = resolve;
        },
      );

      mockScanSiteBackend.mockReturnValue(pendingPromise);
      const { result } = renderHook(() => useScanSite());

      act(() => {
        result.current.scanSite(mockSiteParams);
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();

      // eslint-disable-next-line @typescript-eslint/await-thenable
      await act(() => {
        resolvePromise(mockSafeResponse);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(mockSafeResponse);
    });

    it("handles errors gracefully", async () => {
      const mockError = new Error("Network error");
      mockScanSiteBackend.mockRejectedValue(mockError);
      const { result } = renderHook(() => useScanSite());

      await act(async () => {
        await result.current.scanSite(mockSiteParams);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Network error");
    });

    it("throws error when both backend and SDK fail", async () => {
      mockScanSiteBackend.mockResolvedValue(null);
      mockScanSiteSDK.mockResolvedValue(null);
      const { result } = renderHook(() => useScanSite());

      await act(async () => {
        await result.current.scanSite(mockSiteParams);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Site scan not available");
    });

    it("handles malicious sites correctly", async () => {
      mockScanSiteBackend.mockResolvedValue(mockMaliciousResponse);
      const { result } = renderHook(() => useScanSite());

      await act(async () => {
        await result.current.scanSite({
          url: "https://malicious-site.com",
        });
      });

      expect(result.current.data).toEqual(mockMaliciousResponse);
      expect(result.current.error).toBeNull();

      const data = result.current.data as {
        is_malicious?: boolean;
        attack_types?: unknown;
        features?: unknown[];
      };
      expect(data.is_malicious).toBe(true);
      expect(data.attack_types).toBeDefined();
      expect(data.features).toHaveLength(1);
    });
  });
});
