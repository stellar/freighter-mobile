import {
  act,
  fireEvent,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import {
  priceChartHeight,
  priceChartLabelHeight,
  END_DOT_RADIUS,
  PRICE_CHART_LINE_HEIGHT,
  INSPECT_GESTURE_TEST_ID,
} from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceChart";
import TokenPriceHistorySection from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceHistorySection";
import { getThemeColors } from "config/colors";
import { DEFAULT_PADDING, NETWORKS } from "config/constants";
import { PRICE_HISTORY_RANGES, TokenPriceHistory } from "config/types";
import {
  usePriceHistoryStore,
  resetInFlightRequests,
} from "ducks/priceHistory";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { formatDate } from "helpers/date";
import { pxValue } from "helpers/dimensions";
import {
  CHART_MORPH_DURATION_MS,
  getPlottedRangeEnd,
  getPlottedRangeStart,
} from "helpers/priceHistoryChart";
import {
  findAllRenderedByType,
  RenderedTree,
  renderWithProviders,
} from "helpers/testUtils";
import React from "react";
import {
  DeviceEventEmitter,
  Dimensions,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { State, PanGesture } from "react-native-gesture-handler";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";
import { analytics } from "services/analytics";
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

const mockIsReduceMotionEnabled = jest.fn(() => false);
jest.mock(
  "hooks/useIsReduceMotionEnabled",
  () => () => mockIsReduceMotionEnabled(),
);

const mockFetchHistory = fetchTokenPriceHistory as jest.MockedFunction<
  typeof fetchTokenPriceHistory
>;
const mockTrackRangeChanged =
  analytics.trackTokenChartRangeChanged as jest.MockedFunction<
    typeof analytics.trackTokenChartRangeChanged
  >;

// A dense 1D series (enough points to clear the 33% sparse threshold of 97).
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

/**
 * Resolve only the range the view opens on, and leave the deferred warm pass
 * hanging on its first request. The ranges the switching tests tap are then
 * genuinely uncached — the state a user hits while warming is still working
 * its way down the queue. Without it the pass would have cached all six
 * before the first tap, and there would be no uncached switch left to assert
 * the skeleton against.
 */
const leaveOtherRangesUncached = (data: TokenPriceHistory = makeHistory()) =>
  mockFetchHistory.mockImplementation(({ range }) =>
    range === "1D"
      ? Promise.resolve(data)
      : new Promise<TokenPriceHistory>(() => {}),
  );

/**
 * The chart block's height moves with the OS text size, because the
 * axis-label rows are sized from the type they hold. Read it through the same
 * hook the components use — `Dimensions.get` agrees today only by accident,
 * and would silently yield `undefined` (falling back to a scale the component
 * never rendered at) if the jest setup's Dimensions stub ever took effect.
 */
const liveFontScale = () =>
  renderHook(() => useWindowDimensions()).result.current.fontScale;

const expectedChartHeight = () => priceChartHeight(liveFontScale());
const expectedLabelHeight = () => priceChartLabelHeight(liveFontScale());

const renderSection = (
  props: Partial<React.ComponentProps<typeof TokenPriceHistorySection>> = {},
) =>
  renderWithProviders(
    <TokenPriceHistorySection
      tokenId="native"
      network={NETWORKS.PUBLIC}
      {...props}
    />,
  );

describe("TokenPriceHistorySection", () => {
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
      inspectedPoint: null,
      inspectingKey: null,
    });
    mockFetchHistory.mockResolvedValue(makeHistory());
  });

  it("reports no viewed range when the kill switch flips off mid-flight", async () => {
    // The request was already out when the switch turned off. Its entry still
    // lands in the shared cache, so without the gate the effect reports a
    // range the section is no longer rendering — during exactly the incident
    // the switch exists to stop.
    let settle: (value: TokenPriceHistory) => void = () => {};
    mockFetchHistory.mockImplementation(
      () =>
        new Promise<TokenPriceHistory>((resolve) => {
          settle = resolve;
        }),
    );

    renderSection();
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      useRemoteConfigStore.setState({ use_token_price_history: false });
    });

    await act(async () => {
      settle(makeHistory());
      await Promise.resolve();
    });

    expect(analytics.trackTokenChartViewed).not.toHaveBeenCalled();
  });

  describe("leaving the loading hairline", () => {
    const strokePath = (tree: RenderedTree): string => {
      const stroke = findAllRenderedByType(tree, "skPath").find(
        (node) => node.props.style === "stroke",
      );
      const path = stroke!.props.path as string | { value: string };

      return typeof path === "string" ? path : path.value;
    };
    const isFlatAtCentre = (path: string) =>
      path
        .split(" ")
        .filter((token, i, all) => i > 0 && /^[ML]/.test(all[i - 1]))
        .every((y) => Number(y) === PRICE_CHART_LINE_HEIGHT / 2);

    const loadThenLand = async () => {
      let land: (value: TokenPriceHistory) => void = () => {};
      mockFetchHistory.mockImplementation(
        () =>
          new Promise<TokenPriceHistory>((resolve) => {
            land = resolve;
          }),
      );
      const utils = renderSection();
      await act(async () => {
        await Promise.resolve();
      });
      expect(utils.getByTestId("price-history-skeleton")).toBeTruthy();
      await act(async () => {
        land(makeHistory());
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(utils.getByTestId("price-history-chart")).toBeTruthy();

      return utils;
    };

    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      mockIsReduceMotionEnabled.mockReturnValue(false);
      jest.useRealTimers();
    });

    it("lifts the line out of the hairline once the fetch lands", async () => {
      const { toJSON } = await loadThenLand();

      expect(isFlatAtCentre(strokePath(toJSON() as RenderedTree))).toBe(true);
      await act(async () => {
        jest.advanceTimersByTime(CHART_MORPH_DURATION_MS);
        await Promise.resolve();
      });
      expect(isFlatAtCentre(strokePath(toJSON() as RenderedTree))).toBe(false);
    });

    it("paints the line directly under reduced motion", async () => {
      mockIsReduceMotionEnabled.mockReturnValue(true);
      const { toJSON } = await loadThenLand();

      expect(isFlatAtCentre(strokePath(toJSON() as RenderedTree))).toBe(false);
    });
  });

  it("renders the chart with an accessibility label once data lands", async () => {
    const { getByTestId, getByLabelText } = renderSection();

    await waitFor(() => {
      expect(getByTestId("price-history-chart")).toBeTruthy();
    });

    // "Price chart, {range}: {start} to {end}, {delta}" (§7.4)
    expect(getByLabelText(/Price chart, 1D:/)).toBeTruthy();
  });

  it("announces the time on 1D even when its ends are different dates", async () => {
    // A 1D span crosses midnight, so its two endpoints nearly always fall on
    // DIFFERENT calendar dates. A rule that adds the time only when the dates
    // match therefore drops it exactly here, and the label reads as a
    // two-day chart. This fixture starts at 16:00 and runs 24 hours, so the
    // dates genuinely differ — the default one does not and would pass
    // either way.
    const acrossMidnight = Array.from({ length: 97 }, (_, i) => ({
      t: 1786636800 + i * 900,
      p: (0.15 + i * 0.001).toFixed(6),
    }));
    mockFetchHistory.mockResolvedValue(makeHistory({ points: acrossMidnight }));

    const { getByTestId, getByLabelText } = renderSection();

    await waitFor(() => {
      expect(getByTestId("price-history-chart")).toBeTruthy();
    });

    const label = getByLabelText(/Price chart, 1D:/).props
      .accessibilityLabel as string;
    const [, span] = /1D: (.*) to .*, /.exec(label) ?? [];

    // Guards the premise: if the fixture stopped crossing midnight the
    // same-day rule would cover it and this would no longer test anything.
    // Derived rather than hard-coded — `formatDate` has no fixed timeZone, so
    // literal dates here would fail for anyone east of UTC+8.
    const dateOnly = (seconds: number) =>
      formatDate({ date: new Date(seconds * 1000).toISOString() });
    const first = acrossMidnight[0].t;
    const last = acrossMidnight[acrossMidnight.length - 1].t;

    expect(dateOnly(first)).not.toBe(dateOnly(last));
    expect(span).toMatch(/\d{1,2}:\d{2}/);
  });

  it("announces the time on a LONG range whose plotted ends share a day", async () => {
    // The other half of the rule, and the only thing the refactor added: a
    // sparse 1W or 1M — the case the sparse notice exists for — can plot both
    // endpoints inside one day. Date-only there reads "Sep 19 to Sep 19",
    // which describes no window at all. Deleting the same-day clause left
    // every other test in this file green.
    // Anchored to LOCAL noon, not a fixed UTC instant. A fixed instant gives
    // a window that straddles local midnight somewhere — 16:15–19:15 UTC does
    // it for offsets in (+4:45, +7:45], where the plotted ends land on two
    // dates and the same-day rule correctly does not fire. Deriving the
    // expected strings does not help with that; the fixture itself has to sit
    // inside one local day. Noon to 15:00 local is safe in every zone.
    const localNoon = Math.floor(
      new Date(2026, 7, 13, 12, 0, 0).getTime() / 1000,
    );
    const firstBucketStart = localNoon - 900;
    const sameDayWeek = [
      { t: firstBucketStart, p: "0.150000" },
      { t: firstBucketStart + 3 * 3600, p: "0.160000" },
    ];
    const plottedWeek = makeHistory({ range: "1W", points: sameDayWeek });
    mockFetchHistory.mockResolvedValue(plottedWeek);

    const { getByTestId, getByLabelText } = renderSection();
    await act(async () => {
      fireEvent.press(getByTestId("timeframe-selector-1W"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByTestId("price-history-chart")).toBeTruthy();
    });

    const label = getByLabelText(/Price chart, 1W:/).props
      .accessibilityLabel as string;
    const dateOnly = (seconds: number) =>
      formatDate({ date: new Date(seconds * 1000).toISOString() });

    // Premise: the PLOTTED ends — raw timestamps plus `resolutionSeconds`,
    // which is what production compares — really do land on one date, so the
    // intraday half of the rule is not what is doing the work here. Asserting
    // the raw timestamps instead would let a fixture edit near midnight keep
    // this green while the real comparison saw two different dates.
    const plotted = {
      points: sameDayWeek,
      resolutionSeconds: plottedWeek.resolutionSeconds,
      // Past the series, so nothing is clamped to "now".
      nowSeconds: sameDayWeek[sameDayWeek.length - 1].t + 86400,
    };

    expect(dateOnly(getPlottedRangeStart(plotted))).toBe(
      dateOnly(getPlottedRangeEnd(plotted)),
    );
    expect(/1W: (.*) to .*, /.exec(label)?.[1]).toMatch(/\d{1,2}:\d{2}/);
  });

  it("announces the time, not just the date, on an intraday range", async () => {
    // 1H's endpoints fall on the same calendar day, so a date-only label
    // reads "from 19 Sep to 19 Sep" and tells a screen-reader user nothing
    // about the period the chart covers.
    const { getByTestId, getByLabelText } = renderSection();

    await waitFor(() => {
      expect(getByTestId("price-history-chart")).toBeTruthy();
    });

    // `timeStyle: "short"` renders a clock time; the date-only form has none.
    expect(getByLabelText(/Price chart, 1D:.*\d{1,2}:\d{2}/)).toBeTruthy();
  });

  it("lays the loaded chart out at the same height as the skeleton it replaces", async () => {
    // The skeleton and the real chart both size from one function,
    // but only the skeleton was ever measured. A chart that stopped reading
    // the live text scale would lay out shorter than the placeholder it
    // replaces and jump the selector below it when the fetch resolves — with
    // every test still green.
    const { getByTestId } = renderSection();

    await waitFor(() => {
      expect(getByTestId("price-history-chart")).toBeTruthy();
    });

    const labelRows = [
      getByTestId("price-history-chart-label-row-high"),
      getByTestId("price-history-chart-label-row-low"),
    ];

    // One above the plot, one below, each sized from the live text scale.
    expect(labelRows).toHaveLength(2);
    labelRows.forEach((row) => {
      expect(StyleSheet.flatten(row.props.style).height).toBe(
        expectedLabelHeight(),
      );
    });
    // And those two rows plus the plot are the block the skeleton reserved.
    expect(expectedChartHeight()).toBe(
      PRICE_CHART_LINE_HEIGHT + expectedLabelHeight() * 2,
    );
  });

  it("leaves the end dot's radius free to the right of the plot, inside its own bounds", async () => {
    // The chart draws its canvas one dot radius wider than the plot so the
    // dot on the last point is not cut in half. This section is a SectionList
    // header, and an iOS ScrollView clips to its bounds, so that room has to
    // come out of the measured width rather than overflow it.
    const { getByTestId } = renderSection();

    await waitFor(() => {
      expect(getByTestId("price-history-chart")).toBeTruthy();
    });

    fireEvent(getByTestId("token-price-history-section"), "layout", {
      nativeEvent: { layout: { width: 320, height: 200, x: 0, y: 0 } },
    });

    expect(
      StyleSheet.flatten(getByTestId("price-history-chart").props.style).width,
    ).toBe(320 - END_DOT_RADIUS);
  });

  it("draws no delta of its own — the detail view has exactly one, in the header", async () => {
    const { getByTestId, queryByTestId, queryByText } = renderSection();

    await waitFor(() => {
      expect(getByTestId("price-history-chart")).toBeTruthy();
    });
    expect(queryByTestId("price-history-delta")).toBeNull();
    expect(queryByText("+$0.0602 (32.12%)")).toBeNull();
  });

  it("still describes the range's delta in the chart's accessibility label", async () => {
    const { getByLabelText } = renderSection();

    await waitFor(() => {
      expect(getByLabelText(/\+\$0\.0602 \(32\.12%\)$/)).toBeTruthy();
    });
  });

  it("says 'no change data' in the label when change is null with points present", async () => {
    mockFetchHistory.mockResolvedValue(makeHistory({ change: null }));

    const { getByTestId, getByLabelText } = renderSection();

    await waitFor(() => {
      expect(getByTestId("price-history-chart")).toBeTruthy();
    });
    expect(getByLabelText(/no change data$/)).toBeTruthy();
  });

  it("keeps the timeframe selector visible on a per-range empty result", async () => {
    mockFetchHistory.mockResolvedValue(
      makeHistory({ points: [], change: null }),
    );

    const { getByTestId, getByText } = renderSection();

    await waitFor(() => {
      expect(getByTestId("price-history-empty")).toBeTruthy();
    });
    expect(getByText("No price data for this period")).toBeTruthy();
    PRICE_HISTORY_RANGES.forEach((range) => {
      expect(getByTestId(`timeframe-selector-${range}`)).toBeTruthy();
    });
  });

  it("treats a single point as empty — one point cannot form a line", async () => {
    mockFetchHistory.mockResolvedValue(
      makeHistory({ points: [{ t: 1786636800, p: "0.1589" }], change: null }),
    );

    const { getByTestId, queryByTestId } = renderSection();

    await waitFor(() => {
      expect(getByTestId("price-history-empty")).toBeTruthy();
    });
    expect(queryByTestId("price-history-chart")).toBeNull();
  });

  describe("loading state (hairline shimmer)", () => {
    beforeEach(() => {
      mockFetchHistory.mockImplementation(() => new Promise(() => {}));
    });

    it("shows a skeleton at chart height while loading (no layout shift)", () => {
      const { getByTestId } = renderSection();

      const skeleton = getByTestId("price-history-skeleton");
      expect(StyleSheet.flatten(skeleton.props.style).height).toBe(
        expectedChartHeight(),
      );
    });

    it("draws a hairline shimmer across the measured width, centred in the block", () => {
      const { getByTestId } = renderSection();

      const line = getByTestId("price-history-chart-shimmer", {
        includeHiddenElements: true,
      });
      const style = StyleSheet.flatten(line.props.style);
      expect(style.height).toBe(1);
      // DEFAULT_CHART_WIDTH before layout: the window minus the page padding.
      expect(style.width).toBe(
        Dimensions.get("window").width - 2 * pxValue(DEFAULT_PADDING),
      );
      // Centred: the skeleton is a flex column that centres its child.
      expect(getByTestId("price-history-skeleton").props.className).toMatch(
        /justify-center/,
      );
    });

    it("hides the shimmer from assistive tech and reports busy on the container", () => {
      const { getByTestId, queryByTestId } = renderSection();

      const skeleton = getByTestId("price-history-skeleton");
      expect(skeleton.props.accessibilityState).toEqual({ busy: true });
      expect(skeleton.props.accessibilityLabel).toBe("Loading price chart");
      expect(queryByTestId("price-history-chart-shimmer")).toBeNull();
      expect(
        queryByTestId("price-history-chart-ghost", {
          includeHiddenElements: true,
        }),
      ).toBeNull();
    });

    it("keeps the timeframe selector present and enabled while loading", () => {
      const { getByTestId } = renderSection();

      PRICE_HISTORY_RANGES.forEach((range) => {
        const tab = getByTestId(`timeframe-selector-${range}`);
        expect(tab).toBeTruthy();
        expect(tab.props.accessibilityState?.disabled).toBeFalsy();
      });
    });

    it("renders no placeholder price text while loading", () => {
      const { queryAllByText } = renderSection();

      // A wallet must never draw invented prices — the design's blurred
      // axis labels are omitted rather than faked.
      expect(queryAllByText(/\$/)).toHaveLength(0);
      expect(queryAllByText(/\d/)).toHaveLength(
        // Only the timeframe tabs (1H/1D/1W/1M/1Y) carry digits.
        PRICE_HISTORY_RANGES.filter((range) => /\d/.test(range)).length,
      );
    });
  });

  it("renders the error placeholder with Retry on a failed fetch", async () => {
    mockFetchHistory.mockRejectedValue(new Error("backend 503"));

    const { getByTestId, getByText } = renderSection();

    await waitFor(() => {
      expect(getByTestId("price-history-error")).toBeTruthy();
    });
    expect(getByText("Unable to load price data")).toBeTruthy();
    expect(getByTestId("price-history-retry")).toBeTruthy();
  });

  it("renders nothing off mainnet (chart is mainnet-only)", () => {
    const { queryByTestId } = renderSection({ network: NETWORKS.TESTNET });

    expect(queryByTestId("token-price-history-section")).toBeNull();
    expect(mockFetchHistory).not.toHaveBeenCalled();
  });

  it("fetches nothing and emits nothing when the kill switch is off", async () => {
    // The flag is the incident-response kill switch (§11), so the section
    // must enforce it itself — not rely on a caller remembering to.
    useRemoteConfigStore.setState({
      isInitialized: true,
      use_token_price_history: false,
    });

    const { queryByTestId } = renderSection();

    await act(async () => {
      await Promise.resolve();
    });

    expect(queryByTestId("token-price-history-section")).toBeNull();
    expect(mockFetchHistory).not.toHaveBeenCalled();
    expect(analytics.trackTokenChartLoaded).not.toHaveBeenCalled();
    expect(mockTrackRangeChanged).not.toHaveBeenCalled();
  });

  describe("range switching", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("shows the skeleton — never the empty-state copy — the instant an uncached range is selected", async () => {
      leaveOtherRangesUncached();

      const { getByTestId, queryByTestId, queryByText } = renderSection();

      await act(async () => {
        await Promise.resolve();
      });
      expect(getByTestId("price-history-chart")).toBeTruthy();

      act(() => {
        fireEvent.press(getByTestId("timeframe-selector-1W"));
      });

      // Still inside the 250ms debounce: the request hasn't started, but the
      // user must see the skeleton, not "No price data for this period".
      expect(callsForRange("1W")).toBe(0);
      expect(getByTestId("price-history-skeleton")).toBeTruthy();
      expect(queryByTestId("price-history-empty")).toBeNull();
      expect(queryByText("No price data for this period")).toBeNull();
    });

    it("never holds the previous range's line under the new tab while it fetches", async () => {
      leaveOtherRangesUncached();

      const { getByTestId, queryByTestId } = renderSection();

      await act(async () => {
        await Promise.resolve();
      });
      expect(getByTestId("price-history-chart")).toBeTruthy();

      act(() => {
        fireEvent.press(getByTestId("timeframe-selector-1W"));
      });

      // The chart is UNMOUNTED, not left on screen morphing or otherwise:
      // one range's data must never be drawn under another range's tab. The
      // morph is therefore something you only see on a cache hit — which is
      // exactly the fast switching it exists to smooth.
      expect(queryByTestId("price-history-chart")).toBeNull();
      expect(getByTestId("price-history-skeleton")).toBeTruthy();
    });

    it("emits token_chart.range_changed once, for the settled range only", async () => {
      leaveOtherRangesUncached();

      const { getByTestId } = renderSection();

      await act(async () => {
        await Promise.resolve();
      });
      // The initial 1D load is not a range change.
      expect(mockTrackRangeChanged).not.toHaveBeenCalled();

      // Rapid cycling 1W -> 1M inside the debounce window: only 1M is
      // fetched and shown, so only 1M may be reported (the §7.5 contract
      // counts settles, so range_changed reconciles with token_chart.loaded).
      act(() => {
        fireEvent.press(getByTestId("timeframe-selector-1W"));
      });
      act(() => {
        jest.advanceTimersByTime(100);
        fireEvent.press(getByTestId("timeframe-selector-1M"));
      });

      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
      });

      expect(mockTrackRangeChanged).toHaveBeenCalledTimes(1);
      expect(mockTrackRangeChanged).toHaveBeenCalledWith("1M");
      expect(callsForRange("1W")).toBe(0);
      expect(callsForRange("1M")).toBe(1);
      expect(mockFetchHistory).toHaveBeenLastCalledWith({
        tokenId: "native",
        network: NETWORKS.PUBLIC,
        range: "1M",
      });
    });

    it("renders a cached range immediately, with no skeleton flash", async () => {
      const { getByTestId, queryByTestId } = renderSection();

      await act(async () => {
        await Promise.resolve();
      });

      // Populate 1W, then come back to the already-cached 1D.
      act(() => {
        fireEvent.press(getByTestId("timeframe-selector-1W"));
      });
      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
      });
      expect(getByTestId("price-history-chart")).toBeTruthy();

      act(() => {
        fireEvent.press(getByTestId("timeframe-selector-1D"));
      });

      expect(queryByTestId("price-history-skeleton")).toBeNull();
      expect(getByTestId("price-history-chart")).toBeTruthy();
    });
  });

  describe("drag to inspect", () => {
    // `fireGestureHandler` always normalizes its event list to a full
    // BEGAN→ACTIVE→END sequence (react-native-gesture-handler/jestUtils'
    // `fillMissingStatesTransitions` appends a terminal END to ANY list that
    // doesn't already end in one) — so a call can never leave the gesture
    // paused mid-drag across two separate `fireGestureHandler` calls the way
    // a real finger can. One call always runs start -> move(s) -> end. The
    // wiring itself (this section calling the duck's actions off the
    // gesture) is exercised end-to-end below with a spy on the action that
    // starts it; the "something ends an inspection early" tests instead put
    // the duck into a mid-inspect state directly (the same state a real
    // partial drag would leave it in) and drive the section around it.
    const putInMidInspect = () => {
      act(() => {
        usePriceHistoryStore.getState().setInspectedPoint({
          network: NETWORKS.PUBLIC,
          tokenId: "native",
          range: "1D",
          index: 1,
        });
      });
    };

    it("a drag sets the inspected point in the duck, fires brushed ONCE, and clears on end", async () => {
      // Spied BEFORE the render, not after: the section reads the action off
      // the store hook once per render and closes over that value, so a spy
      // installed after mount would never be the function it actually calls.
      const setInspectedPointSpy = jest.spyOn(
        usePriceHistoryStore.getState(),
        "setInspectedPoint",
      );

      const { getByTestId } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });

      act(() => {
        fireGestureHandler<PanGesture>(
          getByGestureTestId(INSPECT_GESTURE_TEST_ID),
          [
            { state: State.BEGAN, x: 10 },
            { state: State.ACTIVE, x: 10 },
            { x: 200 },
            { state: State.END },
          ],
        );
      });

      // Set at least once, off the 1D series actually plotted — the first
      // call is the activation (§7.5's "once per activation").
      expect(setInspectedPointSpy).toHaveBeenCalledWith({
        network: NETWORKS.PUBLIC,
        tokenId: "native",
        range: "1D",
        index: expect.any(Number),
      });
      expect(analytics.trackTokenChartBrushed).toHaveBeenCalledTimes(1);
      expect(analytics.trackTokenChartBrushed).toHaveBeenCalledWith("1D");

      // ...and the drag's own END clears it — no lingering point once the
      // finger lifts.
      expect(usePriceHistoryStore.getState().inspectedPoint).toBeNull();

      // Deliberately not `mockRestore()`d: the store is a module-level
      // singleton and `set()` merges forward whatever function reference is
      // CURRENTLY installed, including a spy — restoring the property on the
      // (by now stale) snapshot `spyOn` captured leaves the live state stuck
      // on a detached spy instead of undoing anything. The spy still calls
      // through to the real action, so later tests are unaffected.
      expect(setInspectedPointSpy).toHaveBeenCalled();
    });

    it("fires brushed exactly twice across two full gestures", async () => {
      const { getByTestId } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });

      act(() => {
        fireGestureHandler<PanGesture>(
          getByGestureTestId(INSPECT_GESTURE_TEST_ID),
          [
            { state: State.BEGAN, x: 10 },
            { state: State.ACTIVE, x: 10 },
            { x: 200 },
            { x: 220 },
            { x: 240 },
            { state: State.END },
          ],
        );
      });

      // Three moves in this one gesture must not add three more calls — only
      // the activation counts (§7.5).
      expect(analytics.trackTokenChartBrushed).toHaveBeenCalledTimes(1);

      act(() => {
        fireGestureHandler<PanGesture>(
          getByGestureTestId(INSPECT_GESTURE_TEST_ID),
          [
            { state: State.BEGAN, x: 50 },
            { state: State.ACTIVE, x: 50 },
            { x: 150 },
            { x: 170 },
            { x: 190 },
            { state: State.END },
          ],
        );
      });

      // Once per ACTIVATION, never per move — two separate gestures are two
      // activations, so exactly two calls (§7.5).
      expect(analytics.trackTokenChartBrushed).toHaveBeenCalledTimes(2);
    });

    it("does not inspect when no series is loaded — the chart itself does not render", () => {
      // `plottedRange` (off `data?.range`) is undefined with no series: the
      // real TokenPriceChart (and its gesture) never mounts without data —
      // only the skeleton does — so there is no gesture to drive. This is the
      // structural guarantee that `handleInspectStart`/`handleInspectMove`'s
      // `if (!plottedRange) return;` early-outs exist for defense-in-depth;
      // the gesture test id being entirely absent proves the primary guard.
      mockFetchHistory.mockImplementation(() => new Promise(() => {}));
      const setInspectedPointSpy = jest.spyOn(
        usePriceHistoryStore.getState(),
        "setInspectedPoint",
      );

      const { queryByTestId } = renderSection();

      expect(queryByTestId("price-history-chart")).toBeNull();
      // The gesture handler registry (a global keyed by testID, not the
      // rendered tree) has nothing under this id either: no `GestureDetector`
      // ever mounted to register it.
      expect(() => getByGestureTestId(INSPECT_GESTURE_TEST_ID)).toThrow();
      expect(setInspectedPointSpy).not.toHaveBeenCalled();
      expect(analytics.trackTokenChartBrushed).not.toHaveBeenCalled();
    });

    it("unmounting clears the scope's inspected point", async () => {
      const { getByTestId, unmount } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });

      putInMidInspect();
      expect(usePriceHistoryStore.getState().inspectedPoint).not.toBeNull();

      unmount();

      expect(usePriceHistoryStore.getState().inspectedPoint).toBeNull();
    });

    it("a range switch mid-inspect clears it (no index carries into another series)", async () => {
      jest.useFakeTimers();
      try {
        const { getByTestId } = renderSection();

        await act(async () => {
          await Promise.resolve();
        });
        expect(getByTestId("price-history-chart")).toBeTruthy();

        putInMidInspect();
        expect(usePriceHistoryStore.getState().inspectedPoint).not.toBeNull();

        act(() => {
          fireEvent.press(getByTestId("timeframe-selector-1W"));
        });

        // Cleared the instant the tab is pressed — `setSelectedRange` clears
        // a same-scope inspection synchronously, before the debounced fetch
        // even starts, so no index survives into the new series.
        expect(usePriceHistoryStore.getState().inspectedPoint).toBeNull();

        await act(async () => {
          jest.advanceTimersByTime(500);
          await Promise.resolve();
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it("a same-range refetch landing under the finger clears it, even with no range switch", async () => {
      // The range-switch test above is satisfied by the DUCK's own
      // `setSelectedRange`, which clears a same-scope inspection on its own —
      // it doesn't touch this section's `data?.points` cleanup dependency at
      // all. This covers the other branch: a revalidation (retry, or a
      // background refetch) that lands a NEW payload for the SAME range,
      // with no tab pressed and no `range` change anywhere. The index would
      // otherwise describe a point in the OLD series, not the one now drawn.
      const { getByTestId } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });

      putInMidInspect();
      expect(usePriceHistoryStore.getState().inspectedPoint).not.toBeNull();

      // Drives the duck's own fetch path directly (not a UI retry, which
      // requires an error state first) with `forceRefresh` to bypass the
      // flat cache-validity window, resolving a DIFFERENT points array for
      // the SAME "1D" range — a new object, a new array identity, same key.
      mockFetchHistory.mockResolvedValueOnce(
        makeHistory({ points: densePoints.slice(0, 35) }),
      );
      await act(async () => {
        await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range: "1D",
          forceRefresh: true,
        });
      });

      expect(usePriceHistoryStore.getState().inspectedPoint).toBeNull();
    });

    /**
     * Drives RNGH's own event pipeline directly — `fireGestureHandler`
     * cannot leave a gesture ACTIVE (it always appends a terminal END) — so
     * the gesture can be held open across the refetch below. Same pattern as
     * `TokenPriceChart.test.tsx`'s `emitStateChange`.
     */
    const emitStateChange = (
      handlerTag: number,
      event: { oldState: State; state: State },
    ) =>
      DeviceEventEmitter.emit("onGestureHandlerStateChange", {
        handlerTag,
        numberOfPointers: 1,
        x: 10,
        y: 0,
        absoluteX: 10,
        absoluteY: 0,
        translationX: 0,
        translationY: 0,
        velocityX: 0,
        velocityY: 0,
        ...event,
      });

    it("keeps the scroll lock through a same-range refetch landing mid-gesture, and drops it only on the gesture's own end", async () => {
      const { getByTestId } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });

      const { handlerTag } = getByGestureTestId(INSPECT_GESTURE_TEST_ID);
      act(() => {
        emitStateChange(handlerTag, {
          oldState: State.UNDETERMINED,
          state: State.BEGAN,
        });
        emitStateChange(handlerTag, {
          oldState: State.BEGAN,
          state: State.ACTIVE,
        });
      });
      expect(usePriceHistoryStore.getState().inspectingKey).not.toBeNull();

      // Same "landing under the finger" refetch as the test above — a new
      // payload for the SAME "1D" range, no tab pressed.
      mockFetchHistory.mockResolvedValueOnce(
        makeHistory({ points: densePoints.slice(0, 35) }),
      );
      await act(async () => {
        await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range: "1D",
          forceRefresh: true,
        });
      });

      // The point cleared (no stale index), but the gesture is still live,
      // so the lock must still be held.
      expect(usePriceHistoryStore.getState().inspectedPoint).toBeNull();
      expect(usePriceHistoryStore.getState().inspectingKey).not.toBeNull();

      act(() => {
        emitStateChange(handlerTag, {
          oldState: State.ACTIVE,
          state: State.END,
        });
      });

      expect(usePriceHistoryStore.getState().inspectingKey).toBeNull();
    });

    it("remounts the chart on a token/network switch so a live drag cannot carry the new scope's callbacks", async () => {
      const { getByTestId, rerender } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });

      const { handlerTag: oldHandlerTag } = getByGestureTestId(
        INSPECT_GESTURE_TEST_ID,
      );
      act(() => {
        emitStateChange(oldHandlerTag, {
          oldState: State.UNDETERMINED,
          state: State.BEGAN,
        });
        emitStateChange(oldHandlerTag, {
          oldState: State.BEGAN,
          state: State.ACTIVE,
        });
      });
      expect(usePriceHistoryStore.getState().inspectingKey).not.toBeNull();

      // Pre-seeds the new token's cache so the switch is a hit: no loading
      // skeleton, so the chart would otherwise stay mounted through the prop
      // change with nothing forcing the remount under test.
      act(() => {
        usePriceHistoryStore.setState((state) => ({
          historyByNetwork: {
            ...state.historyByNetwork,
            [NETWORKS.PUBLIC]: {
              ...state.historyByNetwork[NETWORKS.PUBLIC],
              "USDC:GABC": {
                "1D": { data: makeHistory(), updatedAt: Date.now() },
              },
            },
          },
        }));
      });

      // The screen swaps route params in place — same section instance, a
      // NEW (network, tokenId) scope — while the drag above is still live.
      act(() => {
        rerender(
          <TokenPriceHistorySection
            tokenId="USDC:GABC"
            network={NETWORKS.PUBLIC}
          />,
        );
      });

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });

      // The OLD scope's lock and point are both gone — the remounted
      // chart's own unmount cleanup ended the drag, not a ref swapped onto
      // the new scope mid-gesture.
      expect(usePriceHistoryStore.getState().inspectingKey).toBeNull();
      expect(usePriceHistoryStore.getState().inspectedPoint).toBeNull();

      // A genuinely new chart instance registered its own handler tag.
      const { handlerTag: newHandlerTag } = getByGestureTestId(
        INSPECT_GESTURE_TEST_ID,
      );
      expect(newHandlerTag).not.toBe(oldHandlerTag);

      // The crux: RNGH's native Pan is still tracking the SAME finger and
      // reports its next move on the OLD handler tag — never finalized, so
      // nothing else would end it. Without the remount that tag is still
      // registered and its ref-read callbacks now close over the NEW scope,
      // so this write would land on the token the drag never touched.
      act(() => {
        DeviceEventEmitter.emit("onGestureHandlerStateChange", {
          handlerTag: oldHandlerTag,
          numberOfPointers: 1,
          x: 250,
          y: 0,
          absoluteX: 250,
          absoluteY: 0,
          translationX: 0,
          translationY: 0,
          velocityX: 0,
          velocityY: 0,
        });
      });

      expect(usePriceHistoryStore.getState().inspectedPoint).toBeNull();
      expect(usePriceHistoryStore.getState().inspectingKey).toBeNull();
    });

    it("clears the inspected point when the kill switch flips off mid-drag", async () => {
      // Parity with the extension: the section keeps rendering null (it does
      // NOT unmount) once the flag flips, so only an explicit guard — not the
      // unmount cleanup — stops the header from describing a point off a
      // chart no longer on screen.
      const { getByTestId, queryByTestId } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });

      putInMidInspect();
      expect(usePriceHistoryStore.getState().inspectedPoint).not.toBeNull();

      act(() => {
        useRemoteConfigStore.setState({ use_token_price_history: false });
      });

      expect(queryByTestId("token-price-history-section")).toBeNull();
      expect(usePriceHistoryStore.getState().inspectedPoint).toBeNull();
    });
  });

  describe("notice banners (§4.4 precedence)", () => {
    it("shows the manipulation warning iff lowVolume is true", async () => {
      mockFetchHistory.mockResolvedValue(makeHistory({ lowVolume: true }));

      const { getByTestId, getByText } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-notice-lowVolume")).toBeTruthy();
      });
      // The visible copy, not just the node: the title/body split changed the
      // i18n keys, and a testID alone would pass on an empty banner.
      expect(getByText("Low trading volume")).toBeTruthy();
      expect(
        getByText(
          "This token has low trading volume, so price data may be less reliable.",
        ),
      ).toBeTruthy();
      // The chart still renders normally alongside the banner.
      expect(getByTestId("price-history-chart")).toBeTruthy();
    });

    it("places the notice under the timeframe selector", async () => {
      mockFetchHistory.mockResolvedValue(makeHistory({ lowVolume: true }));

      const { getByTestId, toJSON } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-notice-lowVolume")).toBeTruthy();
      });
      const tree = JSON.stringify(
        toJSON(),
        // Skia's vec()/rect() stash a live reference to the whole (circular)
        // CanvasKit module on every point/rect node now that global.CanvasKit
        // is wired up for all suites; drop it so this ordering check doesn't
        // choke serializing it.
        (key, value) => (key === "CanvasKit" ? undefined : value),
      );
      const chartAt = tree.indexOf('"testID":"price-history-chart"');
      const selectorAt = tree.indexOf('"testID":"timeframe-selector"');
      const noticeAt = tree.indexOf(
        '"testID":"price-history-notice-lowVolume"',
      );
      expect(chartAt).toBeGreaterThan(-1);
      expect(selectorAt).toBeGreaterThan(chartAt);
      expect(noticeAt).toBeGreaterThan(selectorAt);
    });

    it("shows no banner for a dense, above-threshold series", async () => {
      const { getByTestId, queryByTestId } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });
      expect(queryByTestId("price-history-notice-lowVolume")).toBeNull();
      expect(queryByTestId("price-history-notice-limitedData")).toBeNull();
      expect(
        queryByTestId("price-history-notice-verdictUnavailable"),
      ).toBeNull();
    });

    it("shows the limited-data caption for a sparse series", async () => {
      mockFetchHistory.mockResolvedValue(
        makeHistory({ points: densePoints.slice(0, 5) }),
      );

      const { getByTestId } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-notice-limitedData")).toBeTruthy();
      });
      expect(getByTestId("price-history-chart")).toBeTruthy();
    });

    it("low-volume copy wins when a series is both sparse and low-volume", async () => {
      mockFetchHistory.mockResolvedValue(
        makeHistory({ points: densePoints.slice(0, 5), lowVolume: true }),
      );

      const { getByTestId, queryByTestId } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-notice-lowVolume")).toBeTruthy();
      });
      expect(queryByTestId("price-history-notice-limitedData")).toBeNull();
    });

    it("shows the couldn't-verify copy on a null verdict — never the manipulation copy, never silence", async () => {
      mockFetchHistory.mockResolvedValue(makeHistory({ lowVolume: null }));

      const { getByTestId, queryByTestId } = renderSection();

      await waitFor(() => {
        expect(
          getByTestId("price-history-notice-verdictUnavailable"),
        ).toBeTruthy();
      });
      expect(queryByTestId("price-history-notice-lowVolume")).toBeNull();
      expect(getByTestId("price-history-chart")).toBeTruthy();
    });
  });
  describe("direction colours (the chart is red when the range is down)", () => {
    // `useColorScheme` reports "light" under the react-native jest preset, so
    // the components resolve their palette through the light theme. The two
    // status colours are the same hex in both themes; only neutral differs.
    const themeColors = getThemeColors("light");

    /** The polyline's stroke colour — Skia paths take no testID. */
    const lineColor = (tree: RenderedTree) =>
      findAllRenderedByType(tree, "skPath").find(
        (node) => node.props.style === "stroke",
      )?.props.color;

    it("draws the chart red when the range's change is negative", async () => {
      mockFetchHistory.mockResolvedValue(
        makeHistory({ change: { absolute: "-0.0602", percent: "-12.12" } }),
      );

      const { getByTestId, toJSON } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });
      expect(lineColor(toJSON())).toBe(themeColors.status.error);
    });

    it("keeps the chart green when the change is positive", async () => {
      const { getByTestId, toJSON } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });
      expect(lineColor(toJSON())).toBe(themeColors.status.success);
    });

    it("draws a flat (zero percent) range neutral, never red", async () => {
      mockFetchHistory.mockResolvedValue(
        makeHistory({ change: { absolute: "0", percent: "0" } }),
      );

      const { getByTestId, toJSON } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });
      expect(lineColor(toJSON())).toBe(themeColors.text.secondary);
    });

    it("takes the same direction as the delta when the percent rounds to zero", async () => {
      // D8 rounding hands the client `percent: "0"` beside a live absolute.
      // The header signs its dollar term from that absolute, so the artwork
      // must follow the same direction — a green number over a grey line is
      // exactly the incoherence this rule exists to prevent.
      mockFetchHistory.mockResolvedValue(
        makeHistory({
          change: { absolute: "0.000019827880302", percent: "0" },
        }),
      );

      const { getByTestId, toJSON } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });
      expect(lineColor(toJSON())).toBe(themeColors.status.success);
    });

    it("draws the hidden move red when its absolute is negative", async () => {
      mockFetchHistory.mockResolvedValue(
        makeHistory({
          change: { absolute: "-0.000019827880302", percent: "0" },
        }),
      );

      const { getByTestId, toJSON } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });
      expect(lineColor(toJSON())).toBe(themeColors.status.error);
    });

    it("draws neutral artwork when change is null with points present", async () => {
      // The §4.2 coverage guard: a series with no delta has no direction, so
      // the chart must not claim one.
      mockFetchHistory.mockResolvedValue(makeHistory({ change: null }));

      const { getByTestId, toJSON } = renderSection();

      await waitFor(() => {
        expect(getByTestId("price-history-chart")).toBeTruthy();
      });
      expect(lineColor(toJSON())).toBe(themeColors.text.secondary);
    });
  });
});
