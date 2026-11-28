/* eslint-disable @fnando/consistent-import/consistent-import */
import { renderHook, act } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
import { useEarnTransaction } from "components/screens/EarnScreen/hooks/useEarnTransaction";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import type { PricedBalance } from "config/types";
import type { ActiveAccount } from "ducks/auth";
import { usePositionsStore } from "ducks/positions";
import type { SubmitTransactionOutcome } from "ducks/transactionBuilder";

const mockSignTransaction = jest.fn();
const mockSubmitTransaction = jest.fn();
const mockGetBuilderState = jest.fn();
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
  // The hook reads pool/selectedAssetCode/selectedAssetApy via
  // `useEarnStore.getState()` (for the earn.deposit_completed/.failed
  // analytics payload), matching how the real zustand store exposes a static
  // `getState`.
  useEarnStore: {
    getState: () => mockGetEarnState(),
  },
}));

jest.mock("hooks/useGetActiveAccount", () => ({
  isWalletUnlocked: () => mockIsWalletUnlocked(),
}));

jest.mock("ducks/balances", () => ({
  useBalancesStore: { getState: () => ({ balances: {} }) },
}));

// Stubs the network boundary only: the price snapshot itself runs for real,
// so its resolve()/cancel() contract is exercised too.
const mockFetchTokenPrices = jest.fn();
jest.mock("services/backend", () => ({
  fetchTokenPrices: (...args: unknown[]) => mockFetchTokenPrices(...args),
}));

const mockTrackInternalSignedTransaction = jest.fn();
const mockTrackInternalSignedTransactionError = jest.fn();
jest.mock("services/analytics", () => ({
  analytics: {
    trackEarnDepositSuccess: (...args: unknown[]) =>
      mockTrackEarnDepositSuccess(...args),
    trackEarnDepositFail: (...args: unknown[]) =>
      mockTrackEarnDepositFail(...args),
    trackInternalSignedTransaction: (...args: unknown[]) =>
      mockTrackInternalSignedTransaction(...args),
    trackInternalSignedTransactionError: (...args: unknown[]) =>
      mockTrackInternalSignedTransactionError(...args),
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

const submitOutcome = (
  overrides: Partial<SubmitTransactionOutcome>,
): SubmitTransactionOutcome => ({
  hash: null,
  resultXdr: null,
  error: null,
  resultCodes: null,
  httpStatus: null,
  isProtocolAnswer: false,
  ...overrides,
});

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const USDC_ID = `USDC:${USDC_ISSUER}`;

const usdcBalance = {
  token: {
    type: "credit_alphanum4",
    code: "USDC",
    issuer: { key: USDC_ISSUER },
  },
  total: new BigNumber("100"),
  available: new BigNumber("100"),
  // The price Review showed.
  currentPrice: new BigNumber("1"),
} as unknown as PricedBalance;

/** The deposit Review showed and Confirm submits. */
const deposit = { amount: "10", balance: usdcBalance };

describe("useEarnTransaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchTokenPrices.mockResolvedValue({});
    mockIsWalletUnlocked.mockReturnValue(true);
    mockGetBuilderState.mockReturnValue({ error: "Store error message" });
    mockGetEarnState.mockReturnValue({
      pool: { id: "pool-1" },
      selectedAssetId: "CUSDC",
      selectedAssetCode: "USDC",
      selectedAssetApy: 0.05,
      selectedAssetDecimals: 7,
      // 100 USDC already deposited, in raw units.
      currentPositionTokens: "1000000000",
      didSwapInFlow: false,
      source: "home",
    });
    usePositionsStore.getState().reset();
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
      await result.current.submit(deposit);
    });

    expect(mockSignTransaction).not.toHaveBeenCalled();
    expect(mockSubmitTransaction).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("does NOT reject when submit() is called fire-and-forget and the wallet is locked", async () => {
    mockIsWalletUnlocked.mockReturnValue(false);

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    let didReject = false;
    await act(async () => {
      await result.current.submit(deposit).catch(() => {
        didReject = true;
      });
    });

    expect(didReject).toBe(false);
  });

  it("sets status to success and records the hash on a clean submit", async () => {
    mockSignTransaction.mockReturnValue("signed-xdr");
    mockSubmitTransaction.mockResolvedValue(submitOutcome({ hash: "tx-hash" }));

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    await act(async () => {
      await result.current.submit(deposit);
    });

    expect(mockSignTransaction).toHaveBeenCalledWith({
      secretKey: account.privateKey,
      network: NETWORKS.TESTNET,
    });
    expect(result.current.status).toBe("success");
    expect(result.current.transactionHash).toBe("tx-hash");
    expect(result.current.error).toBeNull();

    expect(mockTrackEarnDepositSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        assetCode: "USDC",
        poolId: "pool-1",
        source: "home",
        apy: 0.05,
        viaSwap: false,
      }),
    );
    expect(mockTrackEarnDepositFail).not.toHaveBeenCalled();
  });

  it("has Home's Positions wait for the landed deposit: the balance before it plus half the amount", async () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    mockSignTransaction.mockReturnValue("signed-xdr");
    mockSubmitTransaction.mockResolvedValue(submitOutcome({ hash: "tx-hash" }));

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    await act(async () => {
      await result.current.submit(deposit);
    });

    // 100 USDC held before, 10 deposited: the row must reach 105.
    expect(usePositionsStore.getState().awaitedDeposit).toEqual({
      publicKey: account.publicKey,
      network: NETWORKS.TESTNET,
      poolId: "pool-1",
      assetId: "CUSDC",
      minTokens: "105",
      expiresAt: 1_000_000 + 30_000,
    });
    nowSpy.mockRestore();
  });

  it("waits for no deposit when the submit fails", async () => {
    mockSignTransaction.mockReturnValue("signed-xdr");
    mockSubmitTransaction.mockResolvedValue(
      submitOutcome({ error: "op_underfunded" }),
    );

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    await act(async () => {
      await result.current.submit(deposit);
    });

    expect(result.current.status).toBe("error");
    expect(usePositionsStore.getState().awaitedDeposit).toBeNull();
  });

  it("still reports a landed deposit as a success when the wait can't be recorded", async () => {
    // A position figure that isn't a number can't give the wait a target.
    mockGetEarnState.mockReturnValue({
      ...mockGetEarnState(),
      selectedAssetDecimals: undefined,
    });
    const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
    mockSignTransaction.mockReturnValue("signed-xdr");
    mockSubmitTransaction.mockResolvedValue(submitOutcome({ hash: "tx-hash" }));

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    await act(async () => {
      await result.current.submit(deposit);
    });

    expect(result.current.status).toBe("success");
    expect(mockTrackEarnDepositFail).not.toHaveBeenCalled();
    expect(usePositionsStore.getState().awaitedDeposit).toBeNull();
    errorSpy.mockRestore();
  });

  it("sets status to error, sourcing the message from the store, when signTransaction returns null", async () => {
    mockSignTransaction.mockReturnValue(null);
    mockGetBuilderState.mockReturnValue({
      error: "Failed to sign transaction: bad seed",
    });

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    await act(async () => {
      await result.current.submit(deposit);
    });

    expect(mockSubmitTransaction).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Failed to sign transaction: bad seed");
  });

  // The builder store logs a failed signature or submit itself, at the right
  // level (a network rejection is a warn breadcrumb); a second log here
  // would send each failure to Sentry again, as an error.
  it.each([
    ["signature", () => mockSignTransaction.mockReturnValue(null)],
    [
      "submit",
      () => {
        mockSignTransaction.mockReturnValue("signed-xdr");
        mockSubmitTransaction.mockResolvedValue(
          submitOutcome({
            error: "op_underfunded",
            resultCodes: { operations: ["op_underfunded"] },
          }),
        );
      },
    ],
  ])("leaves logging a failed %s to the builder store", async (_, fail) => {
    fail();
    const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useEarnTransaction(baseParams));
    await act(async () => {
      await result.current.submit(deposit);
    });

    expect(result.current.status).toBe("error");
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("sets status to error, sourcing the message and result codes from the submit outcome, when submitTransaction resolves without a hash", async () => {
    mockSignTransaction.mockReturnValue("signed-xdr");
    mockSubmitTransaction.mockResolvedValue(
      submitOutcome({
        error: "op_underfunded",
        resultCodes: { operations: ["op_underfunded"] },
      }),
    );
    // The store holds a different, stale failure: the hook must read this
    // attempt's own outcome, never the store, which a mid-submit Close resets.
    mockGetBuilderState.mockReturnValue({
      error: "stale store error",
      submitErrorResultCodes: { operations: ["op_stale"] },
    });

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    await act(async () => {
      await result.current.submit(deposit);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("op_underfunded");
    expect(result.current.transactionHash).toBeNull();

    // earn.deposit_failed carries the token and the pool plus reason_code --
    // sourced from this attempt's own submit outcome, never the free-text
    // error message. No APY, as in the extension.
    expect(mockTrackEarnDepositFail).toHaveBeenCalledWith(
      expect.objectContaining({
        assetCode: "USDC",
        poolId: "pool-1",
        source: "home",
        errorCode: "op_underfunded",
      }),
    );
    expect(mockTrackEarnDepositFail.mock.calls[0][0]).not.toHaveProperty("apy");
    expect(mockTrackEarnDepositSuccess).not.toHaveBeenCalled();
  });

  it("does NOT reject when submitTransaction rejects (e.g. the debug forced-failure override, which throws directly)", async () => {
    mockSignTransaction.mockReturnValue("signed-xdr");
    mockSubmitTransaction.mockRejectedValue(new Error("DEBUG submit failure"));

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    let didReject = false;
    await act(async () => {
      await result.current.submit(deposit).catch(() => {
        didReject = true;
      });
    });

    expect(didReject).toBe(false);
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("DEBUG submit failure");
  });

  it("reset() returns status to idle and clears error", async () => {
    mockSignTransaction.mockReturnValue(null);

    const { result } = renderHook(() => useEarnTransaction(baseParams));

    await act(async () => {
      await result.current.submit(deposit);
    });

    expect(result.current.status).toBe("error");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("is a no-op when there is no active account", async () => {
    const { result } = renderHook(() =>
      useEarnTransaction({ account: null, network: NETWORKS.TESTNET }),
    );

    await act(async () => {
      await result.current.submit(deposit);
    });

    expect(mockSignTransaction).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  // An abandoned submit resolving later must never write `status`, in
  // EITHER the success or failure branch. `abandon()` is what
  // `handleCloseEarnProcessingWhileSubmitting` calls before navigating Home
  // mid-submit.
  // The signing events Send and Swap report, so the signing funnel covers
  // deposits too.
  describe("signing events", () => {
    it("reports a signature", async () => {
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue(
        submitOutcome({ hash: "tx-hash" }),
      );
      const { result } = renderHook(() => useEarnTransaction(baseParams));

      await act(async () => {
        await result.current.submit(deposit);
      });

      expect(mockTrackInternalSignedTransaction).toHaveBeenCalledTimes(1);
      expect(mockTrackInternalSignedTransactionError).not.toHaveBeenCalled();
    });

    it("reports a failed signature with the store's reason", async () => {
      mockSignTransaction.mockReturnValue(null);
      const { result } = renderHook(() => useEarnTransaction(baseParams));

      await act(async () => {
        await result.current.submit(deposit);
      });

      expect(mockTrackInternalSignedTransactionError).toHaveBeenCalledWith(
        "Store error message",
      );
      expect(mockTrackInternalSignedTransaction).not.toHaveBeenCalled();
    });
  });

  // The deposit's USD volume, measured as Send measures a payment's: priced
  // by a fetch started once signing succeeds, right before submitting.
  describe("deposit volume", () => {
    const usdcIdentity = {
      code: "USDC",
      issuer: USDC_ISSUER,
      type: "classic",
    };

    const submitDeposit = async (
      submission: Parameters<
        ReturnType<typeof useEarnTransaction>["submit"]
      >[0] = deposit,
    ) => {
      const { result } = renderHook(() => useEarnTransaction(baseParams));
      await act(async () => {
        await result.current.submit(submission);
      });
      return result;
    };

    beforeEach(() => {
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockFetchTokenPrices.mockResolvedValue({
        [USDC_ID]: { currentPrice: new BigNumber("0.9998") },
      });
    });

    it("reports the deposited amount and its USD value at the submit-time price", async () => {
      mockSubmitTransaction.mockResolvedValue(
        submitOutcome({ hash: "tx-hash" }),
      );

      await submitDeposit();

      expect(mockFetchTokenPrices).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: [USDC_ID],
          network: NETWORKS.TESTNET,
        }),
      );
      expect(mockTrackEarnDepositSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          volume: {
            identity: usdcIdentity,
            amount: 10,
            sourceLeg: expect.objectContaining({
              status: "ok",
              value: 10,
              rate: 0.9998,
            }),
            priceSource: "token_prices_v2",
            priceFreshness: "confirmation_fetch",
          },
        }),
      );
    });

    it("falls back to the price Review showed when the price fetch fails", async () => {
      mockFetchTokenPrices.mockRejectedValue(new Error("prices unavailable"));
      mockSubmitTransaction.mockResolvedValue(
        submitOutcome({ hash: "tx-hash" }),
      );

      await submitDeposit();

      expect(mockTrackEarnDepositSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          volume: expect.objectContaining({
            sourceLeg: expect.objectContaining({ status: "ok", rate: 1 }),
            priceFreshness: "cached_display",
          }),
        }),
      );
    });

    it("reports a rejected deposit's volume and the kind of failure", async () => {
      mockSubmitTransaction.mockResolvedValue(
        submitOutcome({
          error: "op_underfunded",
          resultCodes: { operations: ["op_underfunded"] },
          httpStatus: 400,
          isProtocolAnswer: true,
        }),
      );

      const result = await submitDeposit();

      expect(mockTrackEarnDepositFail).toHaveBeenCalledWith({
        assetCode: "USDC",
        poolId: "pool-1",
        source: "home",
        errorCode: "op_underfunded",
        volume: {
          identity: usdcIdentity,
          amount: 10,
          sourceLeg: expect.objectContaining({ status: "ok", value: 10 }),
          priceSource: "token_prices_v2",
          priceFreshness: "confirmation_fetch",
          reasonCode: "op_underfunded",
          failureCategory: "balance",
        },
      });
      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("op_underfunded");
    });

    it("counts a submit that got no verdict as a transport failure", async () => {
      mockSubmitTransaction.mockResolvedValue(
        submitOutcome({ error: "Network Error" }),
      );

      await submitDeposit();

      expect(mockTrackEarnDepositFail).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: "unknown",
          volume: expect.objectContaining({
            reasonCode: "unknown",
            failureCategory: "transport",
          }),
        }),
      );
    });

    it("reports a failed signature without volume, and fetches no price", async () => {
      mockSignTransaction.mockReturnValue(null);

      await submitDeposit();

      expect(mockFetchTokenPrices).not.toHaveBeenCalled();
      expect(mockTrackEarnDepositFail).toHaveBeenCalledTimes(1);
      expect(mockTrackEarnDepositFail.mock.calls[0][0].volume).toBeUndefined();
    });

    // The debug forced-failure override throws before anything reaches the
    // network, so there is no attempted volume to report.
    it("cancels the price fetch when the submit throws", async () => {
      mockSubmitTransaction.mockRejectedValue(
        new Error("DEBUG submit failure"),
      );

      await submitDeposit();

      expect(mockFetchTokenPrices.mock.calls[0][0].signal.aborted).toBe(true);
      expect(mockTrackEarnDepositFail).toHaveBeenCalledTimes(1);
      expect(mockTrackEarnDepositFail.mock.calls[0][0].volume).toBeUndefined();
    });

    it("still deposits, without volume, when the deposited balance can't be found", async () => {
      mockSubmitTransaction.mockResolvedValue(
        submitOutcome({ hash: "tx-hash" }),
      );

      const result = await submitDeposit({ amount: "10", balance: undefined });

      expect(result.current.status).toBe("success");
      expect(mockFetchTokenPrices).not.toHaveBeenCalled();
      expect(
        mockTrackEarnDepositSuccess.mock.calls[0][0].volume,
      ).toBeUndefined();
    });
  });

  describe("abandonment guard", () => {
    it("does NOT write status when a submit resolves successfully AFTER being abandoned", async () => {
      mockGetEarnState.mockReturnValue({
        pool: { id: "pool-1" },
        selectedAssetId: "CUSDC",
        selectedAssetCode: "USDC",
        selectedAssetApy: 0.05,
        selectedAssetDecimals: 7,
        currentPositionTokens: "0",
        didSwapInFlow: true,
        source: "position_row",
      });
      mockSignTransaction.mockReturnValue("signed-xdr");
      let resolveSubmit: (outcome: SubmitTransactionOutcome) => void = () => {};
      mockSubmitTransaction.mockImplementation(
        () =>
          new Promise<SubmitTransactionOutcome>((resolve) => {
            resolveSubmit = resolve;
          }),
      );

      const { result } = renderHook(() => useEarnTransaction(baseParams));

      let submitPromise: Promise<void> = Promise.resolve();
      act(() => {
        submitPromise = result.current.submit(deposit);
      });

      // The submit is now suspended awaiting `submitTransaction` — this is
      // the abandonment window. Abandon it exactly like
      // `handleCloseEarnProcessingWhileSubmitting` does when the user
      // closes mid-submit, BEFORE the network call resolves. Leaving Earn
      // then resets the earn duck.
      expect(result.current.status).toBe("submitting");
      act(() => {
        result.current.abandon();
      });
      mockGetEarnState.mockReturnValue({
        pool: null,
        selectedAssetId: "",
        selectedAssetCode: "",
        selectedAssetApy: null,
        selectedAssetDecimals: 7,
        currentPositionTokens: "0",
        didSwapInFlow: false,
        source: "home",
      });

      await act(async () => {
        resolveSubmit(submitOutcome({ hash: "tx-hash" }));
        await submitPromise;
      });

      // The abandoned submit must not silently flip status to "success".
      expect(result.current.status).toBe("submitting");
      expect(result.current.transactionHash).toBeNull();
      // The deposit still went through, so it is still reported, with what
      // was picked when it started: leaving Earn has reset the earn duck.
      expect(mockTrackEarnDepositSuccess).toHaveBeenCalledWith({
        assetCode: "USDC",
        poolId: "pool-1",
        source: "position_row",
        apy: 0.05,
        viaSwap: true,
        volume: expect.objectContaining({ amount: 10 }),
      });
      // Closing away is when Home needs to wait for the deposit most.
      expect(usePositionsStore.getState().awaitedDeposit).toEqual(
        expect.objectContaining({
          poolId: "pool-1",
          assetId: "CUSDC",
          minTokens: "5",
        }),
      );
    });

    it("does NOT write status when a submit rejects AFTER being abandoned", async () => {
      mockSignTransaction.mockReturnValue("signed-xdr");
      let rejectSubmit: (error: Error) => void = () => {};
      mockSubmitTransaction.mockImplementation(
        () =>
          new Promise<SubmitTransactionOutcome>((_resolve, reject) => {
            rejectSubmit = reject;
          }),
      );

      const { result } = renderHook(() => useEarnTransaction(baseParams));

      let submitPromise: Promise<void> = Promise.resolve();
      act(() => {
        submitPromise = result.current.submit(deposit);
      });

      act(() => {
        result.current.abandon();
      });

      await act(async () => {
        rejectSubmit(new Error("late failure after abandonment"));
        await submitPromise;
      });

      expect(result.current.status).toBe("submitting");
      expect(result.current.error).toBeNull();
      // The failure is still reported.
      expect(mockTrackEarnDepositFail).toHaveBeenCalledWith(
        expect.objectContaining({ assetCode: "USDC", poolId: "pool-1" }),
      );
    });

    it("reset() is a no-op while status is submitting (hardening against the same bug class)", async () => {
      mockSignTransaction.mockReturnValue("signed-xdr");
      let resolveSubmit: (outcome: SubmitTransactionOutcome) => void = () => {};
      mockSubmitTransaction.mockImplementation(
        () =>
          new Promise<SubmitTransactionOutcome>((resolve) => {
            resolveSubmit = resolve;
          }),
      );

      const { result } = renderHook(() => useEarnTransaction(baseParams));

      let submitPromise: Promise<void> = Promise.resolve();
      act(() => {
        submitPromise = result.current.submit(deposit);
      });

      expect(result.current.status).toBe("submitting");

      act(() => {
        result.current.reset();
      });

      // reset() must not have dropped status back to "idle" mid-submit.
      expect(result.current.status).toBe("submitting");

      // Let the submit settle so it doesn't leak into other tests.
      await act(async () => {
        resolveSubmit(submitOutcome({ hash: "tx-hash" }));
        await submitPromise;
      });
    });
  });
});
