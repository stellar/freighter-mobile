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
const mockGetBuilderState = jest.fn();

jest.mock("ducks/transactionBuilder", () => ({
  useTransactionBuilderStore: Object.assign(
    () => ({
      buildSwapTransaction: mockBuildSwapTransaction,
      signTransaction: mockSignTransaction,
      submitTransaction: mockSubmitTransaction,
    }),
    {
      getState: () => mockGetBuilderState(),
    },
  ),
}));

// Volume telemetry's identity classification / price snapshot runs
// unconditionally at the top of executeSwap, on every path (success,
// failure, quote-expired, signing failure) — these dependencies need a
// mock even for tests that only care about the pre-existing toast/analytics
// contract.
jest.mock("ducks/balances", () => ({
  useBalancesStore: { getState: () => ({ balances: {} }) },
}));
jest.mock("ducks/remoteConfig", () => ({
  useRemoteConfigStore: { getState: () => ({ use_token_prices_v2: true }) },
}));
// Stubs the network boundary only — startConfirmationPriceSnapshot itself
// runs for real, so its cancel()/resolve() contract is still exercised.
const mockFetchTokenPrices = jest.fn().mockResolvedValue({});
jest.mock("services/backend", () => ({
  fetchTokenPrices: (...args: unknown[]) => mockFetchTokenPrices(...args),
}));
// `signTransaction` is mocked to return the literal string "signed-xdr" in
// most of this file's tests, which isn't parseable XDR — stub
// TransactionBuilder.fromXdr (used only on the settled-swap success path,
// to find the pathPaymentStrictSend operation index) rather than construct
// real transaction XDR in every fixture.
jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    TransactionBuilder: {
      ...actual.TransactionBuilder,
      fromXdr: jest.fn(() => ({ operations: [] })),
    },
  };
});

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
  // Source and destination amounts use distinct values so payload
  // assertions can detect a silent source/dest swap regression — using
  // "1" for both would let `sourceAmount` and `destAmount` be transposed
  // without any test failing.
  sourceAmount: "1",
  sourceBalance: { tokenCode: "XLM" } as never,
  destinationTokenInput: { tokenCode: "USDC" } as never,
  pathResult: {
    path: [],
    destinationAmount: "2.5",
    destinationAmountMin: "2.4",
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
    mockGetBuilderState.mockReturnValue({ error: "Submit error from store" });
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
        expect.objectContaining({
          isSwap: true,
          sourceToken: "XLM",
          destToken: "USDC",
          sourceAmount: "1",
          destAmount: "2.5",
        }),
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
      // Failure-path analytics still carry the swap context on a synchronous
      // throw — a regression that strips the payload on this branch alone
      // would have gone unnoticed without an explicit assertion.
      expect(mockTrackTransactionError).toHaveBeenCalledWith(
        expect.objectContaining({
          isSwap: true,
          sourceToken: "XLM",
          destToken: "USDC",
          sourceAmount: "1",
          destAmount: "2.5",
        }),
      );
      expect(mockShowToast).toHaveBeenCalled();
    });

    it("does NOT reject when signTransaction returns null, and emits swap.failed without volume data", async () => {
      mockSignTransaction.mockReturnValue(null);

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      let didReject = false;
      await act(async () => {
        await result.current.executeSwap().catch(() => {
          didReject = true;
        });
      });

      expect(didReject).toBe(false);
      // A signing failure is still the flow's outcome, so swap.failed fires —
      // but it never reached the network, so there is no attempted volume to
      // report and `volume` is absent. The user still sees a toast.
      expect(mockTrackTransactionError).toHaveBeenCalledTimes(1);
      const [failurePayload] = mockTrackTransactionError.mock.calls[0] as [
        { volume?: unknown; isSwap?: boolean },
      ];
      expect(failurePayload.isSwap).toBe(true);
      expect(failurePayload.volume).toBeUndefined();
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("issues no confirmation price fetch at all when signing fails pre-submit", async () => {
      mockSignTransaction.mockReturnValue(null);

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await result.current.executeSwap();
      });

      // The snapshot starts only once signing has succeeded, so a signing
      // failure never issues a price request it would just have to abort.
      expect(mockFetchTokenPrices).not.toHaveBeenCalled();
    });

    it("starts the confirmation price fetch only after signing succeeds", async () => {
      const callOrder: string[] = [];
      mockSignTransaction.mockImplementation(() => {
        callOrder.push("sign");
        return "signed-xdr";
      });
      mockFetchTokenPrices.mockImplementation(() => {
        callOrder.push("fetchPrices");
        return Promise.resolve({});
      });
      mockSubmitTransaction.mockImplementation(() => {
        callOrder.push("submit");
        return Promise.resolve("tx-hash");
      });

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await result.current.executeSwap();
      });

      // Prices are snapshotted as close to execution as possible: after
      // signing, immediately before submission.
      expect(callOrder).toEqual(["sign", "fetchPrices", "submit"]);
    });

    it("resolves successfully on a successful swap (sanity check)", async () => {
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue("tx-hash");

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await result.current.executeSwap();
      });

      expect(mockTrackSwapSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceToken: "XLM",
          destToken: "USDC",
          sourceAmount: "1",
          destAmount: "2.5",
          isSwap: true,
        }),
      );
      expect(mockTrackTransactionError).not.toHaveBeenCalled();
    });
  });

  describe("setupSwapTransaction — includeTrustline wiring", () => {
    it("passes includeTrustline when destinationToken.requiresTrustline is true", async () => {
      act(() => {
        useSwapStore.setState({
          destinationToken: {
            id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            tokenCode: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            decimals: 7,
            tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
            requiresTrustline: true,
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

    it("omits includeTrustline when destinationToken.requiresTrustline is false", async () => {
      act(() => {
        useSwapStore.setState({
          destinationToken: {
            id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            tokenCode: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            decimals: 7,
            tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
            requiresTrustline: false,
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

    it("throws when requiresTrustline=true but issuer is missing on destinationToken", async () => {
      act(() => {
        useSwapStore.setState({
          destinationToken: {
            id: "BROKEN",
            tokenCode: "BROKEN",
            // issuer intentionally omitted
            decimals: 7,
            tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
            requiresTrustline: true,
          },
        } as never);
      });

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await expect(
        act(async () => {
          await result.current.setupSwapTransaction();
        }),
      ).rejects.toThrow(/requiresTrustline=true but issuer missing/);

      // mockBuildSwapTransaction should NOT have been called — we threw before reaching it
      expect(mockBuildSwapTransaction).not.toHaveBeenCalled();
    });
  });

  describe("SWAP_TRUSTLINE_ADDED analytics", () => {
    beforeEach(() => {
      mockTrack.mockClear();
    });

    it("fires SWAP_TRUSTLINE_ADDED when the swap succeeds and destinationToken.requiresTrustline is true", async () => {
      act(() => {
        useSwapStore.setState({
          destinationToken: {
            id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            tokenCode: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            decimals: 7,
            tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
            requiresTrustline: true,
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
          asset_code: "USDC",
          asset_issuer: expect.any(String),
        }),
      );
    });

    it("does NOT fire SWAP_TRUSTLINE_ADDED when the swap succeeds but destinationToken.requiresTrustline is false", async () => {
      act(() => {
        useSwapStore.setState({
          destinationToken: {
            id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            tokenCode: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            decimals: 7,
            tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
            requiresTrustline: false,
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

  describe("SWAP_QUOTE_EXPIRED analytics", () => {
    it("fires SWAP_QUOTE_EXPIRED with the result code, AND also swap.failed with failure_category slippage, when the submit is rejected with op_under_dest_min", async () => {
      mockGetBuilderState.mockReturnValue({
        error: "tx_failed",
        submitErrorResultCodes: {
          transaction: "tx_failed",
          operations: ["op_under_dest_min"],
        },
        submitErrorHttpStatus: 400,
        submitErrorIsProtocolAnswer: true,
      });
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue(null);

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await result.current.executeSwap().catch(() => {});
      });

      expect(mockTrack).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_QUOTE_EXPIRED,
        expect.objectContaining({
          from_asset_code: "XLM",
          to_asset_code: "USDC",
          result_code: "op_under_dest_min",
        }),
      );
      // Amounts are intentionally no longer emitted (parity with completed/failed).
      const quoteExpiredCall = mockTrack.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as AnalyticsEvent) === AnalyticsEvent.SWAP_QUOTE_EXPIRED,
      );
      expect(quoteExpiredCall?.[1]).not.toHaveProperty("sourceAmount");
      expect(quoteExpiredCall?.[1]).not.toHaveProperty("destAmount");
      expect(quoteExpiredCall?.[1]).not.toHaveProperty("allowedSlippage");
      // A submit-time quote expiry also emits swap.failed with
      // failure_category: slippage, so the failure it represents reaches a
      // volume-bearing event. swap.quote_expired is unchanged and carries no
      // volume, so the pair can't double-count.
      expect(mockTrackTransactionError).toHaveBeenCalledWith(
        expect.objectContaining({
          isSwap: true,
          errorCode: "op_under_dest_min",
          volume: expect.objectContaining({
            failureCategory: "slippage",
            reasonCode: "op_under_dest_min",
          }),
        }),
      );
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "error",
          title: "swapScreen.errors.quoteExpired",
          toastId: "swap-quote-expired",
        }),
      );
    });

    it("fires the generic SWAP_FAIL (not SWAP_QUOTE_EXPIRED) for a non-quote-expiry rejection", async () => {
      mockGetBuilderState.mockReturnValue({
        error: "tx_insufficient_balance",
        submitErrorResultCodes: {
          transaction: "tx_failed",
          operations: ["op_underfunded"],
        },
      });
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue(null);

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await result.current.executeSwap().catch(() => {});
      });

      expect(mockTrack).not.toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_QUOTE_EXPIRED,
        expect.anything(),
      );
      expect(mockTrackTransactionError).toHaveBeenCalledWith(
        expect.objectContaining({ isSwap: true }),
      );
    });
  });
});
