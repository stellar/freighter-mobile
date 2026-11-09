import BigNumber from "bignumber.js";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import {
  PricedBalance,
  SwapQuotes,
  SwapRoute,
  TokenTypeWithCustomToken,
} from "config/types";
import {
  descriptorAsPathBalance,
  swapQuoteKey,
  useSwapStore,
} from "ducks/swap";
import en from "i18n/locales/en/translations.json";
import { fetchSwapQuotes } from "services/backend";

jest.mock("services/backend", () => ({
  fetchSwapQuotes: jest.fn(),
}));

jest.mock("i18next", () => ({
  t: (key: string) => key,
}));

jest.mock("config/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockFetchSwapQuotes = fetchSwapQuotes as jest.MockedFunction<
  typeof fetchSwapQuotes
>;

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const USDC = `USDC:${USDC_ISSUER}`;
const AQUA = "AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA";
const ACCOUNT = "GBTYAFHGNZSTE4VBWZYAGB3SRGJEPTI5I4Y22KZ4JTVAN56LESB6JZOF";

const xlmBalance = {
  id: "XLM",
  tokenCode: "XLM",
  token: { code: "XLM", type: "native" },
  total: new BigNumber("100"),
  available: new BigNumber("100"),
} as unknown as PricedBalance;

const usdcBalance = {
  id: USDC,
  tokenCode: "USDC",
  token: {
    code: "USDC",
    issuer: { key: USDC_ISSUER },
    type: "credit_alphanum4",
  },
  total: new BigNumber("0"),
  available: new BigNumber("0"),
} as unknown as PricedBalance;

const classicRoute: SwapRoute = {
  source: "classic",
  fromAmount: "10",
  toAmount: "2.0000000",
  paths: [
    {
      share: "1",
      hops: [
        { venue: "stellar-dex", from: "XLM", to: AQUA },
        { venue: "stellar-dex", from: AQUA, to: USDC },
      ],
    },
  ],
  fees: [],
};

const lifiRoute: SwapRoute = {
  source: "lifi",
  fromAmount: "10",
  toAmount: "2.1000000",
  paths: [
    {
      share: "1",
      hops: [{ venue: "Aquarius", from: "XLM", to: USDC, pool: "abc" }],
    },
  ],
  fees: [],
};

const inputs = (sourceAmount = "10") => ({
  sourceBalance: xlmBalance,
  destinationBalance: usdcBalance,
  sourceAmount,
  network: NETWORKS.PUBLIC,
  publicKey: ACCOUNT,
});

const find = (sourceAmount = "10") =>
  useSwapStore
    .getState()
    .findSwapPath({ ...inputs(sourceAmount), slippage: 1 });

const apiError = (status: number) => ({
  message: `Request failed with status code ${status}`,
  status,
  isNetworkError: false,
});

describe("useSwapStore.findSwapPath — backend quotes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSwapStore.getState().resetSwap();
  });

  it("requests a send quote for the wire assets, amount, account and network", async () => {
    mockFetchSwapQuotes.mockResolvedValue({
      routes: [classicRoute],
      unavailable: [],
    });

    await find();

    expect(mockFetchSwapQuotes).toHaveBeenCalledWith({
      network: NETWORKS.PUBLIC,
      account: ACCOUNT,
      mode: "send",
      fromAsset: "XLM",
      toAsset: USDC,
      amount: "10",
    });
  });

  describe("contract tokens", () => {
    const TOKEN = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
    const heldToken = {
      id: `TKN:${TOKEN}`,
      tokenCode: "TKN",
      contractId: TOKEN,
      decimals: 18,
      token: { code: "TKN", issuer: { key: TOKEN }, type: "custom_token" },
      total: new BigNumber("5"),
      available: new BigNumber("5"),
    } as unknown as PricedBalance;

    it("quotes a held contract token by its contract ID", async () => {
      mockFetchSwapQuotes.mockResolvedValue({ routes: [], unavailable: [] });

      await useSwapStore.getState().findSwapPath({
        ...inputs("1.000000000000000001"),
        sourceBalance: heldToken,
        slippage: 1,
      });

      expect(mockFetchSwapQuotes).toHaveBeenCalledWith(
        expect.objectContaining({
          fromAsset: TOKEN,
          toAsset: USDC,
          amount: "1.000000000000000001",
        }),
      );
    });

    it("quotes into a contract token picked from search, at its decimals", async () => {
      mockFetchSwapQuotes.mockResolvedValue({
        routes: [{ ...lifiRoute, toAmount: "4.123456789012345678" }],
        unavailable: [],
      });
      const destinationBalance = descriptorAsPathBalance({
        id: `TKN:${TOKEN}`,
        tokenCode: "TKN",
        issuer: TOKEN,
        decimals: 18,
        tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
        requiresTrustline: false,
      });

      await useSwapStore.getState().findSwapPath({
        ...inputs(),
        destinationBalance,
        slippage: 1,
      });

      expect(mockFetchSwapQuotes).toHaveBeenCalledWith(
        expect.objectContaining({ fromAsset: "XLM", toAsset: TOKEN }),
      );
      expect(useSwapStore.getState().pathResult?.destinationAmountMin).toBe(
        "4.082222221122222221",
      );
    });
  });

  it("builds the path result from the first-ranked route, whichever source quoted it", async () => {
    const quotes: SwapQuotes = {
      routes: [lifiRoute, classicRoute],
      unavailable: [],
    };
    mockFetchSwapQuotes.mockResolvedValue(quotes);

    await find();

    const state = useSwapStore.getState();
    expect(state.pathError).toBeNull();
    expect(state.isLoadingPath).toBe(false);
    expect(state.pathResult).toEqual({
      sourceAmount: "10",
      destinationAmount: "2.1000000",
      destinationAmountMin: "2.0790000",
      route: lifiRoute,
      conversionRate: "0.2100000",
      quoteKey: swapQuoteKey(inputs("10")),
    });
    expect(state.destinationAmount).toBe("2.1000000");
    expect(state.swapQuotes).toEqual(quotes);
  });

  it("shows no path when the backend returns empty routes", async () => {
    const quotes: SwapQuotes = {
      routes: [],
      unavailable: [{ source: "classic", reason: "no_route" }],
    };
    mockFetchSwapQuotes.mockResolvedValue(quotes);

    await find();

    const state = useSwapStore.getState();
    expect(state.pathResult).toBeNull();
    expect(state.pathError).toBe("swapScreen.errors.noPathFound");
    expect(state.swapQuotes).toEqual(quotes);
  });

  it("shows no quote available for a Soroban pair no source can quote", async () => {
    mockFetchSwapQuotes.mockResolvedValue({
      routes: [],
      unavailable: [
        { source: "classic", reason: "unsupported" },
        { source: "lifi", reason: "no_route" },
      ],
    });

    await useSwapStore.getState().findSwapPath({
      ...inputs(),
      destinationBalance: descriptorAsPathBalance({
        id: "TKN:CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        tokenCode: "TKN",
        issuer: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        decimals: 7,
        tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
        requiresTrustline: false,
      }),
      slippage: 1,
    });

    const key = useSwapStore.getState().pathError ?? "";
    expect(key).toBe("swapScreen.errors.noPathFound");
    expect(en.swapScreen.errors.noPathFound).toBe("No quote available");
  });

  it("treats a 400 as bad input (no path), not as an outage", async () => {
    mockFetchSwapQuotes.mockRejectedValue(apiError(400));

    await find();

    expect(useSwapStore.getState().pathError).toBe(
      "swapScreen.errors.noPathFound",
    );
  });

  it.each([0, 401, 429, 500, 502, 503, 504])(
    "shows swaps temporarily unavailable on %i",
    async (status) => {
      mockFetchSwapQuotes.mockRejectedValue(apiError(status));

      await find();

      const state = useSwapStore.getState();
      expect(state.pathResult).toBeNull();
      expect(state.pathError).toBe("swapScreen.errors.swapsUnavailable");
    },
  );

  it("ignores a response that lands after a newer request was started", async () => {
    let resolveFirst: (q: SwapQuotes) => void = () => {};
    mockFetchSwapQuotes
      .mockImplementationOnce(
        () =>
          new Promise<SwapQuotes>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({
        routes: [{ ...classicRoute, fromAmount: "20", toAmount: "4.0000000" }],
        unavailable: [],
      });

    const first = find("10");
    await find("20");
    resolveFirst({ routes: [classicRoute], unavailable: [] });
    await first;

    const state = useSwapStore.getState();
    expect(state.destinationAmount).toBe("4.0000000");
    expect(state.pathResult?.sourceAmount).toBe("20");
  });

  it("ignores an in-flight response after clearPath", async () => {
    let resolveFirst: (q: SwapQuotes) => void = () => {};
    mockFetchSwapQuotes.mockImplementationOnce(
      () =>
        new Promise<SwapQuotes>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const first = find("10");
    useSwapStore.getState().clearPath();
    resolveFirst({ routes: [classicRoute], unavailable: [] });
    await first;

    const state = useSwapStore.getState();
    expect(state.pathResult).toBeNull();
    expect(state.swapQuotes).toBeNull();
    expect(state.destinationAmount).toBe("0");
    expect(state.isLoadingPath).toBe(false);
  });

  it("reports a thrown outage to Sentry", async () => {
    mockFetchSwapQuotes.mockRejectedValue(apiError(0));

    await find();

    expect(logger.error).toHaveBeenCalled();
  });

  it.each(["error", "timeout", "rate_limited"])(
    "shows swaps temporarily unavailable and reports when classic is unavailable with %s",
    async (reason) => {
      mockFetchSwapQuotes.mockResolvedValue({
        routes: [],
        unavailable: [{ source: "classic", reason }],
      });

      await find();

      const state = useSwapStore.getState();
      expect(state.pathResult).toBeNull();
      expect(state.pathError).toBe("swapScreen.errors.swapsUnavailable");
      expect(logger.error).toHaveBeenCalled();
    },
  );

  it.each(["no_route", "insufficient_balance"])(
    "shows no path when classic is unavailable with %s",
    async (reason) => {
      mockFetchSwapQuotes.mockResolvedValue({
        routes: [],
        unavailable: [{ source: "classic", reason }],
      });

      await find();

      expect(useSwapStore.getState().pathError).toBe(
        "swapScreen.errors.noPathFound",
      );
      expect(logger.error).not.toHaveBeenCalled();
    },
  );

  it("ignores an in-flight response after resetSwap", async () => {
    let resolveFirst: (q: SwapQuotes) => void = () => {};
    mockFetchSwapQuotes.mockImplementationOnce(
      () =>
        new Promise<SwapQuotes>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const first = find("10");
    useSwapStore.getState().resetSwap();
    resolveFirst({ routes: [classicRoute], unavailable: [] });
    await first;

    const state = useSwapStore.getState();
    expect(state.pathResult).toBeNull();
    expect(state.swapQuotes).toBeNull();
    expect(state.isLoadingPath).toBe(false);
  });

  it("ignores a failure that lands after a newer request was started", async () => {
    let rejectFirst: (e: unknown) => void = () => {};
    mockFetchSwapQuotes
      .mockImplementationOnce(
        () =>
          new Promise<SwapQuotes>((_, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce({ routes: [classicRoute], unavailable: [] });

    const first = find("10");
    await find("20");
    rejectFirst(apiError(503));
    await first;

    const state = useSwapStore.getState();
    expect(state.pathError).toBeNull();
    expect(state.pathResult).not.toBeNull();
  });
});

describe("swapQuoteKey", () => {
  it("changes with the amount, the destination, the account and the network", () => {
    const base = swapQuoteKey(inputs("10"));

    expect(swapQuoteKey(inputs("10"))).toBe(base);
    expect(swapQuoteKey(inputs("11"))).not.toBe(base);
    expect(
      swapQuoteKey({ ...inputs("10"), destinationBalance: xlmBalance }),
    ).not.toBe(base);
    expect(swapQuoteKey({ ...inputs("10"), publicKey: "GOTHER" })).not.toBe(
      base,
    );
    expect(
      swapQuoteKey({ ...inputs("10"), network: NETWORKS.TESTNET }),
    ).not.toBe(base);
  });
});

describe("swap quote amount wire format", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSwapStore.getState().resetSwap();
  });

  it.each([
    ["5.", "5"],
    ["1e-7", "0.0000001"],
  ])("sends the amount %s as the plain decimal %s", async (amount, wire) => {
    mockFetchSwapQuotes.mockResolvedValue({ routes: [], unavailable: [] });

    await find(amount);

    expect(mockFetchSwapQuotes).toHaveBeenCalledWith(
      expect.objectContaining({ amount: wire }),
    );
    expect(swapQuoteKey(inputs(amount))).toBe(swapQuoteKey(inputs(wire)));
  });
});
