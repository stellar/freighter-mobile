import { Asset } from "@stellar/stellar-sdk";
import { AnalyticsEvent } from "config/analyticsConfig";
import { mapNetworkToNetworkDetails, NETWORKS } from "config/constants";
import { TokenPriceHistory } from "config/types";
import {
  getChartTokenType,
  trackTokenChartBrushed,
  trackTokenChartLoaded,
  trackTokenChartRangeChanged,
  trackTokenChartViewed,
} from "services/analytics/tokenChart";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

jest.mock("services/analytics/core", () => ({
  track: jest.fn(),
}));

const { track } = jest.requireMock("services/analytics/core");

const CONTRACT_ID = "CBIJBDNZNF4X35BJ4FFZWCDBSCKOP5NB4PLG4SNENRMLAPYG4P5FM6VN";

const makeHistory = (
  overrides: Partial<TokenPriceHistory> = {},
): TokenPriceHistory => ({
  token: "native",
  range: "1D",
  resolutionSeconds: 900,
  currency: "USD",
  lowVolume: false,
  change: { absolute: "0.001359", percent: "0.86" },
  points: [
    { t: 1786636800, p: "0.158900" },
    { t: 1786637700, p: "0.159200" },
  ],
  ...overrides,
});

/**
 * The canonical §7.5 payload fixture — a FROZEN cross-platform contract with
 * the extension. Emitted payloads must deep-equal these byte-for-byte;
 * toStrictEqual guards against extra/undefined keys sneaking in.
 */
const CANONICAL_FIXTURES = {
  loadedClassic: {
    event: "token_chart.loaded",
    props: { token_type: "classic", has_data: true, range: "1D" },
  },
  loadedSorobanLowVolume: {
    event: "token_chart.loaded",
    props: {
      token_type: "soroban",
      has_data: true,
      low_volume: true,
      range: "1D",
    },
  },
  // Per-range VIEW — fires for a range the user was shown, cache hits
  // included, which `loaded` never reports. Carries the ASSET's identity; the
  // issuer is the asset's issuing account, identical for every holder, not
  // the viewer's key (that rides on every event as hashed account_id_hash).
  viewedClassic: {
    event: "token_chart.viewed",
    props: {
      asset_code: "USDC",
      asset_issuer: "GCK3D3V2XNLLKRFGFFFDEJXA4O2J4X36HET2FE446AV3M4U7DPHO3PEM",
      token_type: "classic",
      has_data: true,
      range: "1D",
    },
  },
  rangeChanged: {
    event: "token_chart.range_changed",
    props: { range: "1W" },
  },
  brushed: { event: "token_chart.brushed", props: { range: "1D" } },
} as const;

describe("token_chart analytics (frozen cross-platform payloads)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("emits the canonical viewed payload byte-for-byte", () => {
    trackTokenChartViewed({
      tokenId: "USDC:GCK3D3V2XNLLKRFGFFFDEJXA4O2J4X36HET2FE446AV3M4U7DPHO3PEM",
      data: makeHistory({ lowVolume: false }),
    });

    expect(track).toHaveBeenCalledTimes(1);
    const [event, props] = track.mock.calls[0];
    expect(event).toBe(CANONICAL_FIXTURES.viewedClassic.event);
    expect(props).toStrictEqual(CANONICAL_FIXTURES.viewedClassic.props);
  });

  it("reports native XLM identically however it is reached", () => {
    // Contract balances canonicalize as `symbol:contractId`, so XLM's own SAC
    // can arrive as `XLM:C…`. All three forms must produce ONE identity or
    // native XLM splits into several rows in the analytics.
    const sac = Asset.native().contractId(
      mapNetworkToNetworkDetails(NETWORKS.PUBLIC).networkPassphrase,
    );
    const expected = {
      asset_code: "XLM",
      token_type: "native",
      has_data: true,
      range: "1D",
    };
    ["native", "XLM", sac, `XLM:${sac}`].forEach((tokenId) => {
      jest.clearAllMocks();
      trackTokenChartViewed({
        tokenId,
        data: makeHistory({}),
        network: NETWORKS.PUBLIC,
      });
      expect(track.mock.calls[0][1]).toStrictEqual(expected);
    });
  });

  it("omits asset_issuer for native and asset_code for a bare contract id", () => {
    trackTokenChartViewed({ tokenId: "native", data: makeHistory({}) });
    expect(track.mock.calls[0][1]).toStrictEqual({
      asset_code: "XLM",
      token_type: "native",
      has_data: true,
      range: "1D",
    });

    jest.clearAllMocks();
    const contractId =
      "CBIJBDNZNF4X35BJ4FFZWCDBSCKOP5NB4PLG4SNENRMLAPYG4P5FM6VN";
    trackTokenChartViewed({ tokenId: contractId, data: makeHistory({}) });
    expect(track.mock.calls[0][1]).toStrictEqual({
      asset_issuer: contractId,
      token_type: "soroban",
      has_data: true,
      range: "1D",
    });
  });

  it("emits the canonical classic loaded payload byte-for-byte", () => {
    trackTokenChartLoaded({
      tokenId: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      data: makeHistory({ lowVolume: false }),
    });

    expect(track).toHaveBeenCalledTimes(1);
    const [event, props] = track.mock.calls[0];
    expect(event).toBe(CANONICAL_FIXTURES.loadedClassic.event);
    expect(props).toStrictEqual(CANONICAL_FIXTURES.loadedClassic.props);
  });

  it("emits the canonical soroban low-volume loaded payload byte-for-byte", () => {
    trackTokenChartLoaded({
      tokenId: `SOLVBTC:${CONTRACT_ID}`,
      data: makeHistory({ lowVolume: true }),
    });

    const [event, props] = track.mock.calls[0];
    expect(event).toBe(CANONICAL_FIXTURES.loadedSorobanLowVolume.event);
    expect(props).toStrictEqual(
      CANONICAL_FIXTURES.loadedSorobanLowVolume.props,
    );
  });

  it("emits the canonical range_changed payload byte-for-byte", () => {
    trackTokenChartRangeChanged("1W");

    const [event, props] = track.mock.calls[0];
    expect(event).toBe(CANONICAL_FIXTURES.rangeChanged.event);
    expect(props).toStrictEqual(CANONICAL_FIXTURES.rangeChanged.props);
  });

  it("emits the canonical brushed payload byte-for-byte", () => {
    trackTokenChartBrushed("1D");
    const [event, props] = track.mock.calls[0];
    expect(event).toBe(CANONICAL_FIXTURES.brushed.event);
    expect(props).toStrictEqual(CANONICAL_FIXTURES.brushed.props);
  });

  it("keeps the enum wire strings dot-namespaced per the interaction-event convention", () => {
    expect(AnalyticsEvent.TOKEN_CHART_LOADED).toBe("token_chart.loaded");
    expect(AnalyticsEvent.TOKEN_CHART_RANGE_CHANGED).toBe(
      "token_chart.range_changed",
    );
  });

  it("reports has_data: false for an empty (non-drawable) series", () => {
    trackTokenChartLoaded({
      tokenId: "native",
      data: makeHistory({ points: [], change: null }),
    });

    const [, props] = track.mock.calls[0];
    expect(props).toStrictEqual({
      token_type: "native",
      has_data: false,
      range: "1D",
    });
  });

  it("uses the response range verbatim (API enum spelling)", () => {
    trackTokenChartLoaded({
      tokenId: "native",
      data: makeHistory({ range: "ALL" }),
    });

    const [, props] = track.mock.calls[0];
    expect(props).toStrictEqual({
      token_type: "native",
      has_data: true,
      range: "ALL",
    });
  });

  describe("getChartTokenType", () => {
    it("maps the identifier forms to native | classic | soroban", () => {
      expect(getChartTokenType("native")).toBe("native");
      expect(getChartTokenType("XLM")).toBe("native");
      expect(
        getChartTokenType(
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        ),
      ).toBe("classic");
      expect(getChartTokenType(`SOLVBTC:${CONTRACT_ID}`)).toBe("soroban");
      expect(getChartTokenType(CONTRACT_ID)).toBe("soroban");
    });
  });
});
