import { act, renderHook } from "@testing-library/react-hooks";
import { useScanAsset } from "hooks/useScanAsset";
import * as backend from "services/backend";
import * as blockaidSDK from "services/blockaidSDK";
import type { ScanAssetParams, BlockAidScanAssetResult } from "types/blockaid";

// Mock dependencies
jest.mock("config/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("services/backend", () => ({
  scanAssetBackend: jest.fn(),
}));

jest.mock("services/blockaidSDK", () => ({
  scanAssetSDK: jest.fn(),
  isBlockaidSDKAvailable: jest.fn(),
}));

describe("useScanAsset", () => {
  const mockScanAssetBackend = jest.mocked(backend.scanAssetBackend);
  const mockScanAssetSDK = jest.mocked(blockaidSDK.scanAssetSDK);
  const mockIsBlockaidSDKAvailable = jest.mocked(
    blockaidSDK.isBlockaidSDKAvailable,
  );

  // Sample test data
  const mockAssetParams: ScanAssetParams = {
    assetCode: "USDC",
    assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    network: "public",
  };

  const mockSuccessResponse: BlockAidScanAssetResult = {
    status: "safe",
    result_type: "benign",
    chain: "stellar",
    address: "USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    metadata: {
      name: "USD Coin",
      symbol: "USDC",
      decimals: 7,
    },
    financial_stats: {
      holders_count: 150,
      supply: "1000000",
      usd_price_per_unit: "1.00",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBlockaidSDKAvailable.mockReturnValue(true);
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const { result } = renderHook(() => useScanAsset());

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.refetch).toBe("function");
      expect(typeof result.current.scanAsset).toBe("function");
    });
  });

  describe("scanAsset function", () => {
    it("successfully scans an asset using backend", async () => {
      mockScanAssetBackend.mockResolvedValue(mockSuccessResponse);
      const { result } = renderHook(() => useScanAsset());

      await act(async () => {
        await result.current.scanAsset(mockAssetParams);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toEqual(mockSuccessResponse);
      expect(mockScanAssetBackend).toHaveBeenCalledWith(mockAssetParams);
    });

    it("falls back to SDK when backend fails", async () => {
      mockScanAssetBackend.mockResolvedValue(null);
      mockScanAssetSDK.mockResolvedValue(mockSuccessResponse);
      const { result } = renderHook(() => useScanAsset());

      await act(async () => {
        await result.current.scanAsset(mockAssetParams);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toEqual(mockSuccessResponse);
      expect(mockScanAssetBackend).toHaveBeenCalledWith(mockAssetParams);
      expect(mockScanAssetSDK).toHaveBeenCalledWith(mockAssetParams);
    });

    it("sets loading state during scan", async () => {
      let resolvePromise: (value: BlockAidScanAssetResult | null) => void;
      const pendingPromise = new Promise<BlockAidScanAssetResult | null>(
        (resolve) => {
          resolvePromise = resolve;
        },
      );

      mockScanAssetBackend.mockReturnValue(pendingPromise);
      const { result } = renderHook(() => useScanAsset());

      act(() => {
        result.current.scanAsset(mockAssetParams);
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();

      // eslint-disable-next-line @typescript-eslint/await-thenable
      await act(() => {
        resolvePromise(mockSuccessResponse);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(mockSuccessResponse);
    });

    it("handles errors gracefully", async () => {
      const mockError = new Error("Network error");
      mockScanAssetBackend.mockRejectedValue(mockError);
      const { result } = renderHook(() => useScanAsset());

      await act(async () => {
        await result.current.scanAsset(mockAssetParams);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Network error");
    });

    it("throws error when both backend and SDK fail", async () => {
      mockScanAssetBackend.mockResolvedValue(null);
      mockScanAssetSDK.mockResolvedValue(null);
      const { result } = renderHook(() => useScanAsset());

      await act(async () => {
        await result.current.scanAsset(mockAssetParams);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Asset scan not available");
    });
  });
});
