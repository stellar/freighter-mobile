import { act, renderHook } from "@testing-library/react-hooks";
import BigNumber from "bignumber.js";
import { useSwapForXlmReserve } from "components/screens/SwapScreen/hooks/useSwapForXlmReserve";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { SwapQuotes, TokenTypeWithCustomToken } from "config/types";
import { type HeldBalanceItem } from "hooks/useBalancesList";
import { fetchSwapQuotes } from "services/backend";

jest.mock("services/backend", () => ({
  fetchSwapQuotes: jest.fn(),
}));

jest.mock("helpers/balances", () => ({
  calculateSpendableAmount: jest.fn(() => {
    const MockBigNumber =
      jest.requireActual<typeof import("bignumber.js")>("bignumber.js").default;
    return new MockBigNumber("1000");
  }),
}));

jest.mock("config/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockFetchSwapQuotes = fetchSwapQuotes as jest.MockedFunction<
  typeof fetchSwapQuotes
>;

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const USDC = `USDC:${USDC_ISSUER}`;
const ACCOUNT = "GBTYAFHGNZSTE4VBWZYAGB3SRGJEPTI5I4Y22KZ4JTVAN56LESB6JZOF";

const usdcBalance = {
  id: USDC,
  tokenCode: "USDC",
  tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
  token: {
    code: "USDC",
    issuer: { key: USDC_ISSUER },
    type: "credit_alphanum4",
  },
  total: new BigNumber("100"),
  available: new BigNumber("100"),
} as unknown as HeldBalanceItem;

const renderReserveHook = () => {
  const setSourceToken = jest.fn();
  const setDestinationToken = jest.fn();
  const setTokenAmount = jest.fn();
  const { result } = renderHook(() =>
    useSwapForXlmReserve({
      sourceBalance: usdcBalance,
      bestNonXlmClassicBalance: undefined,
      network: NETWORKS.PUBLIC,
      publicKey: ACCOUNT,
      subentryCount: 0,
      swapFee: "0.00001",
      setSourceToken,
      setDestinationToken,
      setTokenAmount,
    }),
  );
  return { result, setSourceToken, setDestinationToken, setTokenAmount };
};

describe("useSwapForXlmReserve — 0.5 XLM estimate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("asks the backend for a receive quote of 0.5 XLM paid in the sell token", async () => {
    mockFetchSwapQuotes.mockResolvedValue({ routes: [], unavailable: [] });
    const { result } = renderReserveHook();

    await act(async () => {
      await result.current.handleSwapForXlmFromSheet();
    });

    expect(mockFetchSwapQuotes).toHaveBeenCalledWith({
      network: NETWORKS.PUBLIC,
      account: ACCOUNT,
      mode: "receive",
      fromAsset: USDC,
      toAsset: "XLM",
      amount: "0.5",
    });
  });

  it("pre-fills the classic route's fromAmount", async () => {
    mockFetchSwapQuotes.mockResolvedValue({
      routes: [
        {
          source: "classic",
          fromAmount: "0.0912345",
          toAmount: "0.5",
          paths: [
            {
              share: "1",
              hops: [{ venue: "stellar-dex", from: USDC, to: "XLM" }],
            },
          ],
          fees: [],
        },
      ],
      unavailable: [],
    });
    const { result, setTokenAmount } = renderReserveHook();

    await act(async () => {
      await result.current.handleSwapForXlmFromSheet();
    });

    expect(setTokenAmount).toHaveBeenCalledWith("0.0912345");
  });

  it("leaves the amount alone when no classic route is quoted", async () => {
    mockFetchSwapQuotes.mockResolvedValue({
      routes: [],
      unavailable: [{ source: "classic", reason: "no_route" }],
    });
    const { result, setTokenAmount, setDestinationToken } = renderReserveHook();

    await act(async () => {
      await result.current.handleSwapForXlmFromSheet();
    });

    expect(setTokenAmount).not.toHaveBeenCalled();
    expect(setDestinationToken).toHaveBeenCalled();
  });

  it("still flips the receive side to XLM when the backend fails", async () => {
    mockFetchSwapQuotes.mockRejectedValue({
      message: "Request failed with status code 503",
      status: 503,
      isNetworkError: false,
    });
    const { result, setTokenAmount, setDestinationToken } = renderReserveHook();

    await act(async () => {
      await result.current.handleSwapForXlmFromSheet();
    });

    expect(setTokenAmount).not.toHaveBeenCalled();
    expect(setDestinationToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: "XLM" }),
    );
  });

  it("reports a classic outage the way a failed quote is reported", async () => {
    mockFetchSwapQuotes.mockResolvedValue({
      routes: [],
      unavailable: [{ source: "classic", reason: "timeout" }],
    });
    const { result, setTokenAmount } = renderReserveHook();

    await act(async () => {
      await result.current.handleSwapForXlmFromSheet();
    });

    expect(setTokenAmount).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("does not report a plain no-route answer", async () => {
    mockFetchSwapQuotes.mockResolvedValue({
      routes: [],
      unavailable: [{ source: "classic", reason: "no_route" }],
    });
    const { result } = renderReserveHook();

    await act(async () => {
      await result.current.handleSwapForXlmFromSheet();
    });

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("does not write the store when the quote lands after unmount", async () => {
    let resolveQuote: (q: SwapQuotes) => void = () => {};
    mockFetchSwapQuotes.mockReturnValue(
      new Promise<SwapQuotes>((resolve) => {
        resolveQuote = resolve;
      }),
    );
    const setSourceToken = jest.fn();
    const setDestinationToken = jest.fn();
    const setTokenAmount = jest.fn();
    const { result, unmount } = renderHook(() =>
      useSwapForXlmReserve({
        sourceBalance: usdcBalance,
        bestNonXlmClassicBalance: undefined,
        network: NETWORKS.PUBLIC,
        publicKey: ACCOUNT,
        subentryCount: 0,
        swapFee: "0.00001",
        setSourceToken,
        setDestinationToken,
        setTokenAmount,
      }),
    );

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.handleSwapForXlmFromSheet();
    });
    // The user backs out of the swap screen while the quote is in flight;
    // the screen's unmount resets the store, which this must not re-fill.
    unmount();
    await act(async () => {
      resolveQuote({
        routes: [
          {
            source: "classic",
            fromAmount: "0.0912345",
            toAmount: "0.5",
            paths: [
              {
                share: "1",
                hops: [{ venue: "stellar-dex", from: USDC, to: "XLM" }],
              },
            ],
            fees: [],
          },
        ],
        unavailable: [],
      });
      await pending;
    });

    expect(setDestinationToken).not.toHaveBeenCalled();
    expect(setSourceToken).not.toHaveBeenCalled();
    expect(setTokenAmount).not.toHaveBeenCalled();
  });

  it("does not quote when the sell side falls back to another token", async () => {
    const setTokenAmount = jest.fn();
    const { result } = renderHook(() =>
      useSwapForXlmReserve({
        sourceBalance: undefined,
        bestNonXlmClassicBalance: usdcBalance,
        network: NETWORKS.PUBLIC,
        publicKey: ACCOUNT,
        subentryCount: 0,
        swapFee: "0.00001",
        setSourceToken: jest.fn(),
        setDestinationToken: jest.fn(),
        setTokenAmount,
      }),
    );

    await act(async () => {
      await result.current.handleSwapForXlmFromSheet();
    });

    expect(mockFetchSwapQuotes).not.toHaveBeenCalled();
    expect(setTokenAmount).toHaveBeenCalledWith("0");
  });
});
