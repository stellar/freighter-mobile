import { act, fireEvent, waitFor } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
import TokenPriceHistorySection from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceHistorySection";
import TokenBalanceHeader from "components/screens/TokenDetailsScreen/components/TokenBalanceHeader";
import { TEXT_SIZES } from "components/sds/Typography";
import { getThemeColors } from "config/colors";
import { NETWORKS } from "config/constants";
import { PricedBalance, TokenPriceHistory } from "config/types";
import { useBalancesStore } from "ducks/balances";
import {
  usePriceHistoryStore,
  resetInFlightRequests,
} from "ducks/priceHistory";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { fsValue } from "helpers/dimensions";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import {
  Dimensions,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
} from "react-native";
import { ReactTestInstance } from "react-test-renderer";
import { fetchTokenPriceHistory } from "services/backend";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

jest.mock("services/backend", () => ({
  fetchTokenPriceHistory: jest.fn(),
  fetchTokenStats: jest.fn(),
}));

jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockFetchHistory = fetchTokenPriceHistory as jest.MockedFunction<
  typeof fetchTokenPriceHistory
>;

const densePoints = Array.from({ length: 40 }, (_, i) => ({
  t: 1786636800 + i * 900,
  p: (0.15 + i * 0.001).toFixed(6),
}));

const makeHistory = (
  overrides: Partial<TokenPriceHistory> = {},
): TokenPriceHistory => ({
  token: "native",
  range: "1D",
  resolutionSeconds: 900,
  currency: "USD",
  lowVolume: false,
  change: { absolute: "0.0602", percent: "32.12" },
  points: densePoints,
  ...overrides,
});

/** Requests issued for ONE range, across the whole warm pass. */
const callsForRange = (range: string): number =>
  mockFetchHistory.mock.calls.filter(([params]) => params.range === range)
    .length;

const nativeBalance = {
  token: { type: "native", code: "XLM" },
  total: new BigNumber("100"),
  available: new BigNumber("99"),
  minimumBalance: new BigNumber("1"),
  buyingLiabilities: "0",
  sellingLiabilities: "0",
  tokenCode: "XLM",
  displayName: "Stellar Lumens",
  id: "XLM",
  fiatCode: "USD",
  fiatTotal: new BigNumber("28"),
  currentPrice: new BigNumber("0.28"),
  // The 24h number the header shows today — the non-chart fallback.
  percentagePriceChange24h: new BigNumber("1.23"),
} as unknown as PricedBalance;

/**
 * The detail-view arrangement: the header and the chart section side by side,
 * exactly as TokenDetailsScreen renders them. The header's delta must follow
 * the section's selector without the two ever fetching twice.
 */
const renderDetailView = (network: NETWORKS = NETWORKS.PUBLIC) =>
  renderWithProviders(
    <View>
      <TokenBalanceHeader
        tokenId="native"
        tokenSymbol="XLM"
        network={network}
      />
      <TokenPriceHistorySection tokenId="native" network={network} />
    </View>,
  );

describe("TokenBalanceHeader range delta", () => {
  beforeEach(() => {
    resetInFlightRequests();
    jest.clearAllMocks();
    useRemoteConfigStore.setState({
      isInitialized: true,
      use_token_price_history: true,
    });
    usePriceHistoryStore.setState({
      historyByNetwork: {},
      statsByNetwork: {},
      historyStatusByKey: {},
      selectedRange: null,
    });
    useBalancesStore.setState({
      pricedBalances: { native: nativeBalance },
    });
    mockFetchHistory.mockResolvedValue(makeHistory());
  });

  it("shows the selected range's delta — absolute and percent — in the header", async () => {
    const { getByTestId } = renderDetailView();

    await waitFor(() => {
      expect(getByTestId("token-price-delta").props.children).toBe(
        "+$0.0602 (32.12%)",
      );
    });
  });

  it("renders exactly one delta in the detail view — the chart section renders none", async () => {
    const { getByTestId, queryByTestId, queryAllByTestId } = renderDetailView();

    await waitFor(() => {
      expect(getByTestId("price-history-chart")).toBeTruthy();
    });

    expect(queryByTestId("price-history-delta")).toBeNull();
    expect(queryAllByTestId("token-price-delta")).toHaveLength(1);
  });

  it("keeps the row's height but shows no text when change is null", async () => {
    mockFetchHistory.mockResolvedValue(makeHistory({ change: null }));

    const { getByTestId, queryByTestId } = renderDetailView();

    await waitFor(() => {
      expect(getByTestId("price-history-chart")).toBeTruthy();
    });

    expect(queryByTestId("token-price-delta")).toBeNull();
    const row = getByTestId("token-price-delta-row");
    expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThan(0);
  });

  it("reserves the row from the live text scale, like the chart labels", async () => {
    // `Text md` scales its line height with the OS text size. A fixed reserve
    // leaves the placeholder row short, so a range resolving would jump the
    // header and the chart below it for large-text users.
    const window = Dimensions.get("window");
    const screen = Dimensions.get("screen");
    act(() => {
      Dimensions.set({ window: { ...window, fontScale: 2 }, screen });
    });
    try {
      mockFetchHistory.mockResolvedValue(makeHistory({ change: null }));
      const { getByTestId } = renderDetailView();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });

      const row = getByTestId("token-price-delta-row");
      expect(StyleSheet.flatten(row.props.style).minHeight).toBe(
        fsValue(TEXT_SIZES.md.lineHeight) * 2,
      );
    } finally {
      act(() => {
        Dimensions.set({ window, screen });
      });
    }
  });

  it("shows no range delta for a one-point series, even with a change", async () => {
    // The backend computes `change` from a single point, so without the
    // drawable-series gate the header prints a signed delta above a canvas
    // reading "No price data for this period".
    mockFetchHistory.mockResolvedValue(
      makeHistory({ points: [densePoints[0]] }),
    );

    const { getByTestId, queryByTestId } = renderDetailView();

    await waitFor(() => {
      expect(getByTestId("price-history-empty")).toBeTruthy();
    });
    expect(queryByTestId("token-price-delta")).toBeNull();
  });

  it("falls back to the 24h percentage when the 1D fetch fails", async () => {
    mockFetchHistory.mockRejectedValue(new Error("backend 503"));

    const { getByTestId } = renderDetailView();

    await waitFor(() => {
      expect(getByTestId("price-history-error")).toBeTruthy();
    });
    expect(getByTestId("token-price-delta").props.children).toBe("+1.23%");
  });

  describe("with the chart disabled (the non-chart path)", () => {
    it("shows exactly today's 24h percentage when the kill switch is off", async () => {
      useRemoteConfigStore.setState({
        isInitialized: true,
        use_token_price_history: false,
      });

      const { getByTestId, queryByTestId } = renderDetailView();

      await act(async () => {
        await Promise.resolve();
      });

      expect(getByTestId("token-price-delta").props.children).toBe("+1.23%");
      // No reserved row, no skeleton: the header is byte-for-byte what it was
      // before the chart existed.
      expect(queryByTestId("token-price-delta-row")).toBeNull();
      expect(queryByTestId("token-price-delta-skeleton")).toBeNull();
      expect(mockFetchHistory).not.toHaveBeenCalled();
    });

    it("stays dark until the flag fetch settles — the switch fails closed", async () => {
      // The flag defaults to true and the screen renders before
      // `fetchFeatureFlags` resolves. Reading it bare would mount the block
      // and fire its requests during exactly the window an incident response
      // is trying to stop them (§11).
      useRemoteConfigStore.setState({
        isInitialized: false,
        use_token_price_history: true,
      });

      const { getByTestId, queryByTestId } = renderDetailView();

      await act(async () => {
        await Promise.resolve();
      });

      expect(getByTestId("token-price-delta").props.children).toBe("+1.23%");
      expect(queryByTestId("token-price-delta-row")).toBeNull();
      expect(mockFetchHistory).not.toHaveBeenCalled();
    });

    it("shows exactly today's 24h percentage off mainnet", async () => {
      const { getByTestId, queryByTestId } = renderDetailView(NETWORKS.TESTNET);

      await act(async () => {
        await Promise.resolve();
      });

      expect(getByTestId("token-price-delta").props.children).toBe("+1.23%");
      expect(queryByTestId("token-price-delta-row")).toBeNull();
      expect(mockFetchHistory).not.toHaveBeenCalled();
    });

    it("renders no delta at all when there is no 24h number, as today", async () => {
      useRemoteConfigStore.setState({
        isInitialized: true,
        use_token_price_history: false,
      });
      useBalancesStore.setState({
        pricedBalances: {
          native: {
            ...nativeBalance,
            percentagePriceChange24h: null,
          } as PricedBalance,
        },
      });

      const { queryByTestId } = renderDetailView();

      await act(async () => {
        await Promise.resolve();
      });

      expect(queryByTestId("token-price-delta")).toBeNull();
      expect(queryByTestId("token-price-delta-row")).toBeNull();
    });
  });

  describe("range switching", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("updates the header delta to the newly selected range's change", async () => {
      mockFetchHistory.mockImplementation(({ range }) =>
        Promise.resolve(
          range === "1Y"
            ? makeHistory({
                range: "1Y",
                change: { absolute: "-0.1234", percent: "-45.6" },
              })
            : makeHistory(),
        ),
      );

      const { getByTestId } = renderDetailView();

      await act(async () => {
        await Promise.resolve();
      });
      expect(getByTestId("token-price-delta").props.children).toBe(
        "+$0.0602 (32.12%)",
      );

      act(() => {
        fireEvent.press(getByTestId("timeframe-selector-1Y"));
      });
      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
      });

      expect(getByTestId("token-price-delta").props.children).toBe(
        "-$0.1234 (45.60%)",
      );
    });

    it("shows the placeholder — never the previous range's number — while an uncached range loads", async () => {
      // Resolve only the range the view opens on, leaving the deferred warm
      // pass hanging on its first request: 1W is then genuinely uncached, the
      // state a user hits while warming is still working down the queue.
      mockFetchHistory.mockImplementation(({ range }) =>
        range === "1D"
          ? Promise.resolve(makeHistory())
          : new Promise<TokenPriceHistory>(() => {}),
      );

      const { getByTestId, queryByTestId } = renderDetailView();

      await act(async () => {
        await Promise.resolve();
      });
      expect(getByTestId("token-price-delta")).toBeTruthy();

      act(() => {
        fireEvent.press(getByTestId("timeframe-selector-1W"));
      });

      // Still inside the debounce window: the request has not started, but the
      // 1D number must already be gone.
      expect(queryByTestId("token-price-delta")).toBeNull();
      // The pill is decorative, so it resolves only with hidden elements
      // included; the row it sits in is what announces the loading state.
      expect(
        getByTestId("token-price-delta-skeleton", {
          includeHiddenElements: true,
        }),
      ).toBeTruthy();
      const row = getByTestId("token-price-delta-row");
      expect(row.props.accessibilityState).toEqual({ busy: true });
      expect(row.props.accessibilityLabel).toBe("Loading price change");
    });

    it("shows no number when a non-1D range fails — a 24h figure is the wrong timeframe", async () => {
      mockFetchHistory.mockImplementation(({ range }) =>
        range === "1Y"
          ? Promise.reject(new Error("backend 503"))
          : Promise.resolve(makeHistory()),
      );

      const { getByTestId, queryByTestId } = renderDetailView();

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        fireEvent.press(getByTestId("timeframe-selector-1Y"));
      });
      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
      });

      expect(getByTestId("price-history-error")).toBeTruthy();
      expect(queryByTestId("token-price-delta")).toBeNull();
      expect(
        queryByTestId("token-price-delta-skeleton", {
          includeHiddenElements: true,
        }),
      ).toBeNull();
    });

    it("fetches once per range — the header never triggers its own request", async () => {
      const { getByTestId } = renderDetailView();

      await act(async () => {
        await Promise.resolve();
      });
      expect(callsForRange("1D")).toBe(1);

      act(() => {
        fireEvent.press(getByTestId("timeframe-selector-1W"));
      });
      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
      });

      // Exactly one request per range with both components mounted: 1W's came
      // from the background warm pass and the switch was a cache hit, so a
      // header that fetched for itself would show up as a second call.
      expect(callsForRange("1W")).toBe(1);
      expect(callsForRange("1D")).toBe(1);
    });
  });

  describe("direction colours (supersedes the doc's two-state §B.2 rule)", () => {
    // `useColorScheme` reports "light" under the react-native jest preset, so
    // the component resolves its palette through the light theme. The two
    // status colours are the same hex in both themes; only neutral differs.
    const themeColors = getThemeColors("light");
    const deltaColor = (node: ReactTestInstance) =>
      StyleSheet.flatten(node.props.style as StyleProp<TextStyle>)?.color;

    it("renders a negative range change in red, sign and all", async () => {
      mockFetchHistory.mockResolvedValue(
        makeHistory({ change: { absolute: "-0.0602", percent: "-12.12" } }),
      );

      const { getByTestId } = renderDetailView();

      await waitFor(() => {
        expect(getByTestId("token-price-delta")).toBeTruthy();
      });
      const delta = getByTestId("token-price-delta");
      // Colour never carries the meaning alone: the leading "-" stays (§7.4).
      expect(delta.props.children).toBe("-$0.0602 (12.12%)");
      expect(deltaColor(delta)).toBe(themeColors.status.error);
    });

    it("still renders a positive range change in green", async () => {
      const { getByTestId } = renderDetailView();

      await waitFor(() => {
        expect(getByTestId("token-price-delta")).toBeTruthy();
      });
      expect(deltaColor(getByTestId("token-price-delta"))).toBe(
        themeColors.status.success,
      );
    });

    it("renders a flat (zero percent) change neutral, never red", async () => {
      mockFetchHistory.mockResolvedValue(
        makeHistory({ change: { absolute: "0", percent: "0" } }),
      );

      const { getByTestId } = renderDetailView();

      await waitFor(() => {
        expect(getByTestId("token-price-delta")).toBeTruthy();
      });
      const delta = getByTestId("token-price-delta");
      // Genuinely flat: no sign at all, and no dollar term to sign either.
      expect(delta.props.children).toBe("0.00%");
      expect(deltaColor(delta)).toBe(themeColors.text.secondary);
      expect(deltaColor(delta)).not.toBe(themeColors.status.error);
    });

    it("signs and colours a real move the rounded percent hides", async () => {
      // USDC over 1D: the backend rounds `percent` to 2dp so the 1D value
      // equals `percentagePriceChange24h` exactly (D8), so a live absolute
      // arrives beside "0". The dollar term already carries the sign, so the
      // colour has to agree with it — an unsigned grey figure would say the
      // price moved without saying which way.
      mockFetchHistory.mockResolvedValue(
        makeHistory({
          change: { absolute: "0.000019827880302", percent: "0" },
        }),
      );

      const { getByTestId } = renderDetailView();

      await waitFor(() => {
        expect(getByTestId("token-price-delta")).toBeTruthy();
      });
      const delta = getByTestId("token-price-delta");
      const text = delta.props.children as string;
      expect(text.startsWith("+$")).toBe(true);
      // The percent in parentheses stays magnitude-only, rounded to nothing.
      expect(text.endsWith(" (0.00%)")).toBe(true);
      expect(deltaColor(delta)).toBe(themeColors.status.success);
    });

    it("renders the same hidden move downward in red", async () => {
      mockFetchHistory.mockResolvedValue(
        makeHistory({
          change: { absolute: "-0.000019827880302", percent: "0" },
        }),
      );

      const { getByTestId } = renderDetailView();

      await waitFor(() => {
        expect(getByTestId("token-price-delta")).toBeTruthy();
      });
      const delta = getByTestId("token-price-delta");
      const text = delta.props.children as string;
      expect(text.startsWith("-$")).toBe(true);
      expect(text.endsWith(" (0.00%)")).toBe(true);
      expect(deltaColor(delta)).toBe(themeColors.status.error);
    });

    it("colours the 1D fallback by direction too — it is the chart's delta", async () => {
      // The chart is enabled here; only the number's source differs, so the
      // price-history delta keeps its three-state colour.
      useBalancesStore.setState({
        pricedBalances: {
          native: {
            ...nativeBalance,
            percentagePriceChange24h: new BigNumber("-1.23"),
          } as PricedBalance,
        },
      });
      mockFetchHistory.mockRejectedValue(new Error("backend 503"));

      const { getByTestId } = renderDetailView();

      await waitFor(() => {
        expect(getByTestId("price-history-error")).toBeTruthy();
      });
      const delta = getByTestId("token-price-delta");
      expect(delta.props.children).toBe("-1.23%");
      expect(deltaColor(delta)).toBe(themeColors.status.error);
    });

    it("leaves the non-chart header path on today's two-state colours", async () => {
      // Out of scope by decision 5: reconciling the flag-off / non-mainnet
      // header with the rest of the app is the doc's §13 follow-up.
      useRemoteConfigStore.setState({
        isInitialized: true,
        use_token_price_history: false,
      });
      useBalancesStore.setState({
        pricedBalances: {
          native: {
            ...nativeBalance,
            percentagePriceChange24h: new BigNumber("-1.23"),
          } as PricedBalance,
        },
      });

      const { getByTestId } = renderDetailView();

      await act(async () => {
        await Promise.resolve();
      });

      const delta = getByTestId("token-price-delta");
      expect(delta.props.children).toBe("-1.23%");
      expect(deltaColor(delta)).toBe(themeColors.text.secondary);
    });
  });
});
