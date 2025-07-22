import { act, renderHook } from "@testing-library/react-hooks";
import { useScanTransaction } from "hooks/useScanTransaction";
import * as backend from "services/backend";
import * as blockaidSDK from "services/blockaidSDK";
import type { ScanTxParams, BlockAidScanTxResult } from "types/blockaid";

// Mock dependencies
jest.mock("config/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("services/backend", () => ({
  scanTransactionBackend: jest.fn(),
}));

jest.mock("services/blockaidSDK", () => ({
  scanTransactionSDK: jest.fn(),
  isBlockaidSDKAvailable: jest.fn(),
}));

describe("useScanTransaction", () => {
  const mockScanTransactionBackend = jest.mocked(
    backend.scanTransactionBackend,
  );
  const mockScanTransactionSDK = jest.mocked(blockaidSDK.scanTransactionSDK);
  const mockIsBlockaidSDKAvailable = jest.mocked(
    blockaidSDK.isBlockaidSDKAvailable,
  );

  // Sample test data
  const mockTxParams: ScanTxParams = {
    xdr: "AAAA...XDR...",
    sourceAccount: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    network: "public",
  };

  const mockSuccessResponse: BlockAidScanTxResult = {
    status: "safe",
    result_type: "benign",
    validation: {
      status: "safe",
      warnings: [],
      errors: [],
    },
    simulation: {
      status: "safe",
      account_summary: {
        account_exposures: [
          {
            asset: "XLM",
            spender: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            amount: "0",
          },
        ],
      },
    },
  };

  const mockRiskyResponse: BlockAidScanTxResult = {
    status: "malicious",
    result_type: "malicious",
    validation: {
      status: "safe",
      warnings: [
        {
          level: "warning",
          title: "High gas fee",
          description: "High gas fee detected",
          category: "warning",
          message: "Transaction fee is unusually high",
        },
      ],
      errors: [],
    },
    simulation: {
      status: "warning",
      account_summary: {
        account_exposures: [
          {
            asset: "USDC",
            spender: "malicious_contract",
            amount: "1000",
          },
        ],
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBlockaidSDKAvailable.mockReturnValue(true);
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const { result } = renderHook(() => useScanTransaction());

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.refetch).toBe("function");
      expect(typeof result.current.scanTransaction).toBe("function");
    });
  });

  describe("scanTransaction function", () => {
    it("successfully scans a transaction using backend", async () => {
      mockScanTransactionBackend.mockResolvedValue(mockSuccessResponse);
      const { result } = renderHook(() => useScanTransaction());

      await act(async () => {
        await result.current.scanTransaction(mockTxParams);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.raw).toEqual(mockSuccessResponse);
      expect(result.current.data?.validation).toEqual(
        mockSuccessResponse.validation,
      );
      expect(mockScanTransactionBackend).toHaveBeenCalledWith(mockTxParams);
    });

    it("falls back to SDK when backend fails", async () => {
      mockScanTransactionBackend.mockResolvedValue(null);
      mockScanTransactionSDK.mockResolvedValue(mockSuccessResponse);
      const { result } = renderHook(() => useScanTransaction());

      await act(async () => {
        await result.current.scanTransaction(mockTxParams);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.raw).toEqual(mockSuccessResponse);
      expect(mockScanTransactionBackend).toHaveBeenCalledWith(mockTxParams);
      expect(mockScanTransactionSDK).toHaveBeenCalledWith(mockTxParams);
    });

    it("sets loading state during scan", async () => {
      let resolvePromise: (value: BlockAidScanTxResult | null) => void;
      const pendingPromise = new Promise<BlockAidScanTxResult | null>(
        (resolve) => {
          resolvePromise = resolve;
        },
      );

      mockScanTransactionBackend.mockReturnValue(pendingPromise);
      const { result } = renderHook(() => useScanTransaction());

      act(() => {
        result.current.scanTransaction(mockTxParams);
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();

      // eslint-disable-next-line @typescript-eslint/await-thenable
      await act(() => {
        resolvePromise(mockSuccessResponse);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.raw).toEqual(mockSuccessResponse);
    });

    it("handles errors gracefully", async () => {
      const mockError = new Error("Network error");
      mockScanTransactionBackend.mockRejectedValue(mockError);
      const { result } = renderHook(() => useScanTransaction());

      await act(async () => {
        await result.current.scanTransaction(mockTxParams);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Network error");
    });

    it("throws error when both backend and SDK fail", async () => {
      mockScanTransactionBackend.mockResolvedValue(null);
      mockScanTransactionSDK.mockResolvedValue(null);
      const { result } = renderHook(() => useScanTransaction());

      await act(async () => {
        await result.current.scanTransaction(mockTxParams);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe(
        "Transaction scan not available",
      );
    });

    it("handles risky transactions correctly", async () => {
      mockScanTransactionBackend.mockResolvedValue(mockRiskyResponse);
      const { result } = renderHook(() => useScanTransaction());

      await act(async () => {
        await result.current.scanTransaction(mockTxParams);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.error).toBeNull();

      const { data } = result.current;
      expect(data?.raw?.status).toBe("malicious");
      expect(data?.simulation?.status).toBe("warning");
      expect(data?.simulation?.accountExposures).toHaveLength(1);
    });
  });
});
