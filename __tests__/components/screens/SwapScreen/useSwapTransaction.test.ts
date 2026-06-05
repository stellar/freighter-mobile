/* eslint-disable @fnando/consistent-import/consistent-import */
import { renderHook, act } from "@testing-library/react-hooks";
import { useSwapTransaction } from "components/screens/SwapScreen/hooks/useSwapTransaction";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import type { ActiveAccount } from "ducks/auth";
import { useSwapStore } from "ducks/swap";

const mockSignTransaction = jest.fn();
const mockSubmitTransaction = jest.fn();
const mockBuildSwapTransaction = jest.fn().mockResolvedValue("xdr");
const mockShowToast = jest.fn();
const mockTrackTransactionError = jest.fn();
const mockTrackSwapSuccess = jest.fn();
const mockTrack = jest.fn();
const mockScanTransaction = jest.fn().mockResolvedValue({});

jest.mock("ducks/transactionBuilder", () => ({
  useTransactionBuilderStore: Object.assign(
    () => ({
      buildSwapTransaction: mockBuildSwapTransaction,
      signTransaction: mockSignTransaction,
      submitTransaction: mockSubmitTransaction,
    }),
    {
      getState: () => ({ error: "Submit error from store" }),
    },
  ),
}));

jest.mock("ducks/swapSettings", () => ({
  useSwapSettingsStore: Object.assign(() => ({}), {
    getState: () => ({
      swapFee: "100",
      swapTimeout: "30",
      swapSlippage: "0.5",
    }),
  }),
}));

jest.mock("ducks/history", () => ({
  useHistoryStore: () => ({ fetchAccountHistory: jest.fn() }),
}));

jest.mock("hooks/blockaid/useBlockaidTransaction", () => ({
  useBlockaidTransaction: () => ({ scanTransaction: mockScanTransaction }),
}));

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("services/analytics", () => ({
  analytics: {
    track: jest.fn((...args) => mockTrack(...args)),
    trackTransactionError: jest.fn((...args) =>
      mockTrackTransactionError(...args),
    ),
    trackSwapSuccess: jest.fn((...args) => mockTrackSwapSuccess(...args)),
  },
}));

const mockNavigation = {
  reset: jest.fn(),
} as unknown as Parameters<typeof useSwapTransaction>[0]["navigation"];

const baseParams: Parameters<typeof useSwapTransaction>[0] = {
  sourceAmount: "1",
  sourceBalance: { tokenCode: "XLM" } as never,
  destinationBalance: { tokenCode: "USDC" } as never,
  pathResult: {
    path: [],
    destinationAmount: "1",
    destinationAmountMin: "0.99",
  } as never,
  account: {
    publicKey: "GA...",
    privateKey: "SA...",
  } as ActiveAccount,
  network: NETWORKS.PUBLIC,
  navigation: mockNavigation,
};

describe("useSwapTransaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useSwapStore.getState().resetSwap();
    });
  });

  describe("executeSwap rejection contract", () => {
    it("does NOT reject when submitTransaction returns null (failure)", async () => {
      // submitTransaction returns null on failure - the hook reads the
      // error from the store and throws inside the try, where the catch
      // handles toast / analytics. The catch must NOT rethrow, otherwise
      // SwapAmountScreen's fire-and-forget call site would surface an
      // unhandled promise rejection at the global handler.
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue(null);

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      // Should resolve, not reject.
      let didReject = false;
      await act(async () => {
        await result.current.executeSwap().catch(() => {
          didReject = true;
        });
      });

      expect(didReject).toBe(false);
      // Side effects should still run despite no rethrow.
      expect(mockTrackTransactionError).toHaveBeenCalledWith(
        expect.objectContaining({ isSwap: true }),
      );
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("does NOT reject when submitTransaction throws synchronously", async () => {
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockRejectedValue(new Error("Submit failed"));

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      let didReject = false;
      await act(async () => {
        await result.current.executeSwap().catch(() => {
          didReject = true;
        });
      });

      expect(didReject).toBe(false);
      expect(mockTrackTransactionError).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalled();
    });

    it("does NOT reject when signTransaction returns null", async () => {
      mockSignTransaction.mockReturnValue(null);

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      let didReject = false;
      await act(async () => {
        await result.current.executeSwap().catch(() => {
          didReject = true;
        });
      });

      expect(didReject).toBe(false);
      expect(mockShowToast).toHaveBeenCalled();
    });

    it("resolves successfully on a successful swap (sanity check)", async () => {
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue("tx-hash");

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await result.current.executeSwap();
      });

      expect(mockTrackSwapSuccess).toHaveBeenCalled();
      expect(mockTrackTransactionError).not.toHaveBeenCalled();
    });
  });

  describe("setupSwapTransaction — includeTrustline wiring", () => {
    it("passes includeTrustline when destinationToken.isNew is true", async () => {
      act(() => {
        useSwapStore.setState({
          destinationToken: {
            id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            tokenCode: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            decimals: 7,
            tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
            isNew: true,
          },
        } as never);
      });

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await result.current.setupSwapTransaction();
      });

      expect(mockBuildSwapTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          includeTrustline: {
            tokenCode: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          },
        }),
      );
    });

    it("omits includeTrustline when destinationToken.isNew is false", async () => {
      act(() => {
        useSwapStore.setState({
          destinationToken: {
            id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            tokenCode: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            decimals: 7,
            tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
            isNew: false,
          },
        } as never);
      });

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await result.current.setupSwapTransaction();
      });

      expect(mockBuildSwapTransaction).toHaveBeenCalled();
      const callArgs = mockBuildSwapTransaction.mock.calls[0][0];
      expect(callArgs.includeTrustline).toBeUndefined();
    });

    it("throws when isNew=true but issuer is missing on destinationToken", async () => {
      act(() => {
        useSwapStore.setState({
          destinationToken: {
            id: "BROKEN",
            tokenCode: "BROKEN",
            // issuer intentionally omitted
            decimals: 7,
            tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
            isNew: true,
          },
        } as never);
      });

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await expect(
        act(async () => {
          await result.current.setupSwapTransaction();
        }),
      ).rejects.toThrow(/isNew=true but issuer missing/);

      // mockBuildSwapTransaction should NOT have been called — we threw before reaching it
      expect(mockBuildSwapTransaction).not.toHaveBeenCalled();
    });
  });

  describe("SWAP_TRUSTLINE_ADDED analytics", () => {
    beforeEach(() => {
      mockTrack.mockClear();
    });

    it("fires SWAP_TRUSTLINE_ADDED when the swap succeeds and destinationToken.isNew is true", async () => {
      act(() => {
        useSwapStore.setState({
          destinationToken: {
            id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            tokenCode: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            decimals: 7,
            tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
            isNew: true,
          },
        } as never);
      });

      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue("tx-hash");

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await result.current.executeSwap();
      });

      expect(mockTrack).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_TRUSTLINE_ADDED,
        expect.objectContaining({
          tokenCode: "USDC",
          tokenIssuer: expect.any(String),
        }),
      );
    });

    it("does NOT fire SWAP_TRUSTLINE_ADDED when the swap succeeds but destinationToken.isNew is false", async () => {
      act(() => {
        useSwapStore.setState({
          destinationToken: {
            id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            tokenCode: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            decimals: 7,
            tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
            isNew: false,
          },
        } as never);
      });

      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue("tx-hash");

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await result.current.executeSwap();
      });

      expect(mockTrack).not.toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_TRUSTLINE_ADDED,
        expect.anything(),
      );
    });
  });
});
