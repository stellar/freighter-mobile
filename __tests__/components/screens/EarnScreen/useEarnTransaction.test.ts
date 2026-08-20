/* eslint-disable @fnando/consistent-import/consistent-import */
import { renderHook, act } from "@testing-library/react-hooks";
import { useEarnTransaction } from "components/screens/EarnScreen/hooks/useEarnTransaction";
import { NETWORKS } from "config/constants";
import type { ActiveAccount } from "ducks/auth";

const mockSignTransaction = jest.fn();
const mockSubmitTransaction = jest.fn();
const mockGetBuilderState = jest.fn();
const mockSetSubmitFailed = jest.fn();
const mockIsWalletUnlocked = jest.fn();
const mockGetEarnState = jest.fn();
const mockTrackEarnDepositSuccess = jest.fn();
const mockTrackEarnDepositFail = jest.fn();

jest.mock("ducks/transactionBuilder", () => ({
  useTransactionBuilderStore: Object.assign(
    () => ({
      signTransaction: mockSignTransaction,
      submitTransaction: mockSubmitTransaction,
    }),
    {
      getState: () => mockGetBuilderState(),
    },
  ),
}));

jest.mock("ducks/earn", () => ({
  // The hook reads `setSubmitFailed` via a selector
  // (`useEarnStore((state) => state.setSubmitFailed)`), so the mock must
  // support being called with a selector fn, matching how the real zustand
  // hook re-reads live state on every render. It also reads
  // pool/selectedAssetCode/selectedAssetApy via `useEarnStore.getState()`
  // (for the earn.deposit_completed/.failed analytics payload), matching how
  // the real zustand store exposes both the hook and a static `getState`.
  useEarnStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = { setSubmitFailed: mockSetSubmitFailed };
      return selector ? selector(state) : state;
    },
    {
      getState: () => mockGetEarnState(),
    },
  ),
}));

jest.mock("hooks/useGetActiveAccount", () => ({
  isWalletUnlocked: () => mockIsWalletUnlocked(),
}));

jest.mock("services/analytics", () => ({
  analytics: {
    trackEarnDepositSuccess: (...args: unknown[]) =>
      mockTrackEarnDepositSuccess(...args),
    trackEarnDepositFail: (...args: unknown[]) =>
      mockTrackEarnDepositFail(...args),
  },
}));

const account: ActiveAccount = {
  publicKey: "GA...",
  privateKey: "SA...",
  accountName: "Account 1",
  id: "1",
  subentryCount: 0,
};

const baseParams: Parameters<typeof useEarnTransaction>[0] = {
  account,
  network: NETWORKS.TESTNET,
};

describe("useEarnTransaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsWalletUnlocked.mockReturnValue(true);
    mockGetBuilderState.mockReturnValue({ error: "Store error message" });
    mockGetEarnState.mockReturnValue({
      pool: { id: "pool-1" },
      selectedAssetCode: "USDC",
      selectedAssetApy: 0.05,
    });
  });

  it("starts idle", () => {
    const { result } = renderHook(() => useEarnTransaction(baseParams));

    expect(result.current.status).toBe("idle");
    expect(result.current.transactionHash).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("returns to idle WITHOUT signing or submitting when the wallet is locked", async () => {
    mockIsWalletUnlocked.mockReturnValue(false);

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    await act(async () => {
      await result.current.submit();
    });

    expect(mockSignTransaction).not.toHaveBeenCalled();
    expect(mockSubmitTransaction).not.toHaveBeenCalled();
    expect(mockSetSubmitFailed).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("does NOT reject when submit() is called fire-and-forget and the wallet is locked", async () => {
    mockIsWalletUnlocked.mockReturnValue(false);

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    let didReject = false;
    await act(async () => {
      await result.current.submit().catch(() => {
        didReject = true;
      });
    });

    expect(didReject).toBe(false);
  });

  it("sets status to success, records the hash, and calls setSubmitFailed(false) on a clean submit", async () => {
    mockSignTransaction.mockReturnValue("signed-xdr");
    mockSubmitTransaction.mockResolvedValue("tx-hash");

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    await act(async () => {
      await result.current.submit();
    });

    expect(mockSignTransaction).toHaveBeenCalledWith({
      secretKey: account.privateKey,
      network: NETWORKS.TESTNET,
    });
    expect(result.current.status).toBe("success");
    expect(result.current.transactionHash).toBe("tx-hash");
    expect(result.current.error).toBeNull();
    expect(mockSetSubmitFailed).toHaveBeenCalledWith(false);

    // earn.deposit_completed carries only identifiers -- no amount/fiat value.
    expect(mockTrackEarnDepositSuccess).toHaveBeenCalledWith({
      assetCode: "USDC",
      poolId: "pool-1",
      apy: 0.05,
    });
    expect(mockTrackEarnDepositFail).not.toHaveBeenCalled();
  });

  it("sets status to error and calls setSubmitFailed(true), sourcing the message from the store, when signTransaction returns null", async () => {
    mockSignTransaction.mockReturnValue(null);
    mockGetBuilderState.mockReturnValue({
      error: "Failed to sign transaction: bad seed",
    });

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    await act(async () => {
      await result.current.submit();
    });

    expect(mockSubmitTransaction).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Failed to sign transaction: bad seed");
    expect(mockSetSubmitFailed).toHaveBeenCalledWith(true);
  });

  it("sets status to error and calls setSubmitFailed(true), sourcing the message from the store, when submitTransaction returns null", async () => {
    mockSignTransaction.mockReturnValue("signed-xdr");
    mockSubmitTransaction.mockResolvedValue(null);
    mockGetBuilderState.mockReturnValue({
      error: "op_underfunded",
      submitErrorResultCodes: { operations: ["op_underfunded"] },
    });

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("op_underfunded");
    expect(result.current.transactionHash).toBeNull();
    expect(mockSetSubmitFailed).toHaveBeenCalledWith(true);

    // earn.deposit_failed carries the same identifiers plus reason_code --
    // sourced from `submitErrorResultCodes` (NOT threaded through this
    // hook's own return shape), never the free-text error message, and no
    // amount/fiat value.
    expect(mockTrackEarnDepositFail).toHaveBeenCalledWith({
      assetCode: "USDC",
      poolId: "pool-1",
      apy: 0.05,
      errorCode: "op_underfunded",
    });
    expect(mockTrackEarnDepositSuccess).not.toHaveBeenCalled();
  });

  it("does NOT reject when submitTransaction rejects (e.g. the debug forced-failure override, which throws directly)", async () => {
    mockSignTransaction.mockReturnValue("signed-xdr");
    mockSubmitTransaction.mockRejectedValue(new Error("DEBUG submit failure"));

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    let didReject = false;
    await act(async () => {
      await result.current.submit().catch(() => {
        didReject = true;
      });
    });

    expect(didReject).toBe(false);
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("DEBUG submit failure");
    expect(mockSetSubmitFailed).toHaveBeenCalledWith(true);
  });

  it("reset() returns status to idle and clears error, without touching setSubmitFailed", async () => {
    mockSignTransaction.mockReturnValue(null);

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.status).toBe("error");

    mockSetSubmitFailed.mockClear();

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(mockSetSubmitFailed).not.toHaveBeenCalled();
  });

  it("is a no-op when there is no active account", async () => {
    const { result } = renderHook(() =>
      useEarnTransaction({ account: null, network: NETWORKS.TESTNET }),
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(mockSignTransaction).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  // Regression coverage for the finding: an abandoned submit resolving
  // later must never write `setSubmitFailed` (global/persistent on
  // useEarnStore) or `status`, in EITHER the success or failure branch —
  // otherwise it can corrupt a completely unrelated LATER Earn session's
  // retry banner. `abandon()` is what `handleCloseEarnProcessingWhileSubmitting`
  // calls before navigating Home mid-submit.
  describe("abandonment guard", () => {
    it("does NOT call setSubmitFailed or write status when a submit resolves successfully AFTER being abandoned", async () => {
      mockSignTransaction.mockReturnValue("signed-xdr");
      let resolveSubmit: (hash: string) => void = () => {};
      mockSubmitTransaction.mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            resolveSubmit = resolve;
          }),
      );

      const { result } = renderHook(() => useEarnTransaction(baseParams));

      let submitPromise: Promise<void> = Promise.resolve();
      act(() => {
        submitPromise = result.current.submit();
      });

      // The submit is now suspended awaiting `submitTransaction` — this is
      // the abandonment window. Abandon it exactly like
      // `handleCloseEarnProcessingWhileSubmitting` does when the user
      // closes mid-submit, BEFORE the network call resolves.
      expect(result.current.status).toBe("submitting");
      act(() => {
        result.current.abandon();
      });

      await act(async () => {
        resolveSubmit("tx-hash");
        await submitPromise;
      });

      // Call-absence, not just resulting state: the abandoned submit must
      // never reach the persisted, global setSubmitFailed once abandoned.
      expect(mockSetSubmitFailed).not.toHaveBeenCalled();
      // And it must not silently flip status to "success" either.
      expect(result.current.status).toBe("submitting");
      expect(result.current.transactionHash).toBeNull();
      // Nor should an abandoned submit fire a business-outcome event.
      expect(mockTrackEarnDepositSuccess).not.toHaveBeenCalled();
    });

    it("does NOT call setSubmitFailed or write status when a submit rejects AFTER being abandoned", async () => {
      mockSignTransaction.mockReturnValue("signed-xdr");
      let rejectSubmit: (error: Error) => void = () => {};
      mockSubmitTransaction.mockImplementation(
        () =>
          new Promise<string | null>((_resolve, reject) => {
            rejectSubmit = reject;
          }),
      );

      const { result } = renderHook(() => useEarnTransaction(baseParams));

      let submitPromise: Promise<void> = Promise.resolve();
      act(() => {
        submitPromise = result.current.submit();
      });

      act(() => {
        result.current.abandon();
      });

      await act(async () => {
        rejectSubmit(new Error("late failure after abandonment"));
        await submitPromise;
      });

      expect(mockSetSubmitFailed).not.toHaveBeenCalled();
      expect(result.current.status).toBe("submitting");
      expect(result.current.error).toBeNull();
      expect(mockTrackEarnDepositFail).not.toHaveBeenCalled();
    });

    it("reset() is a no-op while status is submitting (hardening against the same bug class)", async () => {
      mockSignTransaction.mockReturnValue("signed-xdr");
      let resolveSubmit: (hash: string) => void = () => {};
      mockSubmitTransaction.mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            resolveSubmit = resolve;
          }),
      );

      const { result } = renderHook(() => useEarnTransaction(baseParams));

      let submitPromise: Promise<void> = Promise.resolve();
      act(() => {
        submitPromise = result.current.submit();
      });

      expect(result.current.status).toBe("submitting");

      act(() => {
        result.current.reset();
      });

      // reset() must not have dropped status back to "idle" mid-submit.
      expect(result.current.status).toBe("submitting");

      // Let the submit settle so it doesn't leak into other tests.
      await act(async () => {
        resolveSubmit("tx-hash");
        await submitPromise;
      });
    });
  });
});
