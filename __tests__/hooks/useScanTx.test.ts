import { act, renderHook } from "@testing-library/react-hooks";
import { useScanTx } from "hooks/useScanTx";
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

jest.mock("services/blockaidSDK", () => ({
  scanTransactionSDK: jest.fn(),
  isBlockaidSDKAvailable: jest.fn(),
}));

describe("useScanTx", () => {
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
      const { result } = renderHook(() => useScanTx());

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.refetch).toBe("function");
      expect(typeof result.current.scanTransaction).toBe("function");
    });
  });

  describe("scanTransaction function", () => {
    it("successfully scans a transaction when SDK is available", async () => {
      mockScanTransactionSDK.mockResolvedValue(mockSuccessResponse);
      const { result } = renderHook(() => useScanTx());

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
      expect(mockScanTransactionSDK).toHaveBeenCalledWith(mockTxParams);
    });

    it("sets loading state during scan", async () => {
      let resolvePromise: (value: BlockAidScanTxResult | null) => void;
      const pendingPromise = new Promise<BlockAidScanTxResult | null>(
        (resolve) => {
          resolvePromise = resolve;
        },
      );

      mockScanTransactionSDK.mockReturnValue(pendingPromise);
      const { result } = renderHook(() => useScanTx());

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

    it("handles SDK errors gracefully", async () => {
      const mockError = new Error("Network error");
      mockScanTransactionSDK.mockRejectedValue(mockError);
      const { result } = renderHook(() => useScanTx());

      await act(async () => {
        await result.current.scanTransaction(mockTxParams);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Network error");
    });

    it("throws error when SDK is not available", async () => {
      mockIsBlockaidSDKAvailable.mockReturnValue(false);
      const { result } = renderHook(() => useScanTx());

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
      mockScanTransactionSDK.mockResolvedValue(mockRiskyResponse);
      const { result } = renderHook(() => useScanTx());

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
