/* eslint-disable @fnando/consistent-import/consistent-import */
import { act } from "@testing-library/react-native";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { TokenTypeWithCustomToken } from "config/types";
import { SwapInputSide, useSwapStore } from "ducks/swap";
import { SwapQuoteSource, fetchSwapQuote } from "services/backend";

import {
  CONTRACT,
  ISSUER,
  SENDER,
  backendQuote,
  dejtrsy,
  usdc,
  xlm,
} from "../../__mocks__/swapFixtures";

const mockStrictSendPaths = jest.fn();
const mockHorizonRequestUse = jest.fn();

jest.mock("@stellar/stellar-sdk", () => ({
  ...jest.requireActual("@stellar/stellar-sdk"),
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      strictSendPaths: mockStrictSendPaths,
      httpClient: {
        interceptors: { request: { use: mockHorizonRequestUse } },
      },
    })),
  },
}));

jest.mock("i18next", () => ({ t: (key: string) => key }));

jest.mock("services/backend", () => ({
  ...jest.requireActual("services/backend"),
  fetchSwapQuote: jest.fn(),
}));

const mockFetchSwapQuote = fetchSwapQuote as jest.Mock;

const noRoute = { status: 404, message: "no route", isNetworkError: false };
const badGateway = {
  status: 502,
  message: "bad gateway",
  isNetworkError: false,
};

const params = {
  sourceBalance: xlm,
  destinationBalance: usdc,
  sourceAmount: "10",
  slippage: 1,
  timeoutSeconds: 180,
  network: NETWORKS.PUBLIC,
  publicKey: SENDER,
};

const exactOut = {
  ...params,
  sourceAmount: undefined,
  destinationAmount: "2.3",
};

const aggregatorQuote = backendQuote();

const DEV_FLAG = "__DEV__";
const isDev: unknown = Reflect.get(globalThis, DEV_FLAG);

// Outside a development build the store shows the localised message instead of
// the underlying one.
const showLocalisedErrors = () => {
  Reflect.set(globalThis, DEV_FLAG, false);
};

const horizonReturns = (destinationAmount: string) =>
  mockStrictSendPaths.mockReturnValueOnce({
    limit: () => ({
      call: () =>
        Promise.resolve({
          records: [{ destination_amount: destinationAmount, path: [] }],
        }),
    }),
  });

describe("useSwapStore.findSwapPath — backend quote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchSwapQuote.mockReset();
    mockStrictSendPaths.mockReset();
    useSwapStore.getState().resetSwap();
  });

  afterEach(() => {
    Reflect.set(globalThis, DEV_FLAG, isDev);
  });

  describe("quote request ordering", () => {
    const deferredQuote = () => {
      let resolve!: (quote: ReturnType<typeof backendQuote>) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<ReturnType<typeof backendQuote>>(
        (yes, no) => {
          resolve = yes;
          reject = no;
        },
      );
      return { promise, resolve, reject };
    };

    it("keeps the latest exact-output quote when an older request finishes last", async () => {
      const older = deferredQuote();
      mockFetchSwapQuote.mockReturnValueOnce(older.promise);
      const pending = useSwapStore.getState().findSwapPath(exactOut);
      const olderSignal = mockFetchSwapQuote.mock.calls[0][0]
        .signal as AbortSignal;
      mockFetchSwapQuote.mockResolvedValueOnce(
        backendQuote({
          sourceAmount: "20",
          destinationAmount: "5",
          destinationAmountMin: "4.95",
        }),
      );
      await useSwapStore.getState().findSwapPath({
        ...exactOut,
        destinationAmount: "5",
      });
      expect(olderSignal.aborted).toBe(true);
      older.resolve(backendQuote({ destinationAmount: "2.3" }));
      await pending;

      expect(useSwapStore.getState()).toMatchObject({
        sourceAmount: "20",
        destinationAmount: "5",
        pathResult: { sourceAmount: "20", destinationAmount: "5" },
      });
    });

    it.each([
      [
        "source token",
        () => useSwapStore.getState().setSourceToken("native", "XLM"),
      ],
      [
        "destination token",
        () =>
          useSwapStore.getState().setDestinationToken({
            id: `USDC:${ISSUER}`,
            tokenCode: "USDC",
            issuer: ISSUER,
            decimals: 7,
            tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
            requiresTrustline: false,
          }),
      ],
      ["source amount", () => useSwapStore.getState().setSourceAmount("20")],
      [
        "receive amount",
        () => useSwapStore.getState().setDestinationInputAmount("5"),
      ],
      [
        "input side",
        () => useSwapStore.getState().setInputSide(SwapInputSide.SOURCE),
      ],
      ["clear", () => useSwapStore.getState().clearPath()],
      ["reset", () => useSwapStore.getState().resetSwap()],
    ])(
      "discards an in-flight quote after %s changes",
      async (_name, change) => {
        useSwapStore.setState({
          inputSide: SwapInputSide.DESTINATION,
          sourceAmount: "10",
          destinationInputAmount: "2.3",
        });
        const older = deferredQuote();
        mockFetchSwapQuote.mockReturnValueOnce(older.promise);
        const pending = useSwapStore.getState().findSwapPath(exactOut);
        const signal = mockFetchSwapQuote.mock.calls[0][0]
          .signal as AbortSignal;
        expect(signal.aborted).toBe(false);
        change();
        expect(signal.aborted).toBe(true);
        const changed = useSwapStore.getState();
        expect(changed.isLoadingPath).toBe(false);
        older.resolve(aggregatorQuote);
        await pending;

        expect(useSwapStore.getState()).toMatchObject({
          sourceAmount: changed.sourceAmount,
          destinationAmount: "0",
          pathResult: null,
          pathError: null,
        });
      },
    );

    it("ignores a stale silent failure while the newer quote is loading", async () => {
      const older = deferredQuote();
      const newer = deferredQuote();
      mockFetchSwapQuote.mockReturnValueOnce(older.promise);
      const pendingOlder = useSwapStore
        .getState()
        .findSwapPath({ ...exactOut, silent: true });
      mockFetchSwapQuote.mockReturnValueOnce(newer.promise);
      const pendingNewer = useSwapStore.getState().findSwapPath(exactOut);
      older.reject(noRoute);
      await pendingOlder;
      expect(useSwapStore.getState().isLoadingPath).toBe(true);
      expect(useSwapStore.getState().pathError).toBeNull();
      newer.resolve(aggregatorQuote);
      await pendingNewer;
    });

    it("ends loading when a newer silent refresh fails before an older normal request", async () => {
      const older = deferredQuote();
      mockFetchSwapQuote.mockReturnValueOnce(older.promise);
      const pending = useSwapStore.getState().findSwapPath(exactOut);
      mockFetchSwapQuote.mockRejectedValueOnce(noRoute);
      await useSwapStore.getState().findSwapPath({ ...exactOut, silent: true });
      older.resolve(aggregatorQuote);
      await pending;
      expect(useSwapStore.getState().isLoadingPath).toBe(false);
      expect(useSwapStore.getState().pathResult).toBeNull();
    });

    it("does not fall back or log when an aborted backend request rejects", async () => {
      const older = deferredQuote();
      const newer = deferredQuote();
      mockFetchSwapQuote.mockReturnValueOnce(older.promise);
      const pendingOlder = useSwapStore.getState().findSwapPath(params);
      mockFetchSwapQuote.mockReturnValueOnce(newer.promise);
      const pendingNewer = useSwapStore.getState().findSwapPath(params);
      const newerSignal = mockFetchSwapQuote.mock.calls[1][0]
        .signal as AbortSignal;
      older.reject(badGateway);
      await pendingOlder;
      expect(mockStrictSendPaths).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(useSwapStore.getState().isLoadingPath).toBe(true);
      // The older finally must not release the newer controller.
      useSwapStore.getState().clearPath(true);
      expect(newerSignal.aborted).toBe(true);
      newer.resolve(aggregatorQuote);
      await pendingNewer;
      expect(useSwapStore.getState().isLoadingPath).toBe(true);
      expect(useSwapStore.getState().pathResult).toBeNull();
    });

    it("aborts a Horizon fallback without publishing or logging its stale failure", async () => {
      let rejectHorizon!: (error: Error) => void;
      const horizon = new Promise<never>((_resolve, reject) => {
        rejectHorizon = reject;
      });
      mockFetchSwapQuote.mockRejectedValueOnce(badGateway);
      mockStrictSendPaths.mockReturnValueOnce({
        limit: () => ({ call: () => horizon }),
      });
      const pending = useSwapStore.getState().findSwapPath(params);
      // Wait for the backend failure to enter the fallback.
      await Promise.resolve();
      await Promise.resolve();
      expect(mockHorizonRequestUse).toHaveBeenCalledTimes(1);
      const interceptor = mockHorizonRequestUse.mock.calls[0][0] as (
        config: object,
      ) => { signal: AbortSignal };
      const { signal } = interceptor({});
      expect(signal).toBe(mockFetchSwapQuote.mock.calls[0][0].signal);
      useSwapStore.getState().clearPath(true);
      jest.clearAllMocks();
      expect(signal.aborted).toBe(true);
      rejectHorizon(new Error("aborted"));
      await pending;
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(useSwapStore.getState()).toMatchObject({
        isLoadingPath: true,
        pathResult: null,
        pathError: null,
      });
    });
  });

  it.each([
    ["an unknown venue", { source: "unknown" }],
    ["a negative input", { sourceAmount: "-1" }],
    ["an exponent input", { sourceAmount: "1e1" }],
    ["an exponent output", { destinationAmount: "2.2949042e0" }],
    ["an unbounded output", { destinationAmount: "1e999999999" }],
    ["a non-finite input", { sourceAmount: "Infinity" }],
    [
      "input precision the source token cannot represent",
      { sourceAmount: "10.00000001" },
    ],
    ["a negative output", { destinationAmount: "-1" }],
    ["a non-finite output", { destinationAmount: "NaN" }],
    [
      "output precision the destination token cannot represent",
      { destinationAmount: "2.29490421" },
    ],
    ["a negative minimum", { destinationAmountMin: "-1" }],
    ["a non-finite minimum", { destinationAmountMin: "Infinity" }],
    [
      "minimum precision the destination token cannot represent",
      { destinationAmountMin: "2.27195511" },
    ],
    ["a minimum above the quoted output", { destinationAmountMin: "3" }],
    [
      "a minimum below the user's slippage bound",
      { destinationAmountMin: "0.0000001" },
    ],
  ])("rejects %s in a backend quote", async (_name, override) => {
    mockFetchSwapQuote.mockResolvedValueOnce(backendQuote(override));
    await useSwapStore.getState().findSwapPath(exactOut);
    expect(useSwapStore.getState().pathResult).toBeNull();
    expect(useSwapStore.getState().pathError).toBeTruthy();
    expect(mockStrictSendPaths).not.toHaveBeenCalled();
  });

  it("rejects a backend quote that changes a fixed sell amount", async () => {
    mockFetchSwapQuote.mockResolvedValueOnce(
      backendQuote({ sourceAmount: "11" }),
    );
    await useSwapStore.getState().findSwapPath({
      ...params,
      sourceBalance: { ...dejtrsy, decimals: 7 },
    });
    expect(useSwapStore.getState().pathResult).toBeNull();
    expect(useSwapStore.getState().pathError).toBeTruthy();
  });

  it("accepts a minimum floored in 18-decimal atoms without intermediate rounding", async () => {
    mockFetchSwapQuote.mockResolvedValueOnce(
      backendQuote({
        destinationAmount: "0.000000000000000001",
        destinationAmountMin: "0",
        destinationDecimals: 18,
      }),
    );
    await useSwapStore.getState().findSwapPath({
      ...exactOut,
      destinationAmount: "0.000000000000000001",
      destinationBalance: dejtrsy,
      slippage: 0.5,
    });
    expect(useSwapStore.getState().pathResult?.destinationAmountMin).toBe("0");
  });

  it("names both assets the way the backend expects and uses its route, minimum, fee and transaction", async () => {
    mockFetchSwapQuote.mockResolvedValueOnce(aggregatorQuote);

    await useSwapStore.getState().findSwapPath(params);

    const { pathResult, destinationAmount, pathError } =
      useSwapStore.getState();
    expect(pathError).toBeNull();
    expect(destinationAmount).toBe("2.2949042");
    expect(pathResult).toMatchObject({
      source: SwapQuoteSource.XOXNO,
      destinationAmountMin: "2.2719551",
      conversionRate: "0.2294904",
      networkFeeXlm: "0.0098024",
      aggregatorTransaction: aggregatorQuote.transaction,
    });
    expect(pathResult?.requiresTrustlineFirst).toBeUndefined();
    expect(mockStrictSendPaths).not.toHaveBeenCalled();
    expect(mockFetchSwapQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        network: NETWORKS.PUBLIC,
        sourceAsset: "XLM",
        destAsset: `USDC:${ISSUER}`,
        sourceAmount: "10",
        sender: SENDER,
        slippagePercent: 1,
        timeoutSeconds: 180,
      }),
    );
  });

  it("marks an aggregator route that needs the trustline first", async () => {
    const { transaction, networkFeeXlm, ...withoutTx } = aggregatorQuote;
    mockFetchSwapQuote.mockResolvedValueOnce({
      ...withoutTx,
      requiresTrustline: true,
    });

    await useSwapStore.getState().findSwapPath(params);

    const { pathResult } = useSwapStore.getState();
    expect(pathResult?.requiresTrustlineFirst).toBe(true);
    expect(pathResult?.aggregatorTransaction?.envelopeXdr).toBeUndefined();
  });

  it("keeps the classic route as a Horizon quote", async () => {
    mockFetchSwapQuote.mockResolvedValueOnce({
      source: SwapQuoteSource.HORIZON,
      sourceAmount: "10",
      destinationAmount: "2.2884255",
      destinationAmountMin: "2.2655412",
      destinationDecimals: 7,
      conversionRate: "0.2288426",
      path: ["native"],
    });

    await useSwapStore.getState().findSwapPath(params);

    expect(useSwapStore.getState().pathResult).toMatchObject({
      source: SwapQuoteSource.HORIZON,
      path: ["native"],
      destinationAmountMin: "2.2655412",
    });
    expect(
      useSwapStore.getState().pathResult?.aggregatorTransaction?.envelopeXdr,
    ).toBeUndefined();
  });

  it("reports no path, without asking Horizon, when the backend finds none", async () => {
    mockFetchSwapQuote.mockRejectedValueOnce(noRoute);

    await useSwapStore.getState().findSwapPath(params);

    expect(useSwapStore.getState().pathResult).toBeNull();
    expect(useSwapStore.getState().pathError).toBe(
      "swapScreen.errors.noPathFound",
    );
    expect(mockStrictSendPaths).not.toHaveBeenCalled();
  });

  it("falls back to Horizon when the backend cannot answer", async () => {
    mockFetchSwapQuote.mockRejectedValueOnce(badGateway);
    horizonReturns("2.2884255");

    await useSwapStore.getState().findSwapPath(params);

    expect(useSwapStore.getState().pathResult).toMatchObject({
      source: SwapQuoteSource.HORIZON,
      destinationAmount: "2.2884255",
      destinationAmountMin: "2.2655412",
    });
  });

  it("ends a canceled classic quote without a fallback or visible error", async () => {
    mockFetchSwapQuote.mockRejectedValueOnce({ message: "canceled" });
    await useSwapStore.getState().findSwapPath(params);
    expect(mockStrictSendPaths).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(useSwapStore.getState()).toMatchObject({
      isLoadingPath: false,
      pathResult: null,
      pathError: null,
    });
  });

  it.each([
    [
      "a connectivity failure",
      { status: 0, message: "Network Error", isNetworkError: true },
    ],
    ["an unexpected error", new Error("boom")],
  ])(
    "asks Horizon about a classic pair after %s from the backend",
    async (_name, failure) => {
      mockFetchSwapQuote.mockRejectedValueOnce(failure);
      horizonReturns("2.2884255");

      await useSwapStore.getState().findSwapPath(params);

      expect(mockStrictSendPaths).toHaveBeenCalledTimes(1);
      expect(useSwapStore.getState().pathResult).toMatchObject({
        source: SwapQuoteSource.HORIZON,
        destinationAmount: "2.2884255",
      });
      expect(useSwapStore.getState().pathError).toBeNull();
    },
  );

  it("does not trust a classic quote whose decimals differ from the token's and asks Horizon", async () => {
    mockFetchSwapQuote.mockResolvedValueOnce({
      ...aggregatorQuote,
      destinationDecimals: 6,
    });
    horizonReturns("2.2884255");

    await useSwapStore.getState().findSwapPath(params);

    expect(mockStrictSendPaths).toHaveBeenCalledTimes(1);
    expect(useSwapStore.getState().pathResult).toMatchObject({
      source: SwapQuoteSource.HORIZON,
      destinationAmount: "2.2884255",
    });
  });

  it.each([
    ["an exact-out quote", exactOut],
    ["a Soroban token", { ...params, destinationBalance: dejtrsy }],
  ])("has no on-device fallback for %s", async (_name, request) => {
    showLocalisedErrors();
    mockFetchSwapQuote.mockRejectedValueOnce(badGateway);

    await useSwapStore.getState().findSwapPath(request);

    expect(mockStrictSendPaths).not.toHaveBeenCalled();
    expect(useSwapStore.getState().pathResult).toBeNull();
    expect(useSwapStore.getState().pathError).toBe(
      "swapScreen.errors.pathFindFailed",
    );
    expect(useSwapStore.getState().sourceAmount).toBe("0");
  });

  it("does not touch the current quote when a silent refresh fails", async () => {
    mockFetchSwapQuote.mockResolvedValueOnce(aggregatorQuote);
    await useSwapStore.getState().findSwapPath(params);
    const before = useSwapStore.getState().pathResult;

    mockFetchSwapQuote.mockRejectedValueOnce(noRoute);
    await useSwapStore.getState().findSwapPath({ ...params, silent: true });

    expect(useSwapStore.getState().pathResult).toBe(before);
    expect(useSwapStore.getState().pathError).toBeNull();
  });

  it("replaces the quote in place on a successful silent refresh", async () => {
    mockFetchSwapQuote.mockResolvedValueOnce(aggregatorQuote);
    await useSwapStore.getState().findSwapPath(params);
    const before = useSwapStore.getState().pathResult;

    mockFetchSwapQuote.mockResolvedValueOnce({
      ...aggregatorQuote,
      destinationAmount: "2.3",
      destinationAmountMin: "2.277",
    });
    await useSwapStore.getState().findSwapPath({ ...params, silent: true });

    const after = useSwapStore.getState().pathResult;
    expect(after).not.toBe(before);
    expect(after?.destinationAmount).toBe("2.3");
    expect(useSwapStore.getState().isLoadingPath).toBe(false);
  });

  describe("exact-out (the user typed what to receive)", () => {
    const sized = {
      ...aggregatorQuote,
      sourceAmount: "10.0489927",
      destinationAmount: "2.3027190",
      destinationAmountMin: "2.2796918",
    };

    it("asks the backend for the wanted output and takes the sized input", async () => {
      mockFetchSwapQuote.mockResolvedValueOnce(sized);

      await useSwapStore.getState().findSwapPath(exactOut);

      expect(mockFetchSwapQuote).toHaveBeenCalledWith(
        expect.objectContaining({ destAmount: "2.3", sourceAmount: undefined }),
      );
      const state = useSwapStore.getState();
      expect(state.sourceAmount).toBe("10.0489927");
      expect(state.sourceAmountDisplay).toBeTruthy();
      expect(state.destinationAmount).toBe("2.3027190");
      expect(state.pathResult?.sourceAmount).toBe("10.0489927");
    });

    it("leaves a typed amount to sell alone", async () => {
      mockFetchSwapQuote.mockResolvedValueOnce(aggregatorQuote);
      act(() => useSwapStore.getState().setSourceAmount("10"));

      await useSwapStore.getState().findSwapPath(params);

      expect(useSwapStore.getState().sourceAmount).toBe("10");
    });
  });

  describe("clearing the path and the input side", () => {
    it.each([
      [
        "clearing the path also clears the derived amount to sell",
        () => {
          useSwapStore.getState().setInputSide(SwapInputSide.DESTINATION);
          useSwapStore.setState({
            sourceAmount: "10.0489927",
            destinationAmount: "2.3",
          });
        },
        "0",
      ],
      [
        "clearing the path keeps a typed amount to sell",
        () => useSwapStore.getState().setSourceAmount("10"),
        "10",
      ],
    ])("%s", (_title, setup, expectedSourceAmount) => {
      act(setup);

      useSwapStore.getState().clearPath();

      expect(useSwapStore.getState().sourceAmount).toBe(expectedSourceAmount);
      expect(useSwapStore.getState().destinationAmount).toBe("0");
    });

    it("starts on the source side and resets to it", () => {
      expect(useSwapStore.getState().inputSide).toBe(SwapInputSide.SOURCE);
      act(() =>
        useSwapStore.getState().setInputSide(SwapInputSide.DESTINATION),
      );
      act(() => useSwapStore.getState().resetSwap());
      expect(useSwapStore.getState().inputSide).toBe(SwapInputSide.SOURCE);
      expect(useSwapStore.getState().destinationInputAmount).toBe("0");
    });
  });

  describe("Soroban tokens", () => {
    const sorobanQuote = {
      ...aggregatorQuote,
      destinationAmount: "22.472857901466989983",
      destinationAmountMin: "22.248129322452320083",
      destinationDecimals: 18,
    };

    it.each([
      [
        "buying",
        { destinationBalance: dejtrsy },
        sorobanQuote,
        {
          sourceAsset: "XLM",
          destAsset: CONTRACT,
          sourceDecimals: 7,
          destDecimals: 18,
        },
      ],
      [
        "selling",
        { sourceBalance: dejtrsy, destinationBalance: xlm },
        { ...aggregatorQuote, destinationDecimals: 7 },
        {
          sourceAsset: CONTRACT,
          destAsset: "XLM",
          sourceDecimals: 18,
          destDecimals: 7,
        },
      ],
    ])(
      "asks for the contract id and both decimals when %s a Soroban token",
      async (_side, override, quote, expected) => {
        mockFetchSwapQuote.mockResolvedValueOnce(quote);

        await useSwapStore.getState().findSwapPath({ ...params, ...override });

        expect(mockFetchSwapQuote).toHaveBeenCalledWith(
          expect.objectContaining(expected),
        );
        expect(useSwapStore.getState().pathResult).toMatchObject({
          destinationAmount: quote.destinationAmount,
          destinationAmountMin: quote.destinationAmountMin,
        });
      },
    );

    it("sizes a wanted Soroban output in the token's own decimals", async () => {
      mockFetchSwapQuote.mockResolvedValueOnce({
        ...sorobanQuote,
        sourceAmount: "22.2489214",
      });

      await useSwapStore.getState().findSwapPath({
        ...params,
        sourceAmount: undefined,
        destinationAmount: "5",
        destinationBalance: dejtrsy,
      });

      expect(mockFetchSwapQuote).toHaveBeenCalledWith(
        expect.objectContaining({ destAmount: "5", destDecimals: 18 }),
      );
      expect(useSwapStore.getState().sourceAmount).toBe("22.2489214");
    });
  });

  describe("failure logging", () => {
    const expectLoggedOnce = (level: "warn" | "error", message: string) => {
      const other = level === "warn" ? "error" : "warn";

      expect(logger[level]).toHaveBeenCalledTimes(1);
      expect(logger[level]).toHaveBeenCalledWith(
        "SwapStore",
        message,
        expect.anything(),
      );
      expect(logger[other]).not.toHaveBeenCalled();
    };

    const soroban = { ...params, destinationBalance: dejtrsy };

    it("does not trust a Soroban quote whose decimals differ from the token's, and logs it once, at error", async () => {
      showLocalisedErrors();
      mockFetchSwapQuote.mockResolvedValueOnce(
        backendQuote({ destinationDecimals: 7 }),
      );

      await useSwapStore.getState().findSwapPath(soroban);

      expect(useSwapStore.getState().pathResult).toBeNull();
      expect(useSwapStore.getState().pathError).toBe(
        "swapScreen.errors.pathFindFailed",
      );
      expectLoggedOnce("error", "Swap quote decimals differ from the token's");
      expect(logger.error).toHaveBeenCalledWith(
        "SwapStore",
        expect.any(String),
        expect.objectContaining({
          message: expect.stringContaining("quoted 7, expected 18"),
        }),
      );
    });

    it("logs a connectivity failure once, at warn", async () => {
      const offline = {
        status: 0,
        message: "Network Error",
        isNetworkError: true,
      };
      mockFetchSwapQuote.mockRejectedValueOnce(offline);

      await useSwapStore.getState().findSwapPath(soroban);

      expectLoggedOnce("warn", "Swap quote unreachable");
    });

    it("logs a backend server error once, at error", async () => {
      mockFetchSwapQuote.mockRejectedValueOnce(badGateway);

      await useSwapStore.getState().findSwapPath(soroban);

      expectLoggedOnce("error", "Swap quote request failed");
    });

    it("logs each of two distinct failures once when Horizon fails after the backend", async () => {
      mockFetchSwapQuote.mockRejectedValueOnce(badGateway);
      mockStrictSendPaths.mockImplementationOnce(() => {
        throw new Error("horizon down");
      });

      await useSwapStore.getState().findSwapPath(params);

      expect(logger.error).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenNthCalledWith(
        1,
        "SwapStore",
        "Swap quote request failed",
        badGateway,
      );
      expect(logger.error).toHaveBeenNthCalledWith(
        2,
        "SwapStore",
        "Failed to find swap path",
        expect.objectContaining({ message: "horizon down" }),
      );
    });

    it.each([
      ["no route exists", noRoute],
      ["the request is canceled", { message: "canceled" }],
    ])("logs nothing when %s", async (_name, failure) => {
      mockFetchSwapQuote.mockRejectedValueOnce(failure);

      await useSwapStore.getState().findSwapPath(soroban);

      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
