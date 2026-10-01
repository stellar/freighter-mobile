/* eslint-disable @fnando/consistent-import/consistent-import */
import { Asset, Keypair, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import { renderHook, act } from "@testing-library/react-hooks";
import BigNumber from "bignumber.js";
import {
  SwapReview,
  useSwapTransaction,
} from "components/screens/SwapScreen/hooks/useSwapTransaction";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import type { ActiveAccount } from "ducks/auth";
import { SwapPathResult, useSwapStore } from "ducks/swap";
import { isWalletUnlocked } from "hooks/useGetActiveAccount";
import { analytics } from "services/analytics";
import { SwapQuoteSource } from "services/backend";

import {
  BACKEND_ENVELOPE,
  ISSUER,
  SENDER,
  backendQuote,
  usdc,
  xlm,
} from "../../../../__mocks__/swapFixtures";

const mockSignTransaction = jest.fn();
const mockSubmitTransaction = jest.fn();
const mockBuildSwapTransaction = jest.fn().mockResolvedValue("xdr");
const mockBuildTrustlineTransaction = jest
  .fn()
  .mockResolvedValue("trustline-xdr");
const mockPrepareAggregatorSwap = jest.fn().mockReturnValue("aggregator-xdr");
const mockFetchSwapQuote = jest.fn();
const mockShowToast = jest.fn();
const mockTrackTransactionError = jest.fn();
const mockTrackSwapSuccess = jest.fn();
const mockTrack = jest.fn();
const mockScanTransaction = jest.fn().mockResolvedValue({});
const mockGetBuilderState = jest.fn();
let mockSwapSlippage = 0.5;
let mockBuilderXdr: string | null = null;

jest.mock("ducks/transactionBuilder", () => ({
  useTransactionBuilderStore: Object.assign(
    () => ({
      buildSwapTransaction: async (...args: unknown[]) => {
        mockBuilderXdr = await mockBuildSwapTransaction(...args);
        return mockBuilderXdr;
      },
      buildTrustlineTransaction: async (...args: unknown[]) => {
        mockBuilderXdr = await mockBuildTrustlineTransaction(...args);
        return mockBuilderXdr;
      },
      prepareAggregatorSwap: (...args: unknown[]) => {
        mockBuilderXdr = mockPrepareAggregatorSwap(...args);
        return mockBuilderXdr;
      },
      signTransaction: mockSignTransaction,
      submitTransaction: mockSubmitTransaction,
    }),
    {
      getState: () => ({
        transactionXDR: mockBuilderXdr,
        ...mockGetBuilderState(),
      }),
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
// The prices store backs the receive card's fiat line for a NON-held
// destination, which carries no `currentPrice` of its own. Mutated per-test.
let mockPricesByNetwork: Record<string, unknown> = {};
jest.mock("ducks/prices", () => ({
  usePricesStore: {
    getState: () => ({ pricesByNetwork: mockPricesByNetwork }),
  },
}));
// Stubs the network boundary only — startConfirmationPriceSnapshot itself
// runs for real, so its cancel()/resolve() contract is still exercised.
const mockFetchTokenPrices = jest.fn().mockResolvedValue({});
jest.mock("services/backend", () => ({
  ...jest.requireActual("services/backend"),
  fetchTokenPrices: (...args: unknown[]) => mockFetchTokenPrices(...args),
  fetchSwapQuote: (...args: unknown[]) => mockFetchSwapQuote(...args),
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
      swapSlippage: mockSwapSlippage,
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
    trackInternalSignedTransaction: jest.fn(),
    trackInternalSignedTransactionRejected: jest.fn(),
    trackInternalSignedTransactionError: jest.fn(),
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
    sourceAmount: "1",
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

/** submitTransaction now resolves with the attempt's own outcome. */
const submitOk = (resultXdr: string | null = null) => ({
  hash: "tx-hash",
  resultXdr,
  error: null,
  resultCodes: null,
  httpStatus: null,
  isProtocolAnswer: false,
});

const submitFailed = (
  overrides: Partial<{
    error: string | null;
    resultCodes: { transaction?: string; operations?: string[] } | null;
    httpStatus: number | null;
    isProtocolAnswer: boolean;
  }> = {},
) => ({
  hash: null,
  resultXdr: null,
  error: "Submit error from store",
  resultCodes: null,
  httpStatus: null,
  isProtocolAnswer: false,
  ...overrides,
});

/** A protocol rejection of the transaction, with the operation's code when there is one. */
const rejected = (op?: string, tx = "tx_failed") =>
  submitFailed({
    error: tx,
    resultCodes: { transaction: tx, ...(op && { operations: [op] }) },
    httpStatus: 400,
    isProtocolAnswer: true,
  });

const prepareReview = async (result: {
  current: ReturnType<typeof useSwapTransaction>;
}): Promise<SwapReview> => {
  const review = await result.current.setupSwapTransaction();
  if (!review) throw new Error("Test review preparation failed");
  return review;
};
const executeReviewed = async (result: {
  current: ReturnType<typeof useSwapTransaction>;
}) => {
  const review = await prepareReview(result);
  mockScanTransaction.mockClear();
  return result.current.executeSwap(review);
};

describe("useSwapTransaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSwapSlippage = 0.5;
    mockBuilderXdr = null;
    mockGetBuilderState.mockReturnValue({
      requestId: "review",
      error: "Submit error from store",
    });
    mockPricesByNetwork = {};
    act(() => {
      useSwapStore.getState().resetSwap();
      useSwapStore.setState({ pathResult: baseParams.pathResult });
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("executeSwap rejection contract", () => {
    it("does NOT reject when submitTransaction returns null (failure)", async () => {
      // submitTransaction resolves with a hash-less outcome on failure - the
      // hook reads the error off that outcome and throws inside the try,
      // where the catch handles toast / analytics. The catch must NOT
      // rethrow, otherwise SwapAmountScreen's fire-and-forget call site would
      // surface an unhandled promise rejection at the global handler.
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue(submitFailed());

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      // Should resolve, not reject.
      let didReject = false;
      await act(async () => {
        await executeReviewed(result).catch(() => {
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
        await executeReviewed(result).catch(() => {
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
      // A throw out of submitTransaction itself (the debug forced-failure
      // override) never reached the network, so the event carries no
      // attempted volume — and in particular is not bucketed as `transport`,
      // which means "submitted, but no verdict came back".
      const [payload] = mockTrackTransactionError.mock.calls[0] as [
        { volume?: unknown },
      ];
      expect(payload.volume).toBeUndefined();
      expect(mockShowToast).toHaveBeenCalled();
    });

    it("does NOT reject when signTransaction returns null, and emits swap.failed without volume data", async () => {
      mockSignTransaction.mockReturnValue(null);

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      let didReject = false;
      await act(async () => {
        await executeReviewed(result).catch(() => {
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
        await executeReviewed(result);
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
        return Promise.resolve(submitOk());
      });

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await executeReviewed(result);
      });

      // Prices are snapshotted as close to execution as possible: after
      // signing, immediately before submission.
      expect(callOrder).toEqual(["sign", "fetchPrices", "submit"]);
    });

    it("resolves successfully on a successful swap (sanity check)", async () => {
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue(submitOk());
      act(() => {
        useSwapStore.setState({ pathResult: baseParams.pathResult });
      });

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await executeReviewed(result);
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

    it("allows a new execution after Close without a late failure changing its UI", async () => {
      let finishFirst!: (outcome: ReturnType<typeof submitFailed>) => void;
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishFirst = resolve;
            }),
        )
        .mockResolvedValueOnce(submitOk());
      const { result } = renderHook(() => useSwapTransaction(baseParams));
      let first!: Promise<void>;
      let firstReview!: SwapReview;
      await act(async () => {
        firstReview = await prepareReview(result);
      });
      act(() => {
        first = result.current.executeSwap(firstReview);
      });
      expect(result.current.isProcessing).toBe(true);
      act(() => result.current.handleProcessingScreenClose());
      expect(result.current.isProcessing).toBe(false);
      await act(async () => {
        await executeReviewed(result);
        finishFirst(submitFailed());
        await first;
      });

      expect(mockSignTransaction).toHaveBeenCalledTimes(2);
      expect(mockSubmitTransaction).toHaveBeenCalledTimes(2);
      expect(result.current.isProcessing).toBe(true);
      expect(mockShowToast).not.toHaveBeenCalled();
      // The old network outcome still belongs in telemetry after Close.
      expect(mockTrackTransactionError).toHaveBeenCalledTimes(1);
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
      mockSubmitTransaction.mockResolvedValue(submitOk());

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await executeReviewed(result);
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
      mockSubmitTransaction.mockResolvedValue(submitOk());

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await executeReviewed(result);
      });

      expect(mockTrack).not.toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_TRUSTLINE_ADDED,
        expect.anything(),
      );
    });
  });

  describe("confirmation snapshot cached_display fallback", () => {
    /** A TransactionResult XDR whose single op settled a pathPaymentStrictSend. */
    const settledResultXdr = (stroops: string): string => {
      const simple = new xdr.SimplePaymentResult({
        destination: xdr.PublicKey.publicKeyTypeEd25519(
          Keypair.random().rawPublicKey(),
        ),
        asset: Asset.native().toXdrObject(),
        amount: BigInt(stroops),
      });
      const opResult = xdr.OperationResult.opInner(
        xdr.OperationResultTr.pathPaymentStrictSend(
          xdr.PathPaymentStrictSendResult.pathPaymentStrictSendSuccess(
            new xdr.PathPaymentStrictSendResultSuccess({
              offers: [],
              last: simple,
            }),
          ),
        ),
      );
      return new xdr.TransactionResult({
        feeCharged: BigInt("100"),
        result: xdr.TransactionResultResult.txSuccess([opResult]),
        ext: xdr.TransactionResultExt.v0(),
      }).toXdr("base64");
    };

    const usdcDescriptor = (priceUsd?: number) => ({
      id: `USDC:${ISSUER}`,
      tokenCode: "USDC",
      issuer: ISSUER,
      decimals: 7,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      requiresTrustline: false,
      priceUsd,
    });

    /** Runs a settled classic swap of 5 USDC with the confirmation fetch failing, and reports its volume. */
    const settleClassicSwap = async (descriptorPriceUsd?: number) => {
      mockFetchTokenPrices.mockRejectedValue(new Error("prices unavailable"));
      act(() => {
        useSwapStore
          .getState()
          .setDestinationToken(usdcDescriptor(descriptorPriceUsd));
        useSwapStore.setState({ pathResult: baseParams.pathResult });
      });
      (TransactionBuilder.fromXdr as unknown as jest.Mock).mockReturnValueOnce({
        operations: [{ type: "pathPaymentStrictSend" }],
      });
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue(
        submitOk(settledResultXdr("50000000")),
      );

      const { result } = renderHook(() =>
        useSwapTransaction({
          ...baseParams,
          sourceBalance: {
            tokenCode: "XLM",
            token: { type: "native", code: "XLM" },
            currentPrice: new BigNumber("0.5"),
          } as never,
          destinationTokenInput: {
            tokenCode: "USDC",
            token: {
              code: "USDC",
              issuer: { key: ISSUER },
              type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
            },
          } as never,
        }),
      );
      await act(async () => {
        await executeReviewed(result);
      });

      expect(mockTrackSwapSuccess).toHaveBeenCalledTimes(1);
      const [payload] = mockTrackSwapSuccess.mock.calls[0] as [
        { volume: Record<string, unknown> },
      ];

      return payload.volume;
    };

    it("prices a listed classic destination from the picker's price when nothing else has one", async () => {
      expect(await settleClassicSwap(2)).toMatchObject({
        priceFreshness: "cached_display",
        toAmountUsdStatus: "ok",
        toAmountUsd: 10,
        toAmountUsdRate: 2,
      });
    });

    it("leaves the destination unpriced when no source prices it", async () => {
      expect(await settleClassicSwap()).toMatchObject({
        priceFreshness: "cached_display",
        toAmountUsdStatus: "no_price",
      });
    });

    it("prices a non-held destination from the display prices store, not the priceless shim", async () => {
      mockPricesByNetwork = {
        [NETWORKS.PUBLIC]: {
          XLM: { currentPrice: new BigNumber("0.5") },
          [`USDC:${ISSUER}`]: { currentPrice: new BigNumber("1.5") },
        },
      };

      expect(await settleClassicSwap()).toMatchObject({
        priceFreshness: "cached_display",
        toAmountUsdStatus: "ok",
        toAmount: 5,
        toAmountUsd: 7.5,
        toAmountUsdRate: 1.5,
      });
    });
  });

  describe("Close during submit (store reset mid-flight)", () => {
    // Closing the processing screen unmounts the swap screen, whose cleanup
    // resets the transaction store and the swap settings. The store's
    // requestId guard then refuses to write this attempt's result, so
    // anything the terminal event reads from the store afterwards is gone.
    // The emit path reads the attempt's own returned outcome instead.
    const emptyBuilderState = {
      error: null,
      submitErrorResultCodes: null,
    };

    it("still reports the settled destination amount for a successful swap", () => {
      const resultXdr = (() => {
        const simple = new xdr.SimplePaymentResult({
          destination: xdr.PublicKey.publicKeyTypeEd25519(
            Keypair.random().rawPublicKey(),
          ),
          asset: Asset.native().toXdrObject(),
          amount: BigInt("50000000"),
        });
        return new xdr.TransactionResult({
          feeCharged: BigInt("100"),
          result: xdr.TransactionResultResult.txSuccess([
            xdr.OperationResult.opInner(
              xdr.OperationResultTr.pathPaymentStrictSend(
                xdr.PathPaymentStrictSendResult.pathPaymentStrictSendSuccess(
                  new xdr.PathPaymentStrictSendResultSuccess({
                    offers: [],
                    last: simple,
                  }),
                ),
              ),
            ),
          ]),
          ext: xdr.TransactionResultExt.v0(),
        }).toXdr("base64");
      })();

      // The store has been reset: it holds none of this attempt's result.
      mockGetBuilderState.mockReturnValue(emptyBuilderState);
      (TransactionBuilder.fromXdr as unknown as jest.Mock).mockReturnValueOnce({
        operations: [{ type: "pathPaymentStrictSend" }],
      });
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue(submitOk(resultXdr));

      return (async () => {
        const { result } = renderHook(() => useSwapTransaction(baseParams));
        await act(async () => {
          await executeReviewed(result);
        });

        const [payload] = mockTrackSwapSuccess.mock.calls[0] as [
          { volume: Record<string, unknown>; allowedSlippage?: string },
        ];
        expect(payload.volume).toMatchObject({ toAmount: 5 });
        expect(payload.volume.toAmountUsdStatus).not.toBe("error");
        // Read before the await, so the screen's reset-to-defaults on unmount
        // can't replace it with the default tolerance.
        expect(payload.allowedSlippage).toBe("0.5");
      })();
    });

    it("still classifies a rejected swap instead of falling back to transport", async () => {
      mockGetBuilderState.mockReturnValue(emptyBuilderState);
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue(rejected("op_underfunded"));

      const { result } = renderHook(() => useSwapTransaction(baseParams));
      await act(async () => {
        await executeReviewed(result).catch(() => {});
      });

      expect(mockTrackTransactionError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: "op_underfunded",
          volume: expect.objectContaining({
            reasonCode: "op_underfunded",
            failureCategory: "balance",
          }),
        }),
      );
    });
  });

  describe("SWAP_QUOTE_EXPIRED analytics", () => {
    it("fires SWAP_QUOTE_EXPIRED with the result code, AND also swap.failed with failure_category slippage, when the submit is rejected with op_under_dest_min", async () => {
      // The store no longer carries the failure classification — the hook
      // reads it off the attempt's own outcome below.
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue(rejected("op_under_dest_min"));

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await executeReviewed(result).catch(() => {});
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
      mockSubmitTransaction.mockResolvedValue(
        submitFailed({
          error: "tx_insufficient_balance",
          resultCodes: {
            transaction: "tx_failed",
            operations: ["op_underfunded"],
          },
        }),
      );

      const { result } = renderHook(() => useSwapTransaction(baseParams));

      await act(async () => {
        await executeReviewed(result).catch(() => {});
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

  describe("aggregator route", () => {
    const quote = (over: Partial<SwapPathResult> = {}): SwapPathResult => ({
      sourceAmount: "10",
      destinationAmount: "2.2949042",
      destinationAmountMin: "2.2719551",
      path: [],
      conversionRate: "0.2294904",
      source: SwapQuoteSource.XOXNO,
      quotedAt: Date.now(),
      networkFeeXlm: "0.0098024",
      aggregatorTransaction: {
        envelopeXdr: "envelope-1",
        feeStroops: "98024",
        resourceFeeStroops: "97924",
        expiresAt: Math.floor(Date.now() / 1000) + 180,
      },
      ...over,
    });

    const trustlineQuote = () =>
      quote({ requiresTrustlineFirst: true, aggregatorTransaction: undefined });

    const paramsFor = (pathResult: SwapPathResult) => ({
      sourceAmount: "10",
      sourceBalance: xlm,
      destinationTokenInput: usdc,
      pathResult,
      account: { publicKey: SENDER, privateKey: "SA..." } as ActiveAccount,
      network: NETWORKS.PUBLIC,
      navigation: mockNavigation,
    });

    const seed = (path: SwapPathResult, needsTrustline = false) =>
      act(() => {
        useSwapStore.getState().setDestinationToken({
          id: `USDC:${ISSUER}`,
          tokenCode: "USDC",
          issuer: ISSUER,
          decimals: 7,
          tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
          requiresTrustline: needsTrustline,
        });
        useSwapStore.setState({
          sourceTokenId: "native",
          sourceAmount: path.sourceAmount,
          pathResult: path,
        });
      });

    const run = async (
      path: SwapPathResult,
      method: "setupSwapTransaction" | "executeSwap",
    ) => {
      const { result } = renderHook(() => useSwapTransaction(paramsFor(path)));

      await act(async () => {
        if (method === "executeSwap") await executeReviewed(result);
        else await result.current.setupSwapTransaction();
      });
    };

    beforeEach(() => {
      mockSwapSlippage = 1; // Aggregator fixtures use a 1% minimum.
      mockFetchSwapQuote.mockReset();
      mockSignTransaction.mockReturnValue("signed-xdr");
      mockSubmitTransaction.mockResolvedValue(submitOk());
      mockPrepareAggregatorSwap.mockReturnValue("aggregator-xdr");
    });

    describe("setupSwapTransaction", () => {
      it.each(["request", "XDR", "account", "network", "settings"])(
        "rejects a review when %s changes during scanning",
        async (change) => {
          let finishScan!: (scan: unknown) => void;
          mockScanTransaction.mockImplementationOnce(
            () =>
              new Promise((resolve) => {
                finishScan = resolve;
              }),
          );
          const path = quote();
          seed(path);
          const params = paramsFor(path);
          const { result, rerender } = renderHook(
            (props) => useSwapTransaction(props),
            { initialProps: params },
          );
          let pending!: ReturnType<typeof result.current.setupSwapTransaction>;
          act(() => {
            pending = result.current.setupSwapTransaction();
          });
          act(() => {
            if (change === "request")
              mockGetBuilderState.mockReturnValue({ requestId: "replacement" });
            if (change === "XDR") mockBuilderXdr = "replacement-xdr";
            if (change === "account")
              rerender({
                ...params,
                account: { ...params.account, publicKey: "other-account" },
              });
            if (change === "network")
              rerender({ ...params, network: NETWORKS.TESTNET });
            if (change === "settings") mockSwapSlippage = 2;
          });
          await act(async () => {
            finishScan({});
            expect(await pending).toBeUndefined();
          });
          expect(mockSignTransaction).not.toHaveBeenCalled();
        },
      );

      it.each([SwapQuoteSource.XOXNO, SwapQuoteSource.LIFI])(
        "verifies a fresh %s quote without refreshing it",
        async (source) => {
          const path = quote({ source });
          seed(path);

          await run(path, "setupSwapTransaction");

          expect(mockFetchSwapQuote).not.toHaveBeenCalled();
          expect(mockBuildSwapTransaction).not.toHaveBeenCalled();
          expect(mockPrepareAggregatorSwap).toHaveBeenCalledWith({
            transaction: path.aggregatorTransaction,
          });
        },
      );

      it("scans the verified aggregator envelope the review will show", async () => {
        mockPrepareAggregatorSwap.mockReturnValue("verified-swap-xdr");
        mockScanTransaction.mockResolvedValue({});
        const path = quote();
        seed(path);

        await run(path, "setupSwapTransaction");

        expect(mockScanTransaction).toHaveBeenCalledWith(
          "verified-swap-xdr",
          "internal",
        );
      });

      it("builds the trustline transaction first when the route needs one", async () => {
        const path = trustlineQuote();
        seed(path, true);

        await run(path, "setupSwapTransaction");

        expect(mockBuildTrustlineTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            tokenCode: "USDC",
            issuer: ISSUER,
            network: NETWORKS.PUBLIC,
            senderAddress: SENDER,
          }),
        );
        expect(mockPrepareAggregatorSwap).not.toHaveBeenCalled();
        expect(mockBuildSwapTransaction).not.toHaveBeenCalled();
      });

      it("refreshes an aggregator quote that has gone stale before verifying it", async () => {
        mockFetchSwapQuote.mockResolvedValue(backendQuote());
        const stale = quote({ quotedAt: Date.now() - 60_000 });
        seed(stale);

        await run(stale, "setupSwapTransaction");

        expect(mockFetchSwapQuote).toHaveBeenCalledTimes(1);
        expect(mockPrepareAggregatorSwap).toHaveBeenCalledWith(
          expect.objectContaining({
            transaction: expect.objectContaining({
              envelopeXdr: BACKEND_ENVELOPE,
            }),
          }),
        );
      });

      it("does not prepare an old quote when an input edit cancels its refresh", async () => {
        let resolveQuote!: (value: ReturnType<typeof backendQuote>) => void;
        mockFetchSwapQuote.mockReturnValueOnce(
          new Promise<ReturnType<typeof backendQuote>>((resolve) => {
            resolveQuote = resolve;
          }),
        );
        const stale = quote({ quotedAt: Date.now() - 60_000 });
        seed(stale);
        const { result } = renderHook(() =>
          useSwapTransaction(paramsFor(stale)),
        );
        let pending!: ReturnType<typeof result.current.setupSwapTransaction>;
        act(() => {
          pending = result.current.setupSwapTransaction();
          useSwapStore.getState().setSourceAmount("20");
          resolveQuote(backendQuote());
        });
        await act(async () => {
          await pending.catch(() => undefined);
        });

        expect(useSwapStore.getState().pathResult).toBeNull();
        expect(mockPrepareAggregatorSwap).not.toHaveBeenCalled();
        expect(mockScanTransaction).not.toHaveBeenCalled();
      });

      it.each(["input edit", "new quote"])(
        "does not return a review when %s replaces the quote during scanning",
        async (change) => {
          let resolveScan!: (value: unknown) => void;
          mockScanTransaction.mockReturnValueOnce(
            new Promise((resolve) => {
              resolveScan = resolve;
            }),
          );
          const path = quote();
          seed(path);
          const { result } = renderHook(() =>
            useSwapTransaction(paramsFor(path)),
          );
          let pending!: ReturnType<typeof result.current.setupSwapTransaction>;
          act(() => {
            pending = result.current.setupSwapTransaction();
            if (change === "input edit") {
              useSwapStore.getState().setSourceAmount("20");
            } else {
              useSwapStore.setState({
                pathResult: quote({
                  aggregatorTransaction: {
                    envelopeXdr: BACKEND_ENVELOPE,
                    feeStroops: "98024",
                    resourceFeeStroops: "97924",
                    expiresAt: Math.floor(Date.now() / 1000) + 180,
                  },
                }),
              });
            }
            resolveScan({});
          });
          await act(async () => {
            expect(await pending).toBeUndefined();
          });

          expect(result.current.transactionScanResult).toBeUndefined();
          expect(mockSignTransaction).not.toHaveBeenCalled();
        },
      );

      it("verifies the quote it holds when the refresh of a stale one finds no route", async () => {
        mockFetchSwapQuote.mockRejectedValueOnce({
          status: 404,
          message: "no route",
          isNetworkError: false,
        });
        const stale = quote({ quotedAt: Date.now() - 60_000 });
        seed(stale);

        await run(stale, "setupSwapTransaction");

        expect(mockFetchSwapQuote).toHaveBeenCalledTimes(1);
        expect(mockPrepareAggregatorSwap).toHaveBeenCalledWith(
          expect.objectContaining({
            transaction: expect.objectContaining({ envelopeXdr: "envelope-1" }),
          }),
        );
      });

      it("fails, without scanning anything, when the verifier rejects the transaction", async () => {
        mockPrepareAggregatorSwap.mockReturnValue(null);
        const path = quote();
        seed(path);

        await expect(run(path, "setupSwapTransaction")).rejects.toThrow(
          "Submit error from store",
        );

        expect(mockScanTransaction).not.toHaveBeenCalled();
        expect(mockSignTransaction).not.toHaveBeenCalled();
      });

      it("still builds a classic route the classic way", async () => {
        const classic = quote({
          source: SwapQuoteSource.HORIZON,
          aggregatorTransaction: undefined,
          networkFeeXlm: undefined,
          path: ["native"],
        });
        seed(classic);

        await run(classic, "setupSwapTransaction");

        expect(mockBuildSwapTransaction).toHaveBeenCalledWith(
          expect.objectContaining({ path: ["native"] }),
        );
        expect(mockPrepareAggregatorSwap).not.toHaveBeenCalled();
      });
    });

    describe("executeSwap", () => {
      it.each([
        "builder request",
        "builder XDR",
        "quote",
        "source amount",
        "destination",
        "slippage",
        "account",
        "network",
      ])("does not sign after reviewed %s changes", async (change) => {
        const path = quote();
        seed(path);
        const params = paramsFor(path);
        const { result, rerender } = renderHook(
          (props) => useSwapTransaction(props),
          { initialProps: params },
        );
        let review!: SwapReview;
        await act(async () => {
          review = await prepareReview(result);
        });
        expect(review).toBeDefined();
        act(() => {
          if (change === "builder request")
            mockGetBuilderState.mockReturnValue({ requestId: "replacement" });
          if (change === "builder XDR") mockBuilderXdr = "replacement-xdr";
          if (change === "quote")
            useSwapStore.setState({ pathResult: quote() });
          if (change === "source amount")
            useSwapStore.getState().setSourceAmount("11");
          if (change === "destination")
            useSwapStore.getState().setDestinationToken(null);
          if (change === "slippage") mockSwapSlippage = 2;
          if (change === "account")
            rerender({
              ...params,
              account: { ...params.account, publicKey: "other-account" },
            });
          if (change === "network")
            rerender({ ...params, network: NETWORKS.TESTNET });
        });
        await act(async () => {
          await result.current.executeSwap(review);
        });
        expect(mockSignTransaction).not.toHaveBeenCalled();
        expect(mockSubmitTransaction).not.toHaveBeenCalled();
      });

      it("does not accept a copied review that this hook did not scan", async () => {
        const path = quote();
        seed(path);
        const { result } = renderHook(() =>
          useSwapTransaction(paramsFor(path)),
        );
        let review!: SwapReview;
        await act(async () => {
          review = await prepareReview(result);
        });
        if (!review) throw new Error("Review missing");
        await act(async () => {
          await result.current.executeSwap({ ...review });
        });
        expect(mockSignTransaction).not.toHaveBeenCalled();
        expect(mockSubmitTransaction).not.toHaveBeenCalled();
      });

      it("consumes a scanned review once", async () => {
        const path = quote();
        seed(path);
        const { result } = renderHook(() =>
          useSwapTransaction(paramsFor(path)),
        );
        let review!: SwapReview;
        await act(async () => {
          review = await prepareReview(result);
        });
        await act(async () => {
          await result.current.executeSwap(review);
          await result.current.executeSwap(review);
        });
        expect(mockSignTransaction).toHaveBeenCalledTimes(1);
        expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
      });

      it("signs and sends the verified aggregator transaction once", async () => {
        const path = quote();
        seed(path);

        await run(path, "executeSwap");

        expect(mockSignTransaction).toHaveBeenCalledTimes(1);
        expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
        expect(mockTrackSwapSuccess).toHaveBeenCalled();
      });

      it("does not send the swap when signing is refused", async () => {
        mockSignTransaction.mockReturnValue(null);
        const path = quote();
        seed(path);

        await run(path, "executeSwap");

        expect(mockSubmitTransaction).not.toHaveBeenCalled();
        expect(mockTrackTransactionError).toHaveBeenCalledWith(
          expect.objectContaining({ isSwap: true }),
        );
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: "error" }),
        );
      });

      it("stops before signing when adopted envelope expired during review", async () => {
        mockGetBuilderState.mockReturnValue({
          requestId: "adopted",
          transactionExpiresAt: 1,
        });
        const path = quote();
        seed(path);
        await run(path, "executeSwap");
        expect(mockSignTransaction).not.toHaveBeenCalled();
        expect(mockSubmitTransaction).not.toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalled();
      });
      describe("when the trustline has to be added first", () => {
        const executeWithTrustline = () => {
          const path = trustlineQuote();
          seed(path, true);

          return run(path, "executeSwap");
        };

        const trustlineAddedCalls = () =>
          mockTrack.mock.calls.filter(
            ([event]) => event === AnalyticsEvent.SWAP_TRUSTLINE_ADDED,
          );

        it("sends the trustline, then a fresh verified swap", async () => {
          mockFetchSwapQuote.mockResolvedValue(backendQuote());

          await executeWithTrustline();

          expect(mockSubmitTransaction).toHaveBeenCalledTimes(2);
          expect(mockSignTransaction).toHaveBeenCalledTimes(2);
          expect(mockPrepareAggregatorSwap).toHaveBeenCalledWith(
            expect.objectContaining({
              transaction: expect.objectContaining({
                envelopeXdr: BACKEND_ENVELOPE,
              }),
            }),
          );
          const [firstSubmit, secondSubmit] =
            mockSubmitTransaction.mock.invocationCallOrder;
          const [prepare] = mockPrepareAggregatorSwap.mock.invocationCallOrder;
          expect(firstSubmit).toBeLessThan(prepare);
          expect(prepare).toBeLessThan(secondSubmit);
          expect(mockShowToast).not.toHaveBeenCalled();
        });

        it.each(["Close", "unmount", "builder replacement"])(
          "does not sign a newer builder XDR after %s during the swap scan",
          async (cancellation) => {
            let currentBuilderXdr = "trustline-xdr";
            const signedBuilderXdr: string[] = [];
            let resumeScan!: (value: unknown) => void;
            let scanStarted!: () => void;
            const started = new Promise<void>((resolve) => {
              scanStarted = resolve;
            });
            mockGetBuilderState.mockReturnValue({ requestId: "trustline" });
            mockPrepareAggregatorSwap.mockImplementationOnce(
              ({ transaction }: { transaction: { envelopeXdr: string } }) => {
                const { envelopeXdr } = transaction;
                currentBuilderXdr = envelopeXdr;
                mockGetBuilderState.mockReturnValue({ requestId: "swap" });
                return envelopeXdr;
              },
            );
            // Mirrors the real builder: signing reads its current global XDR.
            mockSignTransaction.mockImplementation(() => {
              signedBuilderXdr.push(currentBuilderXdr);
              return `mock-signed:${currentBuilderXdr}`;
            });
            mockFetchSwapQuote.mockResolvedValue(backendQuote());
            const path = trustlineQuote();
            seed(path, true);
            const { result, unmount } = renderHook(() =>
              useSwapTransaction(paramsFor(path)),
            );
            let review!: SwapReview;
            await act(async () => {
              review = await prepareReview(result);
            });
            mockScanTransaction.mockImplementationOnce(() => {
              scanStarted();
              return new Promise((resolve) => {
                resumeScan = resolve;
              });
            });
            let pending!: Promise<void>;
            await act(async () => {
              pending = result.current.executeSwap(review);
              await started;
            });
            act(() => {
              if (cancellation === "Close") {
                result.current.handleProcessingScreenClose();
              } else if (cancellation === "unmount") {
                unmount();
              } else {
                mockGetBuilderState.mockReturnValue({ requestId: "new-flow" });
              }
              currentBuilderXdr = "new-user-flow-xdr";
            });
            await act(async () => {
              resumeScan({});
              await pending;
            });

            expect(signedBuilderXdr).toEqual(["trustline-xdr"]);
            expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
            expect(mockShowToast).not.toHaveBeenCalled();
            if (cancellation !== "unmount") {
              expect(result.current.isProcessing).toBe(false);
            }
          },
        );

        it.each(["trustline submit", "quote refresh"])(
          "does not prepare another transaction after Close during %s",
          async (step) => {
            let resume!: () => void;
            let stepStarted!: () => void;
            const started = new Promise<void>((resolve) => {
              stepStarted = resolve;
            });
            const pause = <T>(value: T) =>
              new Promise<T>((resolve) => {
                resume = () => resolve(value);
                stepStarted();
              });
            mockFetchSwapQuote.mockResolvedValue(backendQuote());
            if (step === "trustline submit") {
              mockSubmitTransaction.mockImplementationOnce(() =>
                pause(submitOk()),
              );
            } else {
              mockFetchSwapQuote.mockImplementationOnce(() =>
                pause(backendQuote()),
              );
            }
            const path = trustlineQuote();
            seed(path, true);
            const { result } = renderHook(() =>
              useSwapTransaction(paramsFor(path)),
            );
            let pending!: Promise<void>;
            await act(async () => {
              pending = executeReviewed(result);
              await started;
            });
            act(() => result.current.handleProcessingScreenClose());
            await act(async () => {
              resume();
              await pending;
            });

            expect(mockSignTransaction).toHaveBeenCalledTimes(1);
            expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
            expect(mockPrepareAggregatorSwap).not.toHaveBeenCalled();
            expect(mockScanTransaction).not.toHaveBeenCalled();
            expect(mockShowToast).not.toHaveBeenCalled();
          },
        );

        it("does not sign the swap if the wallet locks while the trustline is submitted", async () => {
          const unlocked = isWalletUnlocked as jest.MockedFunction<
            typeof isWalletUnlocked
          >;
          mockFetchSwapQuote.mockResolvedValue(backendQuote());
          mockSubmitTransaction.mockImplementationOnce(() => {
            unlocked.mockReturnValue(false);
            return Promise.resolve(submitOk());
          });

          try {
            await executeWithTrustline();

            expect(mockSignTransaction).toHaveBeenCalledTimes(1);
            expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
            expect(mockTrackTransactionError).not.toHaveBeenCalled();
            expect(mockShowToast).not.toHaveBeenCalled();
          } finally {
            unlocked.mockReturnValue(true);
          }
        });

        it("keeps the trustline hash out of the store and the swap's own hash in", async () => {
          mockFetchSwapQuote.mockResolvedValue(backendQuote());

          await executeWithTrustline();

          expect(mockSubmitTransaction).toHaveBeenNthCalledWith(1, {
            network: NETWORKS.PUBLIC,
            isIntermediate: true,
          });
          expect(mockSubmitTransaction).toHaveBeenNthCalledWith(2, {
            network: NETWORKS.PUBLIC,
          });
        });

        it("reports the quote the swap was signed from, not the one the review showed", async () => {
          mockFetchSwapQuote.mockResolvedValue(backendQuote());
          const path = quote({
            requiresTrustlineFirst: true,
            aggregatorTransaction: undefined,
            destinationAmount: "2.3",
            destinationAmountMin: "2.27",
          });
          seed(path, true);

          await run(path, "executeSwap");

          expect(mockTrackSwapSuccess).toHaveBeenCalledTimes(1);
          const [payload] = mockTrackSwapSuccess.mock.calls[0] as [
            { destAmount?: string; volume: Record<string, unknown> },
          ];
          expect(payload.destAmount).toBe("2.2949042");
          expect(payload.volume.toAmountQuoted).toBe(2.2949042);
        });

        describe("swap.trustline_added", () => {
          it("fires once, when the swap then settles", async () => {
            mockFetchSwapQuote.mockResolvedValue(backendQuote());

            await executeWithTrustline();

            expect(mockTrackSwapSuccess).toHaveBeenCalledTimes(1);
            expect(trustlineAddedCalls()).toEqual([
              [
                AnalyticsEvent.SWAP_TRUSTLINE_ADDED,
                { asset_code: "USDC", asset_issuer: ISSUER },
              ],
            ]);
          });

          it("fires as the trustline lands, before the swap is prepared", async () => {
            mockFetchSwapQuote.mockResolvedValue(backendQuote());

            await executeWithTrustline();

            const [trackedOrder] = mockTrack.mock.invocationCallOrder;
            const [prepare] =
              mockPrepareAggregatorSwap.mock.invocationCallOrder;
            const [, swapSubmit] =
              mockSubmitTransaction.mock.invocationCallOrder;
            expect(trackedOrder).toBeLessThan(prepare);
            expect(trackedOrder).toBeLessThan(swapSubmit);
          });

          it("fires once when the swap is then rejected", async () => {
            mockFetchSwapQuote.mockResolvedValue(backendQuote());
            mockSubmitTransaction
              .mockResolvedValueOnce(submitOk())
              .mockResolvedValueOnce(submitFailed());

            await executeWithTrustline();

            expect(mockSubmitTransaction).toHaveBeenCalledTimes(2);
            expect(mockTrackSwapSuccess).not.toHaveBeenCalled();
            expect(trustlineAddedCalls()).toHaveLength(1);
          });
        });

        it("reports the real reason a trustline was rejected, with no volume", async () => {
          mockSubmitTransaction.mockResolvedValueOnce(
            rejected("op_low_reserve"),
          );

          await executeWithTrustline();

          expect(mockTrackTransactionError).toHaveBeenCalledTimes(1);
          const [payload] = mockTrackTransactionError.mock.calls[0] as [
            { errorCode: string; volume?: unknown },
          ];
          expect(payload.errorCode).toBe("op_low_reserve");
          // Nothing of the swap reached the network: no volume, and no
          // swap.quote_expired either.
          expect(payload.volume).toBeUndefined();
          expect(mockTrack).not.toHaveBeenCalledWith(
            AnalyticsEvent.SWAP_QUOTE_EXPIRED,
            expect.anything(),
          );
        });

        it("sends nothing, and reports a failed internal signing, when signing the trustline is refused", async () => {
          mockSignTransaction.mockReturnValueOnce(null);

          await executeWithTrustline();

          expect(mockSubmitTransaction).not.toHaveBeenCalled();
          expect(mockFetchSwapQuote).not.toHaveBeenCalled();
          expect(
            analytics.trackInternalSignedTransactionError,
          ).toHaveBeenCalledWith("Submit error from store");
          expect(
            analytics.trackInternalSignedTransaction,
          ).not.toHaveBeenCalled();
          expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ variant: "error" }),
          );
        });

        it("does not send the swap, and does not count the trustline, when the trustline is rejected", async () => {
          mockSubmitTransaction.mockResolvedValueOnce(submitFailed());

          await executeWithTrustline();

          expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
          expect(trustlineAddedCalls()).toHaveLength(0);
          expect(
            analytics.trackInternalSignedTransaction,
          ).toHaveBeenCalledTimes(1);
          expect(
            analytics.trackInternalSignedTransactionError,
          ).not.toHaveBeenCalled();
          expect(mockFetchSwapQuote).not.toHaveBeenCalled();
          expect(mockPrepareAggregatorSwap).not.toHaveBeenCalled();
          expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ variant: "error" }),
          );
        });

        it("stops after the trustline when the price moved below the accepted minimum", async () => {
          mockFetchSwapQuote.mockResolvedValue(
            backendQuote({
              destinationAmount: "2.2",
              destinationAmountMin: "2.178",
            }),
          );

          await executeWithTrustline();

          expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
          expect(mockPrepareAggregatorSwap).not.toHaveBeenCalled();
          expect(trustlineAddedCalls()).toHaveLength(1);
          expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
              title: "swapScreen.errors.trustlineAddedPriceMoved",
            }),
          );
        });

        it("keeps the reviewed minimum when a refreshed quote offers less protection", async () => {
          mockFetchSwapQuote.mockResolvedValue(
            backendQuote({
              destinationAmount: "2.28",
              destinationAmountMin: "2.2572",
            }),
          );

          await executeWithTrustline();

          expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
          expect(mockPrepareAggregatorSwap).not.toHaveBeenCalled();
          expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
              title: "swapScreen.errors.trustlineAddedPriceMoved",
            }),
          );
        });

        it("stops after the trustline when the aggregator no longer has a route", async () => {
          mockFetchSwapQuote.mockRejectedValue({
            status: 404,
            message: "no route",
            isNetworkError: false,
          });

          await executeWithTrustline();

          expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
          expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
              title: "swapScreen.errors.trustlineAddedSwapUnavailable",
            }),
          );
        });

        describe("scanning the swap transaction", () => {
          const benign = { validation: { result_type: "Benign" } };
          const malicious = { validation: { result_type: "Malicious" } };
          const warning = { validation: { result_type: "Warning" } };

          beforeEach(() => {
            mockFetchSwapQuote.mockResolvedValue(backendQuote());
            mockScanTransaction.mockReset();
          });

          afterAll(() => {
            mockScanTransaction.mockReset().mockResolvedValue({});
          });

          it("scans the swap envelope, not the trustline, before signing it", async () => {
            mockPrepareAggregatorSwap.mockReturnValue("swap-xdr");
            mockScanTransaction.mockResolvedValue(benign);

            await executeWithTrustline();

            expect(mockScanTransaction).toHaveBeenCalledTimes(1);
            expect(mockScanTransaction).toHaveBeenCalledWith(
              "swap-xdr",
              "internal",
            );
            const [prepare] =
              mockPrepareAggregatorSwap.mock.invocationCallOrder;
            const [scan] = mockScanTransaction.mock.invocationCallOrder;
            const [, swapSign] = mockSignTransaction.mock.invocationCallOrder;
            expect(prepare).toBeLessThan(scan);
            expect(scan).toBeLessThan(swapSign);
            expect(mockSignTransaction).toHaveBeenCalledTimes(2);
            expect(mockSubmitTransaction).toHaveBeenCalledTimes(2);
            expect(mockShowToast).not.toHaveBeenCalled();
          });

          it.each([
            ["malicious", malicious, "trustlineAddedSwapMalicious"],
            ["suspicious", warning, "trustlineAddedSwapSuspicious"],
          ])(
            "never signs or sends a swap the scan calls %s",
            async (_verdict, scan, errorKey) => {
              mockScanTransaction.mockResolvedValue(scan);

              await executeWithTrustline();

              expect(mockSignTransaction).toHaveBeenCalledTimes(1);
              expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
              expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                  title: `swapScreen.errors.${errorKey}`,
                }),
              );
            },
          );

          it("proceeds when the scan service is unavailable, as the single-transaction flow does", async () => {
            mockScanTransaction.mockRejectedValue(new Error("scan down"));

            await executeWithTrustline();

            expect(mockSignTransaction).toHaveBeenCalledTimes(2);
            expect(mockSubmitTransaction).toHaveBeenCalledTimes(2);
            expect(mockShowToast).not.toHaveBeenCalled();
          });
        });

        it("never signs a swap the verifier rejects", async () => {
          mockFetchSwapQuote.mockResolvedValue(backendQuote());
          mockPrepareAggregatorSwap.mockReturnValue(null);

          await executeWithTrustline();

          expect(mockSignTransaction).toHaveBeenCalledTimes(1);
          expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
          expect(mockScanTransaction).not.toHaveBeenCalled();
          expect(mockShowToast).toHaveBeenCalled();
        });
      });
    });
  });
});
