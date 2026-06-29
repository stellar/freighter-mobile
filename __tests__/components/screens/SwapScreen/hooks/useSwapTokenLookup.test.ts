import { renderHook, act } from "@testing-library/react-hooks";
import BigNumber from "bignumber.js";
import {
  useSwapTokenLookup,
  resetTrendingMemoryCacheForTests,
} from "components/screens/SwapScreen/hooks/useSwapTokenLookup";
import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { type HeldBalanceItem } from "hooks/useBalancesList";
import * as stellarExpert from "services/stellarExpert";

// The hook holds a module-scoped trending memory cache so component
// remounts within an app session paint instantly. Reset it between
// every test so earlier cases can't leak a populated map into later
// cases asserting on an empty trending list or a cold-start spinner.
beforeEach(() => {
  resetTrendingMemoryCacheForTests();
});

// Shared holders for store method mocks. Arrow (not jest.fn) wrappers are used
// in the jest.mock factories below so clearAllMocks doesn't wipe the wrappers;
// the inner jest.fn references are reset manually in beforeEach.
const mockStores = {
  getStellarExpertTopTokens: jest.fn(),
  scanBulkWithCache: jest.fn(),
  readTopCache: jest.fn(),
  readVerifiedCache: jest.fn(),
  readScansFor: jest.fn(),
  getVerifiedTokens: jest.fn(),
};

jest.mock("ducks/stellarExpertTopTokens", () => ({
  useStellarExpertTopTokensStore: {
    getState: () => ({
      getStellarExpertTopTokens: mockStores.getStellarExpertTopTokens,
      readCache: mockStores.readTopCache,
    }),
  },
}));

jest.mock("ducks/blockaidTokenScans", () => ({
  useBlockaidTokenScansStore: {
    getState: () => ({
      scanBulkWithCache: mockStores.scanBulkWithCache,
      readScansFor: mockStores.readScansFor,
    }),
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
      getVerifiedTokens: mockStores.getVerifiedTokens,
      readCache: mockStores.readVerifiedCache,
    }),
  },
}));

// jest.fn-backed so individual tests can flip the override mid-render to
// assert the trending effect re-fires (Debug-screen Blockaid override path).
const mockUseDebugStore = jest.fn<
  { overriddenBlockaidResponse: string | null },
  []
>(() => ({ overriddenBlockaidResponse: null }));
jest.mock("ducks/debug", () => ({
  get useDebugStore() {
    return mockUseDebugStore;
  },
}));

// Sample issuers used in mocks
const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const AQUA_ISSUER = "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA";
const FOO_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4FOOO";
const SOROBAN_CONTRACT =
  "CC64WBDGS6QQP22QTTIACYIXT3WF7BBQEYOQPLTP7GTKYY7PZ74QYGSL";

const buildHeldBalances = (): HeldBalanceItem[] => [
  {
    id: "native",
    tokenType: TokenTypeWithCustomToken.NATIVE,
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
    tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
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
    mockStores.getStellarExpertTopTokens.mockResolvedValue({
      _embedded: { records: mockTrendingRecords },
      _links: {
        self: { href: "" },
        prev: { href: "" },
        next: { href: "" },
      },
    });
    mockStores.scanBulkWithCache.mockResolvedValue({ results: {} });
    // Cold-start defaults for the SWR pipeline: no cache present, so the
    // hook falls through to the live fetch path that these tests assert on.
    mockStores.readTopCache.mockResolvedValue(null);
    mockStores.readVerifiedCache.mockResolvedValue(null);
    mockStores.readScansFor.mockResolvedValue({ hits: {}, missing: [] });
    // computeTrendingIntersection intersects with this list directly.
    // Mark the assets used in mockTrendingRecords (AQUA + USDC) as verified
    // by default so the trending list isn't empty for the bulk of tests.
    mockStores.getVerifiedTokens.mockResolvedValue([
      { issuer: USDC_ISSUER, name: "USDC", code: "USDC", domain: "circle.com" },
      {
        issuer: AQUA_ISSUER,
        name: "AQUA",
        code: "AQUA",
        domain: "aqua.network",
      },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns yourTokens from held balances", async () => {
    const held = buildHeldBalances();
    const { result } = renderHook(() =>
      useSwapTokenLookup({
        network: NETWORKS.PUBLIC,
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

  it("filters liquidity pool shares out of yourTokens", async () => {
    // Held balances with an LP share token mixed in — getTokenType returns
    // LIQUIDITY_POOL_SHARES for any id that doesn't match the
    // native / CODE:ISSUER patterns (the catch-all branch), so LP balances
    // with a hash-style id like the one Horizon returns must be filtered.
    const held = [
      ...buildHeldBalances(),
      {
        // Horizon returns LP balances with a 64-char hex hash id (no colons,
        // no native sentinel). getTokenType falls through to its catch-all
        // and classifies it as LIQUIDITY_POOL_SHARES.
        id: "7f5b1e3a8b4d2e1f9a6b3c5d8e2f4a6b8c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f",
        token: { type: "liquidity_pool_shares" },
        tokenCode: "AQUA/USDC",
        total: "5",
        available: "5",
      },
    ] as any[];

    const { result } = renderHook(() =>
      useSwapTokenLookup({
        network: NETWORKS.PUBLIC,
        balanceItems: held,
      }),
    );

    await act(async () => {
      await settleAsync();
    });

    expect(result.current.yourTokens.map((t) => t.id)).toEqual([
      "native",
      `USDC:${USDC_ISSUER}`,
    ]);
    expect(
      result.current.yourTokens.find(
        (t) =>
          t.id ===
          "7f5b1e3a8b4d2e1f9a6b3c5d8e2f4a6b8c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f",
      ),
    ).toBeUndefined();
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
    mockStores.getStellarExpertTopTokens.mockResolvedValue(null);
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

  it("degrades gracefully when getVerifiedTokens throws (e.g. cachedFetch rejects on forceRefresh)", async () => {
    // Regression: getVerifiedTokens propagates cachedFetch's throws on a
    // stale-cache forceRefresh failure, whereas getStellarExpertTopTokens
    // swallows them. Without the .catch(() => null) on the Phase 2 fetch
    // the Promise.all rejected out of the IIFE, the fallback block never
    // ran, and isTrendingLoading stayed stuck.
    mockStores.getStellarExpertTopTokens.mockResolvedValue({
      _embedded: { records: [] },
    });
    mockStores.getVerifiedTokens.mockRejectedValue(new Error("network down"));
    const held = buildHeldBalances();
    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );

    await act(async () => {
      await settleAsync();
    });

    expect(result.current.stellarExpertDown).toBe(true);
    expect(result.current.isTrendingLoading).toBe(false);
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
    mockStores.getStellarExpertTopTokens.mockResolvedValue({
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
    // if NOT held. XLM is intrinsically verified by computeTrendingIntersection
    // (native check), so we just need USDC in the verified-tokens store.
    mockStores.getVerifiedTokens.mockResolvedValueOnce([
      { issuer: USDC_ISSUER, name: "USDC", code: "USDC", domain: "circle.com" },
    ]);

    // Held balances include native XLM — id must be "native" (Horizon convention)
    const heldWithXLM: HeldBalanceItem[] = [
      {
        id: "native",
        tokenType: TokenTypeWithCustomToken.NATIVE,
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
    mockStores.getStellarExpertTopTokens.mockResolvedValue({
      _embedded: { records: trendingWithFoo },
      _links: { self: { href: "" }, prev: { href: "" }, next: { href: "" } },
    });

    // The new SWR pipeline intersects with the verified-tokens store directly
    // (computeTrendingIntersection), so the verified list is sourced from
    // getVerifiedTokens — not splitVerifiedTokens. Only USDC is verified here.
    mockStores.getVerifiedTokens.mockResolvedValueOnce([
      { issuer: USDC_ISSUER, name: "USDC", code: "USDC", domain: "circle.com" },
    ]);

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: [] }),
    );

    await act(async () => {
      await settleAsync();
    });

    // Per design doc §5.1: BOTH trendingTokens and popularTokens are the
    // intersection of stellar.expert top-50 AND the verified-tokens list.
    // Only USDC is verified in this mock, so both arrays should contain only
    // USDC (AQUA + FOO are unverified and dropped).
    const trendingCodes = result.current.trendingTokens.map((t) => t.tokenCode);
    expect(trendingCodes).toContain("USDC");
    expect(trendingCodes).not.toContain("AQUA");
    expect(trendingCodes).not.toContain("FOO");

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
    mockStores.getStellarExpertTopTokens.mockResolvedValue({
      _embedded: { records: [] },
      _links: { self: { href: "" }, prev: { href: "" }, next: { href: "" } },
    });
    mockStores.scanBulkWithCache.mockResolvedValue({ results: {} });
    mockStores.readTopCache.mockResolvedValue(null);
    mockStores.readVerifiedCache.mockResolvedValue(null);
    mockStores.readScansFor.mockResolvedValue({ hits: {}, missing: [] });
    mockStores.getVerifiedTokens.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("places held matches in heldSearchMatches and non-held in verifiedSearchMatches (held wins)", async () => {
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

    // Held USDC lives in the held bucket with hasTrustline=true.
    expect(result.current.heldSearchMatches.length).toBeGreaterThan(0);
    expect(result.current.heldSearchMatches[0].tokenCode).toBe("USDC");
    expect(result.current.heldSearchMatches[0].issuer).toBe(USDC_ISSUER);
    expect(result.current.heldSearchMatches[0].hasTrustline).toBe(true);
    // Verified bucket has the non-held matches (e.g., FOO).
    expect(result.current.verifiedSearchMatches.length).toBeGreaterThan(0);
  });

  it("discards a stale in-flight search response after the field is cleared", async () => {
    const held = buildHeldBalances();
    // Controllable response — resolves to null (stellar.expert "down") only
    // AFTER we clear the field; that resolution must be discarded.
    let resolveSearch: (value: unknown) => void = () => {};
    (stellarExpert.searchToken as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );
    await act(async () => {
      await settleAsync();
    });

    // Start a search and let the debounce fire so performSearch parks on the
    // (still-pending) searchToken call.
    act(() => {
      result.current.handleSearch("USDC");
    });
    await settleDebounce();

    // User clears the field before the response arrives.
    act(() => {
      result.current.handleSearch("");
    });

    // The stale response now resolves.
    await act(async () => {
      resolveSearch(null);
      await settleAsync();
    });

    // The cleared field must not be repopulated, and a superseded request
    // must not flip stellarExpertDown on.
    expect(result.current.stellarExpertDown).toBe(false);
    expect(result.current.heldSearchMatches.length).toBe(0);
    expect(result.current.verifiedSearchMatches.length).toBe(0);
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

    const allMatches = [
      ...result.current.heldSearchMatches,
      ...result.current.verifiedSearchMatches,
      ...result.current.unverifiedSearchMatches,
    ];
    const usdcMatches = allMatches.filter((t) => t.tokenCode === "USDC");
    expect(usdcMatches).toHaveLength(1);
    // Held wins: USDC must be in heldSearchMatches, NOT in verified/unverified.
    expect(
      result.current.heldSearchMatches.some((t) => t.tokenCode === "USDC"),
    ).toBe(true);
    expect(
      result.current.verifiedSearchMatches.some((t) => t.tokenCode === "USDC"),
    ).toBe(false);
    expect(
      result.current.unverifiedSearchMatches.some(
        (t) => t.tokenCode === "USDC",
      ),
    ).toBe(false);
  });

  it("falls back to all-unverified when splitVerifiedTokens rejects", async () => {
    // Regression: getVerifiedTokens (called inside splitVerifiedTokens)
    // propagates cachedFetch's throws when there's no cache + the API
    // fails. Before the fix, a throw mid-search exited performSearch
    // without resolving the buckets, leaving status stuck on LOADING
    // and the picker showing a permanent spinner with no results.
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
    mockSplitVerifiedTokens.mockRejectedValueOnce(new Error("API down"));

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

    // Status resolves to success (not stuck on loading).
    expect(result.current.status).toBe("success");

    // Held USDC still surfaces from the in-memory match.
    expect(result.current.heldSearchMatches.length).toBeGreaterThan(0);
    expect(result.current.heldSearchMatches[0].tokenCode).toBe("USDC");

    // With the verified split unavailable, non-held stellar.expert
    // matches all land in Unverified — none in Verified.
    expect(result.current.verifiedSearchMatches).toHaveLength(0);
    expect(result.current.unverifiedSearchMatches.length).toBeGreaterThan(0);
    expect(
      result.current.unverifiedSearchMatches.some((t) => t.tokenCode === "FOO"),
    ).toBe(true);
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

    expect(result.current.heldSearchMatches).toHaveLength(0);
    expect(result.current.verifiedSearchMatches).toHaveLength(0);
    expect(result.current.unverifiedSearchMatches).toHaveLength(0);
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

    const total =
      result.current.heldSearchMatches.length +
      result.current.verifiedSearchMatches.length +
      result.current.unverifiedSearchMatches.length;
    expect(total).toBeGreaterThan(0);
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

    // splitVerifiedTokens defaults all results to verified, so the USDC
    // record from the SECOND (successful) fetch lands in verifiedSearchMatches.
    // FOO came from the FIRST (cancelled) fetch — it must not appear in any bucket.
    const allCodes = [
      ...result.current.heldSearchMatches,
      ...result.current.verifiedSearchMatches,
      ...result.current.unverifiedSearchMatches,
    ].map((t) => t.tokenCode);
    expect(allCodes).toContain("USDC");
    expect(allCodes).not.toContain("FOO");
  });

  it("partitions active-search results into held / verified / unverified buckets", async () => {
    // Held: USDC (always lands in heldSearchMatches by virtue of being held).
    // stellar.expert returns AQUA (verified) + FOO (unverified). The
    // splitVerifiedTokens mock decides which of the two non-held records is
    // verified vs unverified.
    const held = buildHeldBalances();
    (stellarExpert.searchToken as jest.Mock).mockResolvedValue({
      _embedded: {
        records: [
          { asset: `USDC-${USDC_ISSUER}-1`, domain: "circle.com" },
          { asset: `AQUA-${AQUA_ISSUER}-1`, domain: "aqua.network" },
          { asset: `FOO-${FOO_ISSUER}-1`, domain: "foo.com" },
        ],
      },
      _links: {},
    });

    // Route AQUA to verified, FOO to unverified for this test. USDC is also
    // returned by stellar.expert but the held-first dedupe means it never
    // reaches the verified/unverified buckets either way — we treat it as
    // verified here so the implementation has to actively dedupe it out.
    mockSplitVerifiedTokens.mockImplementationOnce(
      ({ tokens }: { tokens: any[] }) =>
        Promise.resolve({
          verified: tokens.filter(
            (t) => t.tokenCode === "USDC" || t.tokenCode === "AQUA",
          ),
          unverified: tokens.filter((t) => t.tokenCode === "FOO"),
        }),
    );

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );

    await act(async () => {
      await settleAsync();
    });

    act(() => {
      // Term matches the displayName of held USDC ("USD Coin") and the
      // stellar.expert response gives us AQUA + FOO too.
      result.current.handleSearch("U");
    });

    await settleDebounce();

    // Held bucket holds USDC (and not duplicated elsewhere).
    expect(result.current.heldSearchMatches.map((t) => t.tokenCode)).toContain(
      "USDC",
    );
    // Verified bucket holds AQUA (USDC dedup'd out by held).
    expect(
      result.current.verifiedSearchMatches.map((t) => t.tokenCode),
    ).toContain("AQUA");
    expect(
      result.current.verifiedSearchMatches.map((t) => t.tokenCode),
    ).not.toContain("USDC");
    // Unverified bucket holds FOO.
    expect(
      result.current.unverifiedSearchMatches.map((t) => t.tokenCode),
    ).toContain("FOO");
  });

  it("dedupes a held token out of verified/unverified buckets when held + stellar.expert both surface it", async () => {
    // Held includes USDC; stellar.expert ALSO returns USDC. The held-first
    // dedupe must keep USDC in heldSearchMatches and drop it from the
    // verified bucket entirely.
    const held = buildHeldBalances();
    (stellarExpert.searchToken as jest.Mock).mockResolvedValue({
      _embedded: {
        records: [{ asset: `USDC-${USDC_ISSUER}-1`, domain: "circle.com" }],
      },
      _links: {},
    });
    // Default mockSplitVerifiedTokens treats every token as verified — so
    // without the dedupe, USDC would land in verifiedSearchMatches too.

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

    expect(result.current.heldSearchMatches.map((t) => t.tokenCode)).toContain(
      "USDC",
    );
    expect(
      result.current.verifiedSearchMatches.some((t) => t.tokenCode === "USDC"),
    ).toBe(false);
    expect(
      result.current.unverifiedSearchMatches.some(
        (t) => t.tokenCode === "USDC",
      ),
    ).toBe(false);
  });
});

describe("useSwapTokenLookup — holdsOnly (Swap from picker)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockStores.getStellarExpertTopTokens.mockResolvedValue({
      _embedded: { records: mockTrendingRecords },
      _links: { self: { href: "" }, prev: { href: "" }, next: { href: "" } },
    });
    mockStores.scanBulkWithCache.mockResolvedValue({ results: {} });
    mockStores.readTopCache.mockResolvedValue(null);
    mockStores.readVerifiedCache.mockResolvedValue(null);
    mockStores.readScansFor.mockResolvedValue({ hits: {}, missing: [] });
    mockStores.getVerifiedTokens.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does NOT fetch trending tokens when holdsOnly is true", async () => {
    const held = buildHeldBalances();

    renderHook(() =>
      useSwapTokenLookup({
        network: NETWORKS.PUBLIC,
        balanceItems: held,
        holdsOnly: true,
      }),
    );

    await act(async () => {
      await settleAsync();
    });

    expect(mockStores.getStellarExpertTopTokens).not.toHaveBeenCalled();
  });

  it("returns held-only search results without hitting stellar.expert when holdsOnly is true", async () => {
    const held = buildHeldBalances();

    const { result } = renderHook(() =>
      useSwapTokenLookup({
        network: NETWORKS.PUBLIC,
        balanceItems: held,
        holdsOnly: true,
      }),
    );

    await act(async () => {
      await settleAsync();
    });

    act(() => {
      result.current.handleSearch("USDC");
    });

    await settleDebounce();

    // stellar.expert searchToken must NOT have been called — the held
    // match is computed entirely in-memory.
    expect(stellarExpert.searchToken).not.toHaveBeenCalled();
    // The held USDC match comes back as the sole heldSearchMatches entry.
    expect(result.current.heldSearchMatches.length).toBe(1);
    expect(result.current.heldSearchMatches[0].tokenCode).toBe("USDC");
    expect(result.current.heldSearchMatches[0].hasTrustline).toBe(true);
    // holdsOnly never populates verified/unverified.
    expect(result.current.verifiedSearchMatches).toEqual([]);
    expect(result.current.unverifiedSearchMatches).toEqual([]);
  });

  it("flips status to LOADING synchronously on handleSearch (covers the debounce gap)", async () => {
    // Regression: consumers gate the "No tokens match …" empty-state on
    // status !== LOADING. Before this fix, status stayed at SUCCESS/IDLE
    // during the 500ms debounce window, causing the label to flash with
    // stale empty results. handleSearch now sets LOADING + clears results
    // optimistically.
    const held = buildHeldBalances();

    const { result } = renderHook(() =>
      useSwapTokenLookup({
        network: NETWORKS.PUBLIC,
        balanceItems: held,
        holdsOnly: true,
      }),
    );

    await act(async () => {
      await settleAsync();
    });

    // Pre-condition: idle, no search.
    expect(result.current.status).toBe("idle");

    act(() => {
      result.current.handleSearch("X");
    });

    // Synchronously after handleSearch — debounce hasn't fired yet, but
    // status must already be LOADING so the empty-state label is gated.
    expect(result.current.status).toBe("loading");
    expect(result.current.heldSearchMatches).toEqual([]);
    expect(result.current.verifiedSearchMatches).toEqual([]);
    expect(result.current.unverifiedSearchMatches).toEqual([]);

    // Settle the debounce → status flips to SUCCESS (with empty results
    // for this non-matching term).
    await settleDebounce();
    expect(result.current.status).toBe("success");
  });

  it("returns empty results for a search term that doesn't match any held balance", async () => {
    const held = buildHeldBalances();

    const { result } = renderHook(() =>
      useSwapTokenLookup({
        network: NETWORKS.PUBLIC,
        balanceItems: held,
        holdsOnly: true,
      }),
    );

    await act(async () => {
      await settleAsync();
    });

    act(() => {
      result.current.handleSearch("NONEXISTENT");
    });

    await settleDebounce();

    expect(stellarExpert.searchToken).not.toHaveBeenCalled();
    expect(result.current.heldSearchMatches).toEqual([]);
    expect(result.current.verifiedSearchMatches).toEqual([]);
    expect(result.current.unverifiedSearchMatches).toEqual([]);
  });
});

describe("useSwapTokenLookup — SWR for trending", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockStores.scanBulkWithCache.mockResolvedValue({ results: {} });
    mockStores.readScansFor.mockResolvedValue({ hits: {}, missing: [] });
    // clearAllMocks wipes mockUseDebugStore's implementation; restore the
    // null-override default so unrelated tests keep their pre-existing
    // assumptions.
    mockUseDebugStore.mockImplementation(() => ({
      overriddenBlockaidResponse: null,
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("Phase 1: renders preliminary trending from cache without firing a fetch (fresh caches)", async () => {
    const held = buildHeldBalances();
    mockStores.readTopCache.mockResolvedValue({
      data: {
        _embedded: {
          records: [{ asset: `USDC-${USDC_ISSUER}-1`, domain: "circle.com" }],
        },
        _links: {},
      },
      age: 5 * 60 * 1000, // 5 min — fresh
    });
    mockStores.readVerifiedCache.mockResolvedValue({
      data: [
        {
          issuer: USDC_ISSUER,
          name: "USDC",
          code: "USDC",
          domain: "circle.com",
        },
      ],
      age: 5 * 60 * 1000,
    });

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );
    await act(async () => {
      await settleAsync();
    });

    expect(result.current.trendingTokens.map((t) => t.tokenCode)).toContain(
      "USDC",
    );
    expect(mockStores.getStellarExpertTopTokens).not.toHaveBeenCalled();
    expect(mockStores.getVerifiedTokens).not.toHaveBeenCalled();
  });

  it("Phase 2: stale cache renders preliminary AND fires forceRefresh on stale layer(s)", async () => {
    const held = buildHeldBalances();
    mockStores.readTopCache.mockResolvedValue({
      data: { _embedded: { records: [] }, _links: {} },
      age: 31 * 60 * 1000, // stale
    });
    mockStores.readVerifiedCache.mockResolvedValue({
      data: [],
      age: 1 * 60 * 1000, // fresh
    });
    mockStores.getStellarExpertTopTokens.mockResolvedValue({
      _embedded: { records: [] },
      _links: {},
    });
    mockStores.getVerifiedTokens.mockResolvedValue([]);

    renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );
    await act(async () => {
      await settleAsync();
    });

    expect(mockStores.getStellarExpertTopTokens).toHaveBeenCalledWith(
      expect.objectContaining({ forceRefresh: true }),
    );
    expect(mockStores.getVerifiedTokens).toHaveBeenCalledWith(
      expect.objectContaining({ forceRefresh: false }),
    );
  });

  it("Cold-start: no cache → shows isTrendingLoading=true, then resolves after fetch", async () => {
    const held = buildHeldBalances();
    mockStores.readTopCache.mockResolvedValue(null);
    mockStores.readVerifiedCache.mockResolvedValue(null);
    mockStores.getStellarExpertTopTokens.mockResolvedValue({
      _embedded: {
        records: [{ asset: `USDC-${USDC_ISSUER}-1`, domain: "circle.com" }],
      },
      _links: {},
    });
    mockStores.getVerifiedTokens.mockResolvedValue([
      { issuer: USDC_ISSUER, name: "USDC", code: "USDC", domain: "circle.com" },
    ]);

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );

    // Immediately after first render: loading flag is set.
    expect(result.current.isTrendingLoading).toBe(true);

    await act(async () => {
      await settleAsync();
    });

    expect(result.current.isTrendingLoading).toBe(false);
    expect(result.current.trendingTokens.map((t) => t.tokenCode)).toContain(
      "USDC",
    );
  });

  it("Phase 2 failure with cached data: keep stale list, do NOT flip stellarExpertDown", async () => {
    const held = buildHeldBalances();
    mockStores.readTopCache.mockResolvedValue({
      data: {
        _embedded: {
          records: [{ asset: `USDC-${USDC_ISSUER}-1`, domain: "circle.com" }],
        },
        _links: {},
      },
      age: 31 * 60 * 1000,
    });
    mockStores.readVerifiedCache.mockResolvedValue({
      data: [
        {
          issuer: USDC_ISSUER,
          name: "USDC",
          code: "USDC",
          domain: "circle.com",
        },
      ],
      age: 1 * 60 * 1000,
    });
    mockStores.getStellarExpertTopTokens.mockResolvedValue(null); // refresh fails

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );
    await act(async () => {
      await settleAsync();
    });

    expect(result.current.stellarExpertDown).toBe(false);
    expect(result.current.trendingTokens.map((t) => t.tokenCode)).toContain(
      "USDC",
    );
  });

  it("Cold-start failure: no cache + fetch fails → stellarExpertDown=true", async () => {
    const held = buildHeldBalances();
    mockStores.readTopCache.mockResolvedValue(null);
    mockStores.readVerifiedCache.mockResolvedValue(null);
    mockStores.getStellarExpertTopTokens.mockResolvedValue(null);
    mockStores.getVerifiedTokens.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );
    await act(async () => {
      await settleAsync();
    });

    expect(result.current.stellarExpertDown).toBe(true);
  });

  it("re-fires trending pipeline when overriddenBlockaidResponse changes (Debug toggle)", async () => {
    // The Debug-screen Blockaid override is consumed by mergeBlockaidScans
    // inside the trending effect. If overriddenBlockaidResponse is missing
    // from the dep array, flipping the toggle mid-session won't re-render
    // the Trending list — a silent regression behind a QA-only path.
    const held = buildHeldBalances();
    mockStores.readTopCache.mockResolvedValue({
      data: {
        _embedded: {
          records: [{ asset: `USDC-${USDC_ISSUER}-1`, domain: "circle.com" }],
        },
        _links: {},
      },
      age: 5 * 60 * 1000,
    });
    mockStores.readVerifiedCache.mockResolvedValue({
      data: [
        {
          issuer: USDC_ISSUER,
          name: "USDC",
          code: "USDC",
          domain: "circle.com",
        },
      ],
      age: 5 * 60 * 1000,
    });

    // Start with no override.
    mockUseDebugStore.mockImplementation(() => ({
      overriddenBlockaidResponse: null,
    }));
    const { rerender } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );
    await act(async () => {
      await settleAsync();
    });
    const phaseOneTopCacheCalls = mockStores.readTopCache.mock.calls.length;

    // Flip the override. If overriddenBlockaidResponse is in the deps,
    // the trending effect must re-run (re-read readCache + re-render).
    mockUseDebugStore.mockImplementation(() => ({
      overriddenBlockaidResponse: "MALICIOUS",
    }));
    rerender();
    await act(async () => {
      await settleAsync();
    });

    expect(mockStores.readTopCache.mock.calls.length).toBeGreaterThan(
      phaseOneTopCacheCalls,
    );
  });

  it("refreshTrending: force-refreshes all 3 layers and replaces trendingTokens", async () => {
    const held = buildHeldBalances();
    mockStores.readTopCache.mockResolvedValue(null);
    mockStores.readVerifiedCache.mockResolvedValue(null);
    mockStores.getStellarExpertTopTokens.mockResolvedValue({
      _embedded: {
        records: [{ asset: `USDC-${USDC_ISSUER}-1`, domain: "circle.com" }],
      },
      _links: {},
    });
    mockStores.getVerifiedTokens.mockResolvedValue([
      { issuer: USDC_ISSUER, name: "USDC", code: "USDC", domain: "circle.com" },
    ]);

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );
    await act(async () => {
      await settleAsync();
    });

    mockStores.getStellarExpertTopTokens.mockClear();
    mockStores.getVerifiedTokens.mockClear();
    mockStores.scanBulkWithCache.mockClear();

    await act(async () => {
      await result.current.refreshTrending();
    });

    expect(mockStores.getStellarExpertTopTokens).toHaveBeenCalledWith(
      expect.objectContaining({ forceRefresh: true }),
    );
    expect(mockStores.getVerifiedTokens).toHaveBeenCalledWith(
      expect.objectContaining({ forceRefresh: true }),
    );
    expect(mockStores.scanBulkWithCache).toHaveBeenCalledWith(
      expect.objectContaining({ forceRefresh: true }),
    );
  });

  it("refreshTrending: rejects when fetch fails so callers can surface a toast", async () => {
    const held = buildHeldBalances();
    mockStores.readTopCache.mockResolvedValue(null);
    mockStores.readVerifiedCache.mockResolvedValue(null);
    mockStores.getStellarExpertTopTokens.mockResolvedValue(null);
    mockStores.getVerifiedTokens.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );
    await act(async () => {
      await settleAsync();
    });

    await expect(
      act(async () => {
        await result.current.refreshTrending();
      }),
    ).rejects.toBeDefined();
  });

  it("refreshTrending: preserves the original error via Error.cause on Promise.all rejection", async () => {
    // Regression: refreshTrending used to throw a generic
    // "Failed to refresh trending tokens" with no link to the actual
    // network error. Sentry breadcrumbs need the underlying cause to
    // be useful for debugging.
    const held = buildHeldBalances();
    mockStores.readTopCache.mockResolvedValue(null);
    mockStores.readVerifiedCache.mockResolvedValue(null);
    // Let the mount-effect SWR pipeline succeed first, then queue the
    // rejection for the user-initiated refresh call.
    mockStores.getStellarExpertTopTokens.mockResolvedValueOnce({
      _embedded: { records: [] },
      _links: {},
    });
    mockStores.getVerifiedTokens.mockResolvedValueOnce([]);

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );
    await act(async () => {
      await settleAsync();
    });

    const underlyingError = new Error("ENETDOWN");
    mockStores.getStellarExpertTopTokens.mockRejectedValueOnce(underlyingError);
    mockStores.getVerifiedTokens.mockResolvedValueOnce([]);

    let caught: unknown;
    try {
      await act(async () => {
        await result.current.refreshTrending();
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/refresh trending tokens/i);
    expect((caught as Error & { cause?: unknown }).cause).toBe(underlyingError);
  });

  it("refreshTrending: names the missing layer when a fetch returns null", async () => {
    // Distinguish "stellar.expert returned null" from
    // "verified-tokens returned null" so the error message points to
    // the actual culprit.
    const held = buildHeldBalances();
    mockStores.readTopCache.mockResolvedValue(null);
    mockStores.readVerifiedCache.mockResolvedValue(null);
    mockStores.getStellarExpertTopTokens.mockResolvedValue(null);
    mockStores.getVerifiedTokens.mockResolvedValue([
      { issuer: USDC_ISSUER, name: "USDC", code: "USDC", domain: "" },
    ] as any);

    const { result } = renderHook(() =>
      useSwapTokenLookup({ network: NETWORKS.PUBLIC, balanceItems: held }),
    );
    await act(async () => {
      await settleAsync();
    });

    let caught: unknown;
    try {
      await act(async () => {
        await result.current.refreshTrending();
      });
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).message).toMatch(/stellar\.expert returned null/);
  });
});
