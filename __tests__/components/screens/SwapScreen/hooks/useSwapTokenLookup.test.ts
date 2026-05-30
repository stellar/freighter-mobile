import { renderHook, act } from "@testing-library/react-hooks";
import BigNumber from "bignumber.js";
import { useSwapTokenLookup } from "components/screens/SwapScreen/hooks/useSwapTokenLookup";
import { NETWORKS } from "config/constants";
import { PricedBalance, TokenTypeWithCustomToken } from "config/types";
import * as stellarExpert from "services/stellarExpert";

// Shared holders for store method mocks. Arrow (not jest.fn) wrappers are used
// in the jest.mock factories below so clearAllMocks doesn't wipe the wrappers;
// the inner jest.fn references are reset manually in beforeEach.
const mockStores = {
  getTrendingTokens: jest.fn(),
  scanBulkWithCache: jest.fn(),
};

jest.mock("ducks/trendingTokens", () => ({
  useTrendingTokensStore: {
    getState: () => ({ getTrendingTokens: mockStores.getTrendingTokens }),
  },
}));

jest.mock("ducks/blockaidTokenScans", () => ({
  useBlockaidTokenScansStore: {
    getState: () => ({ scanBulkWithCache: mockStores.scanBulkWithCache }),
  },
}));

jest.mock("services/stellarExpert", () => ({
  searchToken: jest.fn(),
}));

jest.mock("helpers/balances", () => {
  const originalModule = jest.requireActual("helpers/balances");
  return {
    ...originalModule,
    formatTokenIdentifier: (tokenId: string) => {
      const [tokenCode, issuer] = tokenId.split(":");
      return { tokenCode, issuer };
    },
  };
});

jest.mock("helpers/soroban", () => ({
  isContractId: (value: string) =>
    typeof value === "string" && value.startsWith("C") && value.length === 56,
  getNativeContractDetails: () => ({
    contract: "native-contract-id",
    issuer: "native-issuer-id",
    code: "XLM",
    domain: "stellar.org",
  }),
}));

// Default: treat every token as verified; individual tests may override via
// mockSplitVerifiedTokens.mockImplementation(…).
// NOTE: variable must be prefixed "mock" so Jest's hoisting allows the
// jest.mock factory to reference it.
const mockSplitVerifiedTokens = jest.fn(
  ({
    tokens,
  }: {
    tokens: unknown[];
  }): Promise<{ verified: unknown[]; unverified: unknown[] }> =>
    // Treat every token as verified for these unit tests; the held>verified
    // ordering still falls out because the held-first dedupe wins.
    Promise.resolve({ verified: tokens, unverified: [] }),
);

jest.mock("helpers/splitVerifiedTokens", () => ({
  get splitVerifiedTokens() {
    return mockSplitVerifiedTokens;
  },
}));

jest.mock("ducks/verifiedTokens", () => ({
  useVerifiedTokensStore: {
    getState: () => ({
      getVerifiedTokens: jest.fn().mockResolvedValue([]),
    }),
  },
}));

jest.mock("ducks/debug", () => ({
  useDebugStore: () => ({ overriddenBlockaidResponse: null }),
}));

// Sample issuers used in mocks
const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const AQUA_ISSUER = "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA";
const FOO_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4FOOO";
const SOROBAN_CONTRACT =
  "CC64WBDGS6QQP22QTTIACYIXT3WF7BBQEYOQPLTP7GTKYY7PZ74QYGSL";

const buildHeldBalances = (): (PricedBalance & { id: string })[] => [
  {
    id: "native",
    total: new BigNumber("100"),
    available: new BigNumber("99"),
    minimumBalance: new BigNumber("1"),
    buyingLiabilities: "0",
    sellingLiabilities: "0",
    token: { code: "XLM", type: "native" as const },
    tokenCode: "XLM",
    fiatCode: "USD",
    fiatTotal: new BigNumber("50"),
    displayName: "Stellar Lumens",
    currentPrice: new BigNumber("0.5"),
    percentagePriceChange24h: new BigNumber("2.5"),
  },
  {
    id: `USDC:${USDC_ISSUER}`,
    total: new BigNumber("50"),
    available: new BigNumber("50"),
    limit: new BigNumber("1000000"),
    buyingLiabilities: "0",
    sellingLiabilities: "0",
    token: {
      code: "USDC",
      type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      issuer: { key: USDC_ISSUER },
    },
    tokenCode: "USDC",
    fiatCode: "USD",
    fiatTotal: new BigNumber("50"),
    displayName: "USD Coin",
    currentPrice: new BigNumber("1"),
    percentagePriceChange24h: new BigNumber("0"),
  },
];

// Lets the idle effect's fetchTrendingAssets promise resolve and propagate.
const settleAsync = async () => {
  // Flush microtasks a few times to cover chained awaits inside the hook.
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

// Advance past the 500ms debounce + flush the resulting promise chain.
const settleDebounce = async () => {
  await act(async () => {
    jest.advanceTimersByTime(500);
    await settleAsync();
  });
  await act(async () => {
    await settleAsync();
  });
};

const mockTrendingRecords = [
  // Classic — AQUA (not held)
  {
    asset: `AQUA-${AQUA_ISSUER}-1`,
    domain: "aqua.network",
    tomlInfo: { code: "AQUA", issuer: AQUA_ISSUER, image: "aqua-image" },
  },
  // Classic — USDC (held)
  {
    asset: `USDC-${USDC_ISSUER}-1`,
    domain: "circle.com",
    tomlInfo: { code: "USDC", issuer: USDC_ISSUER, image: "usdc-image" },
  },
  // Soroban — should be filtered out
  {
    asset: SOROBAN_CONTRACT,
    domain: "centrifuge.io",
    code: "SOROBANTOKEN",
    tomlInfo: {
      code: "SOROBANTOKEN",
      issuer: SOROBAN_CONTRACT,
      image: "soroban-image",
    },
  },
];

describe("useSwapTokenLookup — idle mode", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockStores.getTrendingTokens.mockResolvedValue({
      _embedded: { records: mockTrendingRecords },
      _links: {
        self: { href: "" },
        prev: { href: "" },
        next: { href: "" },
      },
    });
    mockStores.scanBulkWithCache.mockResolvedValue({ results: {} });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns yourTokens from held balances", async () => {
    const held = buildHeldBalances();
    const { result } = renderHook(() =>
      useSwapTokenLookup({
        network: NETWORKS.PUBLIC,
        publicKey: "GTEST",
        balanceItems: held,
      }),
    );

    await act(async () => {
      await settleAsync();
    });

    expect(result.current.yourTokens).toHaveLength(2);
    expect(result.current.yourTokens.map((t) => t.id)).toEqual([
      "native",
      `USDC:${USDC_ISSUER}`,
    ]);
  });

  it("filters Soroban contracts out of popularTokens and trendingTokens", async () => {
    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: [] }),
    );

    await act(async () => {
      await settleAsync();
    });

    expect(result.current.trendingTokens.length).toBeGreaterThan(0);
    expect(result.current.trendingTokens.map((t) => t.tokenCode)).not.toContain(
      "SOROBANTOKEN",
    );
    expect(result.current.popularTokens.map((t) => t.tokenCode)).not.toContain(
      "SOROBANTOKEN",
    );
  });

  it("excludes held tokens from popularTokens but keeps them in trendingTokens", async () => {
    const held = buildHeldBalances();
    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );

    await act(async () => {
      await settleAsync();
    });

    expect(result.current.trendingTokens.length).toBeGreaterThan(0);
    expect(result.current.popularTokens.map((t) => t.tokenCode)).not.toContain(
      "USDC",
    );
    expect(result.current.trendingTokens.map((t) => t.tokenCode)).toContain(
      "USDC",
    );
  });

  it("sets stellarExpertDown=true and degrades gracefully on fetch failure", async () => {
    mockStores.getTrendingTokens.mockResolvedValue(null);
    const held = buildHeldBalances();
    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );

    await act(async () => {
      await settleAsync();
    });

    expect(result.current.stellarExpertDown).toBe(true);
    expect(result.current.popularTokens).toEqual([]);
    expect(result.current.trendingTokens).toEqual([]);
    expect(result.current.yourTokens).toHaveLength(2);
  });

  it("excludes XLM from popularTokens when the user holds it (native canonical ID)", async () => {
    // stellar.expert returns XLM as one of the trending records. The native
    // balance has id "native" (Horizon convention) but the stellar.expert
    // record uses asset "XLM". Before the fix, heldIdsKey stored "native"
    // for the native balance, which did NOT match the "XLM" canonical ID
    // derived from the stellar.expert record — so XLM was not excluded from
    // popularTokens for users already holding it.
    mockStores.getTrendingTokens.mockResolvedValue({
      _embedded: {
        records: [
          // Native XLM record — asset field is just "XLM" (no issuer segment)
          { asset: "XLM", domain: "stellar.org", tomlInfo: undefined },
          // One other classic token
          {
            asset: `USDC-${USDC_ISSUER}-1`,
            domain: "circle.com",
            tomlInfo: {
              code: "USDC",
              issuer: USDC_ISSUER,
              image: "usdc-image",
            },
          },
        ],
      },
      _links: { self: { href: "" }, prev: { href: "" }, next: { href: "" } },
    });

    // Mark both XLM and USDC as verified so they would appear in popularTokens
    // if NOT held.
    mockSplitVerifiedTokens.mockImplementationOnce(
      ({ tokens }: { tokens: unknown[] }) =>
        Promise.resolve({ verified: tokens, unverified: [] }),
    );

    // Held balances include native XLM — id must be "native" (Horizon convention)
    const heldWithXLM: (PricedBalance & { id: string })[] = [
      {
        id: "native",
        total: new BigNumber("100"),
        available: new BigNumber("99"),
        minimumBalance: new BigNumber("1"),
        buyingLiabilities: "0",
        sellingLiabilities: "0",
        token: { code: "XLM", type: "native" as const },
        tokenCode: "XLM",
        fiatCode: "USD",
        fiatTotal: new BigNumber("50"),
        displayName: "Stellar Lumens",
        currentPrice: new BigNumber("0.5"),
        percentagePriceChange24h: new BigNumber("2.5"),
      },
    ];

    const { result } = renderHook(() =>
      useSwapTokenLookup({
        network: NETWORKS.PUBLIC,
        balanceItems: heldWithXLM,
      }),
    );

    await act(async () => {
      await settleAsync();
    });

    // XLM should NOT appear in popularTokens (user already holds it)
    expect(result.current.popularTokens.map((t) => t.tokenCode)).not.toContain(
      "XLM",
    );
    // XLM SHOULD appear in trendingTokens (held-inclusive list)
    expect(result.current.trendingTokens.map((t) => t.tokenCode)).toContain(
      "XLM",
    );
    // USDC (not held) should still appear in popularTokens
    expect(result.current.popularTokens.map((t) => t.tokenCode)).toContain(
      "USDC",
    );
  });

  it("includes only verified tokens in popularTokens (intersection with verified lists)", async () => {
    // fetchTrendingAssets returns three classic records: AQUA (unverified in
    // this scenario), USDC (verified), and a third token FOO (unverified).
    const trendingWithFoo = [
      {
        asset: `AQUA-${AQUA_ISSUER}-1`,
        domain: "aqua.network",
        tomlInfo: { code: "AQUA", issuer: AQUA_ISSUER, image: "aqua-image" },
      },
      {
        asset: `USDC-${USDC_ISSUER}-1`,
        domain: "circle.com",
        tomlInfo: { code: "USDC", issuer: USDC_ISSUER, image: "usdc-image" },
      },
      {
        asset: `FOO-${FOO_ISSUER}-1`,
        domain: "foo.com",
        tomlInfo: { code: "FOO", issuer: FOO_ISSUER, image: "foo-image" },
      },
    ];
    mockStores.getTrendingTokens.mockResolvedValue({
      _embedded: { records: trendingWithFoo },
      _links: { self: { href: "" }, prev: { href: "" }, next: { href: "" } },
    });

    // Override splitVerifiedTokens: only USDC is verified; AQUA + FOO are not.
    mockSplitVerifiedTokens.mockImplementationOnce(
      ({ tokens }: { tokens: unknown[] }) => {
        const tokenList = tokens as Array<{ tokenCode: string }>;
        const verified = tokenList.filter((t) => t.tokenCode === "USDC");
        const unverified = tokenList.filter((t) => t.tokenCode !== "USDC");
        return Promise.resolve({ verified, unverified });
      },
    );

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: [] }),
    );

    await act(async () => {
      await settleAsync();
    });

    // trendingTokens must include ALL three classic records (unverified included)
    const trendingCodes = result.current.trendingTokens.map((t) => t.tokenCode);
    expect(trendingCodes).toContain("AQUA");
    expect(trendingCodes).toContain("USDC");
    expect(trendingCodes).toContain("FOO");

    // popularTokens must be the verified subset only (no held tokens to
    // exclude here, so all three verified tokens would appear — but only
    // USDC is verified in this mock).
    const popularCodes = result.current.popularTokens.map((t) => t.tokenCode);
    expect(popularCodes).toContain("USDC");
    expect(popularCodes).not.toContain("AQUA");
    expect(popularCodes).not.toContain("FOO");
  });
});

describe("useSwapTokenLookup — active search", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockStores.getTrendingTokens.mockResolvedValue({
      _embedded: { records: [] },
      _links: { self: { href: "" }, prev: { href: "" }, next: { href: "" } },
    });
    mockStores.scanBulkWithCache.mockResolvedValue({ results: {} });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns held > verified > stellar.expert order in a single Results array", async () => {
    const held = buildHeldBalances();
    (stellarExpert.searchToken as jest.Mock).mockResolvedValue({
      _embedded: {
        records: [
          { asset: `FOO-${FOO_ISSUER}-1`, domain: "foo.com" },
          { asset: `USDC-${USDC_ISSUER}-1`, domain: "circle.com" },
        ],
      },
      _links: {},
    });

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );

    await act(async () => {
      await settleAsync();
    });

    act(() => {
      result.current.handleSearch("USDC");
    });

    await settleDebounce();

    expect(result.current.searchResults.length).toBeGreaterThan(0);
    // Held USDC must be first (held precedence over verified/remainder)
    expect(result.current.searchResults[0].tokenCode).toBe("USDC");
    expect(result.current.searchResults[0].issuer).toBe(USDC_ISSUER);
    expect(result.current.searchResults[0].hasTrustline).toBe(true);
  });

  it("dedupes by CODE:ISSUER across sources", async () => {
    const held = buildHeldBalances();
    (stellarExpert.searchToken as jest.Mock).mockResolvedValue({
      _embedded: {
        records: [
          { asset: `USDC-${USDC_ISSUER}-1`, domain: "circle.com" },
          { asset: `USDC-${USDC_ISSUER}-1`, domain: "circle.com" },
          { asset: `FOO-${FOO_ISSUER}-1`, domain: "foo.com" },
        ],
      },
      _links: {},
    });

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );

    await act(async () => {
      await settleAsync();
    });

    act(() => {
      result.current.handleSearch("USDC");
    });

    await settleDebounce();

    const usdcMatches = result.current.searchResults.filter(
      (t) => t.tokenCode === "USDC",
    );
    expect(usdcMatches).toHaveLength(1);
  });

  it("sets hadSorobanMatches=true when name search returns only Soroban records and filtered list is empty", async () => {
    (stellarExpert.searchToken as jest.Mock).mockResolvedValue({
      _embedded: {
        records: [
          {
            asset: SOROBAN_CONTRACT,
            domain: "centrifuge.io",
            code: "SOROBANTOKEN",
          },
        ],
      },
      _links: {},
    });

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: [] }),
    );

    await act(async () => {
      await settleAsync();
    });

    act(() => {
      result.current.handleSearch("soroban");
    });

    await settleDebounce();

    expect(result.current.searchResults).toHaveLength(0);
    expect(result.current.hadSorobanMatches).toBe(true);
  });

  it("does NOT set hadSorobanMatches when mixed results yield classic matches too", async () => {
    (stellarExpert.searchToken as jest.Mock).mockResolvedValue({
      _embedded: {
        records: [
          { asset: `USDC-${USDC_ISSUER}-1`, domain: "circle.com" },
          {
            asset: SOROBAN_CONTRACT,
            domain: "centrifuge.io",
            code: "SOROBANTOKEN",
          },
        ],
      },
      _links: {},
    });

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: [] }),
    );

    await act(async () => {
      await settleAsync();
    });

    act(() => {
      result.current.handleSearch("usd");
    });

    await settleDebounce();

    expect(result.current.searchResults.length).toBeGreaterThan(0);
    expect(result.current.hadSorobanMatches).toBe(false);
  });

  it("cancels in-flight requests when the search term changes mid-flight", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    (stellarExpert.searchToken as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    (stellarExpert.searchToken as jest.Mock).mockResolvedValueOnce({
      _embedded: {
        records: [{ asset: `USDC-${USDC_ISSUER}-1`, domain: "circle.com" }],
      },
      _links: {},
    });

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: [] }),
    );

    await act(async () => {
      await settleAsync();
    });

    // First keystroke — schedules debounced fetch
    act(() => {
      result.current.handleSearch("a");
    });

    // Fire the first debounce so its promise starts (and hangs)
    await act(async () => {
      jest.advanceTimersByTime(500);
      await settleAsync();
    });

    // Second keystroke — cancels the first and schedules a new one
    act(() => {
      result.current.handleSearch("ab");
    });

    // Resolve the first (now-cancelled) request — its result must be ignored
    resolveFirst({
      _embedded: {
        records: [{ asset: `FOO-${FOO_ISSUER}-1`, domain: "foo.com" }],
      },
      _links: {},
    });

    // Settle the new debounce and let the second fetch finish
    await settleDebounce();

    const tokenCodes = result.current.searchResults.map((t) => t.tokenCode);
    expect(tokenCodes).toContain("USDC");
    expect(tokenCodes).not.toContain("FOO");
  });
});
