import { NETWORKS } from "config/constants";
import {
  fetchTokenPriceHistory,
  fetchTokenStats,
  freighterBackendV2,
} from "services/backend";

jest.mock("services/apiFactory", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const actual = jest.requireActual("services/apiFactory");
  return {
    ...actual,
    createApiService: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      getInstance: jest.fn(() => ({
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      })),
    })),
    isRequestCanceled: jest.fn(),
  };
});

jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  normalizeError: jest.fn((error) => error),
}));

const USDC = "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

const HISTORY_FIXTURE = {
  token: "native",
  range: "1D",
  resolutionSeconds: 900,
  currency: "USD",
  lowVolume: false,
  change: { absolute: "0.001359", percent: "0.86" },
  points: [{ t: 1786636800, p: "0.158900" }],
};

describe("fetchTokenPriceHistory", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockV2Get: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockV2Get = freighterBackendV2.get as jest.MockedFunction<any>;
    mockV2Get.mockResolvedValue({ data: { data: HISTORY_FIXTURE } });
  });

  it("requests the v2 endpoint with token/network/range query params", async () => {
    // Echo what we ask for: the client rejects a body for another token/range.
    mockV2Get.mockResolvedValue({
      data: { data: { ...HISTORY_FIXTURE, token: USDC, range: "1W" } },
    });

    await fetchTokenPriceHistory({
      tokenId: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      network: NETWORKS.PUBLIC,
      range: "1W",
    });

    expect(mockV2Get).toHaveBeenCalledWith("/token-price-history", {
      params: {
        token: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        network: "PUBLIC",
        range: "1W",
      },
    });
  });

  it("translates the app's 'XLM' identifier to the 'native' wire form", async () => {
    await fetchTokenPriceHistory({
      tokenId: "XLM",
      network: NETWORKS.PUBLIC,
      range: "1D",
    });

    expect(mockV2Get).toHaveBeenCalledWith("/token-price-history", {
      params: { token: "native", network: "PUBLIC", range: "1D" },
    });
  });

  it.each([
    [
      "the bare native SAC contract id",
      "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    ],
    [
      "the canonicalized contract-balance form",
      "XLM:CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    ],
  ])("translates %s to the 'native' wire identity", async (_label, tokenId) => {
    // XLM's own Stellar Asset Contract IS the native asset, and
    // `classifyToken` already resolves it that way for the About card and
    // the token_type analytics dimension. Sent as a contract id, the
    // endpoint would price a different asset from the one the card names.
    mockV2Get.mockResolvedValue({ data: { data: HISTORY_FIXTURE } });

    await fetchTokenPriceHistory({
      tokenId,
      network: NETWORKS.PUBLIC,
      range: "1D",
    });

    expect(mockV2Get).toHaveBeenCalledWith("/token-price-history", {
      params: { token: "native", network: "PUBLIC", range: "1D" },
    });
  });

  it("passes the 'native' route-param form through unchanged", async () => {
    await fetchTokenPriceHistory({
      tokenId: "native",
      network: NETWORKS.PUBLIC,
      range: "1D",
    });

    expect(mockV2Get).toHaveBeenCalledWith("/token-price-history", {
      params: { token: "native", network: "PUBLIC", range: "1D" },
    });
  });

  it("sends SEP-41 SYMBOL:CONTRACTID identifiers as-is", async () => {
    const sep41 =
      "SOLVBTC:CBIJBDNZNF4X35BJ4FFZWCDBSCKOP5NB4PLG4SNENRMLAPYG4P5FM6VN";
    mockV2Get.mockResolvedValue({
      data: { data: { ...HISTORY_FIXTURE, token: sep41, range: "ALL" } },
    });
    await fetchTokenPriceHistory({
      tokenId: sep41,
      network: NETWORKS.PUBLIC,
      range: "ALL",
    });

    expect(mockV2Get).toHaveBeenCalledWith("/token-price-history", {
      params: { token: sep41, network: "PUBLIC", range: "ALL" },
    });
  });

  it("returns the response's data payload untouched", async () => {
    const result = await fetchTokenPriceHistory({
      tokenId: "native",
      network: NETWORKS.PUBLIC,
      range: "1D",
    });

    expect(result).toEqual(HISTORY_FIXTURE);
  });

  it("throws on an unexpected response shape", async () => {
    mockV2Get.mockResolvedValueOnce({ data: {} });

    await expect(
      fetchTokenPriceHistory({
        tokenId: "native",
        network: NETWORKS.PUBLIC,
        range: "1D",
      }),
    ).rejects.toThrow();
  });
  it.each([
    [
      "a non-numeric price",
      { points: [{ t: 1786636800, p: "abc" }] },
      "malformed point",
    ],
    // `formatPriceHistoryLabel` takes abs(), so a negative close would be
    // labelled as a positive dollar amount.
    [
      "a negative price",
      { points: [{ t: 1786636800, p: "-0.15" }] },
      "malformed point",
    ],
    [
      "a whitespace-only price",
      { points: [{ t: 1786636800, p: "  " }] },
      "malformed point",
    ],
    [
      // Finite, but past Date's ±8.64e15 ms: Intl.DateTimeFormat throws on it
      // during render, where it would take down the screen.
      "a timestamp outside Date's range",
      { points: [{ t: 1e13, p: "0.15" }] },
      "malformed point",
    ],
    // The geometry takes the first bucket as t0, so a backwards series draws
    // a line that doubles back rather than failing.
    [
      "a non-chronological series",
      {
        points: [
          { t: 1786636800, p: "0.15" },
          { t: 1786636000, p: "0.16" },
          { t: 1786637700, p: "0.17" },
        ],
      },
      "out of chronological order",
    ],
    // Every downstream label prints these with a "$".
    ["another currency", { currency: "EUR" }, "unexpected currency"],
    ["a missing currency", { currency: undefined }, "unexpected currency"],
    ["a zero resolutionSeconds", { resolutionSeconds: 0 }, "resolutionSeconds"],
    [
      "a negative resolutionSeconds",
      { resolutionSeconds: -900 },
      "resolutionSeconds",
    ],
    [
      "a non-finite resolutionSeconds",
      { resolutionSeconds: Number.NaN },
      "resolutionSeconds",
    ],
    [
      "a range end outside Date's range",
      { resolutionSeconds: 8.64e12 },
      "range end",
    ],
    // null means "verdict unavailable" and warns; missing would read as false
    // and silence the notice.
    ["a missing lowVolume", { lowVolume: undefined }, "lowVolume"],
    ["a stringly lowVolume", { lowVolume: "false" }, "lowVolume"],
    [
      "a non-numeric change",
      { change: { absolute: "n/a", percent: "0.86" } },
      "malformed change",
    ],
    // The header prints one sign, from the percent, in front of both halves
    // — so this would render a $1 loss as "+$1.00 (2.00%)".
    [
      "a change whose halves disagree on sign",
      { change: { absolute: "-1", percent: "2" } },
      "disagree on sign",
    ],
    [
      "a response for another token",
      { token: "USDC:GABC" },
      "does not match requested",
    ],
    [
      "a response for another range",
      { range: "1W" },
      "does not match requested",
    ],
  ])("rejects %s at the boundary", async (_label, overrides, expected) => {
    mockV2Get.mockResolvedValue({
      data: { data: { ...HISTORY_FIXTURE, ...overrides } },
    });

    await expect(
      fetchTokenPriceHistory({
        tokenId: "native",
        network: NETWORKS.PUBLIC,
        range: "1D",
      }),
    ).rejects.toThrow(expected);
  });

  it("accepts a no-data 200 — empty points with a null change and verdict", async () => {
    mockV2Get.mockResolvedValue({
      data: {
        data: {
          ...HISTORY_FIXTURE,
          points: [],
          change: null,
          lowVolume: null,
        },
      },
    });

    await expect(
      fetchTokenPriceHistory({
        tokenId: "native",
        network: NETWORKS.PUBLIC,
        range: "1D",
      }),
    ).resolves.toMatchObject({ points: [], change: null, lowVolume: null });
  });

  it("accepts a zero change half against a non-zero one — ordinary rounding", async () => {
    mockV2Get.mockResolvedValue({
      data: {
        data: {
          ...HISTORY_FIXTURE,
          change: { absolute: "0", percent: "-0.01" },
        },
      },
    });

    await expect(
      fetchTokenPriceHistory({
        tokenId: "native",
        network: NETWORKS.PUBLIC,
        range: "1D",
      }),
    ).resolves.toMatchObject({ change: { absolute: "0", percent: "-0.01" } });
  });
});

describe("fetchTokenStats", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockV2Get: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockV2Get = freighterBackendV2.get as jest.MockedFunction<any>;
    mockV2Get.mockResolvedValue({
      data: {
        data: {
          token: "native",
          supplyOnStellar: "105443902087.3472865",
          holders: 9926520,
        },
      },
    });
  });

  it("requests token stats with the native wire translation applied", async () => {
    await fetchTokenStats({ tokenId: "XLM", network: NETWORKS.PUBLIC });

    expect(mockV2Get).toHaveBeenCalledWith("/token-stats", {
      params: { token: "native", network: "PUBLIC" },
    });
  });

  it("translates a native SAC to the 'native' wire identity for stats too", async () => {
    mockV2Get.mockResolvedValue({
      data: { data: { token: "native", supplyOnStellar: "1", holders: 1 } },
    });

    await fetchTokenStats({
      tokenId: "XLM:CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
      network: NETWORKS.PUBLIC,
    });

    expect(mockV2Get).toHaveBeenCalledWith("/token-stats", {
      params: { token: "native", network: "PUBLIC" },
    });
  });

  it.each([
    [
      "a negative supply",
      { supplyOnStellar: "-1", holders: 12 },
      "supplyOnStellar",
    ],
    ["a negative holders", { supplyOnStellar: "12", holders: -1 }, "holders"],
    ["a non-numeric supply", { supplyOnStellar: "abc" }, "supplyOnStellar"],
    // `formatStatValue` rounds down, so 1.9 would render a plausible "1".
    [
      "a fractional holders",
      { supplyOnStellar: "12", holders: 1.9 },
      "holders",
    ],
  ])("rejects %s at the stats boundary", async (_label, data, expected) => {
    // Neither a supply nor a holder count can be negative; the card would
    // otherwise present a malformed figure as a real one.
    mockV2Get.mockResolvedValue({
      data: { data: { token: "native", ...data } },
    });

    await expect(
      fetchTokenStats({ tokenId: "native", network: NETWORKS.PUBLIC }),
    ).rejects.toThrow(expected);
  });

  it("returns the stats payload", async () => {
    const result = await fetchTokenStats({
      tokenId: "native",
      network: NETWORKS.PUBLIC,
    });

    expect(result).toEqual({
      token: "native",
      supplyOnStellar: "105443902087.3472865",
      holders: 9926520,
    });
  });
});
