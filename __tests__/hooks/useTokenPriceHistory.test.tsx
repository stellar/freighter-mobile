import { act, renderHook } from "@testing-library/react-hooks";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { TokenPriceHistory } from "config/types";
import {
  usePriceHistoryStore,
  resetInFlightRequests,
} from "ducks/priceHistory";
import useTokenPriceHistory, {
  PRICE_HISTORY_RANGE_DEBOUNCE_MS,
} from "hooks/useTokenPriceHistory";
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
 * Requests issued for ONE range. The hook warms the other five in the
 * background after the selected range settles, so a bare call count no longer
 * isolates the range under test.
 */
const callsForRange = (range: string): number =>
  mockFetchHistory.mock.calls.filter(([params]) => params.range === range)
    .length;

describe("useTokenPriceHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Module-scope registry: a never-settling mock from one test would
    // otherwise be joined by the next one.
    resetInFlightRequests();
    usePriceHistoryStore.setState({
      historyByNetwork: {},
      statsByNetwork: {},
      historyStatusByKey: {},
      selectedRange: null,
    });
    mockFetchHistory.mockResolvedValue(makeHistory());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fetches the default 1D range immediately on mount (mainnet)", async () => {
    const { result } = renderHook(() =>
      useTokenPriceHistory({ tokenId: "native", network: NETWORKS.PUBLIC }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    // First, and once: the selected range leads (the background warm pass
    // that follows it is covered separately).
    expect(mockFetchHistory.mock.calls[0][0]).toEqual({
      tokenId: "native",
      network: NETWORKS.PUBLIC,
      range: "1D",
    });
    expect(callsForRange("1D")).toBe(1);
    expect(result.current.range).toBe("1D");
    expect(result.current.data?.points).toHaveLength(2);
  });

  it("never fetches on non-mainnet networks and reports itself disabled", async () => {
    const { result } = renderHook(() =>
      useTokenPriceHistory({ tokenId: "native", network: NETWORKS.TESTNET }),
    );

    await act(async () => {
      jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS * 4);
      await Promise.resolve();
    });

    expect(mockFetchHistory).not.toHaveBeenCalled();
    expect(result.current.isEnabled).toBe(false);
  });

  it("never fetches when the caller disables it (feature flag off)", async () => {
    renderHook(() =>
      useTokenPriceHistory({
        tokenId: "native",
        network: NETWORKS.PUBLIC,
        enabled: false,
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS * 4);
      await Promise.resolve();
    });

    expect(mockFetchHistory).not.toHaveBeenCalled();
  });

  it("debounces range switches ~250ms and only fetches the settled range", async () => {
    // Hold the mount fetch in flight: the warm pass starts only once it
    // settles, so the ranges under test stay uncached and a switch to one is
    // a real request the debounce can be observed on.
    mockFetchHistory.mockImplementationOnce(
      () => new Promise<TokenPriceHistory>(() => {}),
    );

    const { result } = renderHook(() =>
      useTokenPriceHistory({ tokenId: "native", network: NETWORKS.PUBLIC }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockFetchHistory).toHaveBeenCalledTimes(1);

    // Rapid tab cycling: 1W then 1M inside the debounce window.
    act(() => {
      result.current.setRange("1W");
    });
    act(() => {
      jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS / 2);
      result.current.setRange("1M");
    });

    await act(async () => {
      jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS + 10);
      await Promise.resolve();
    });

    // Only the settled range (1M) was fetched — 1W never left the debounce.
    expect(mockFetchHistory).toHaveBeenCalledTimes(2);
    expect(mockFetchHistory).toHaveBeenLastCalledWith({
      tokenId: "native",
      network: NETWORKS.PUBLIC,
      range: "1M",
    });
    expect(result.current.range).toBe("1M");
  });

  it("drops a pending range switch when the token changes under it", async () => {
    // `useDebounce` memoises its timer on the delay alone and cancels only on
    // unmount, so a switch armed on token A survives a scope change and fires
    // with the NEW closure and the OLD range — fetching a range the user
    // never chose for token B, and reporting range_changed for it.
    mockFetchHistory.mockImplementation(
      () => new Promise<TokenPriceHistory>(() => {}),
    );
    const TOKEN_B =
      "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
    const onRangeSettled = jest.fn();

    const { result, rerender } = renderHook(
      ({ tokenId }: { tokenId: string }) =>
        useTokenPriceHistory({
          tokenId,
          network: NETWORKS.PUBLIC,
          onRangeSettled,
        }),
      { initialProps: { tokenId: "native" } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    mockFetchHistory.mockClear();
    onRangeSettled.mockClear();

    // Arm a switch to 1Y on token A, then move to token B before it settles.
    act(() => {
      result.current.setRange("1Y");
    });
    act(() => {
      jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS / 2);
    });
    rerender({ tokenId: TOKEN_B });

    await act(async () => {
      jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS * 2);
      await Promise.resolve();
    });

    // Nothing token A's timer armed may reach token B.
    expect(
      mockFetchHistory.mock.calls.filter(
        ([args]) => args.tokenId === TOKEN_B && args.range === "1Y",
      ),
    ).toHaveLength(0);
    expect(onRangeSettled).not.toHaveBeenCalledWith("1Y");
  });

  it("shows range B when A's response lands last (the §7.0 race)", async () => {
    let resolve1W!: (value: TokenPriceHistory) => void;
    const pending1W = new Promise<TokenPriceHistory>((res) => {
      resolve1W = res;
    });

    mockFetchHistory.mockImplementation(({ range }) => {
      if (range === "1W") return pending1W;
      return Promise.resolve(
        makeHistory({
          range,
          points: [
            { t: 1780000000, p: "0.777" },
            { t: 1780600000, p: "0.888" },
          ],
        }),
      );
    });

    const { result } = renderHook(() =>
      useTokenPriceHistory({ tokenId: "native", network: NETWORKS.PUBLIC }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Tap 1W, let its (hanging) request start, then tap 1M.
    act(() => {
      result.current.setRange("1W");
    });
    await act(async () => {
      jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS + 10);
      await Promise.resolve();
    });
    act(() => {
      result.current.setRange("1M");
    });
    await act(async () => {
      jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS + 10);
      await Promise.resolve();
    });

    // 1M rendered; now the stale 1W response finally lands.
    await act(async () => {
      resolve1W(makeHistory({ range: "1W", points: [] }));
      await Promise.resolve();
    });

    expect(result.current.range).toBe("1M");
    expect(result.current.data?.range).toBe("1M");
    expect(result.current.data?.points[0].p).toBe("0.777");
  });

  it("retry forces a refetch bypassing the session cache", async () => {
    const { result } = renderHook(() =>
      useTokenPriceHistory({ tokenId: "native", network: NETWORKS.PUBLIC }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(callsForRange("1D")).toBe(1);

    await act(async () => {
      result.current.retry();
      await Promise.resolve();
    });

    // A second service call within the 5-minute validity proves the retry
    // bypassed the session cache (a plain fetch would have been a cache hit).
    expect(callsForRange("1D")).toBe(2);
    expect(mockFetchHistory).toHaveBeenLastCalledWith({
      tokenId: "native",
      network: NETWORKS.PUBLIC,
      range: "1D",
    });
  });

  it("exposes the per-key error state after a failed fetch", async () => {
    mockFetchHistory.mockRejectedValueOnce(new Error("backend 503"));

    const { result } = renderHook(() =>
      useTokenPriceHistory({ tokenId: "native", network: NETWORKS.PUBLIC }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe("backend 503");
    expect(result.current.data).toBeUndefined();
  });

  describe("deferred background warming", () => {
    /** Ranges requested so far, in call order. */
    const requestedRanges = (): string[] =>
      mockFetchHistory.mock.calls.map(([params]) => params.range);

    /** Ranges requested so far for one token. */
    const requestedRangesFor = (tokenId: string): string[] =>
      mockFetchHistory.mock.calls
        .filter(([params]) => params.tokenId === tokenId)
        .map(([params]) => params.range);

    type Settler = {
      resolve: (data?: TokenPriceHistory) => void;
      reject: (error: Error) => void;
    };

    /** Every request that has not been settled yet, oldest first per range. */
    let pending: Map<string, Settler[]>;

    beforeEach(() => {
      pending = new Map();
      mockFetchHistory.mockImplementation(
        ({ range }) =>
          new Promise<TokenPriceHistory>((res, rej) => {
            const queue = pending.get(range) ?? [];
            queue.push({
              resolve: (data) => res(data ?? makeHistory({ range })),
              reject: rej,
            });
            pending.set(range, queue);
          }),
      );
    });

    /** Drain the microtask queue so the warm chain can take its next step. */
    const flush = async () => {
      await act(async () => {
        /* eslint-disable no-await-in-loop */
        for (let i = 0; i < 20; i += 1) {
          await Promise.resolve();
        }
        /* eslint-enable no-await-in-loop */
      });
    };

    /** Settle the oldest in-flight request for `range`, then let it propagate. */
    const settle = async (range: string, data?: TokenPriceHistory) => {
      const settler = pending.get(range)?.shift();
      if (!settler) throw new Error(`no in-flight request for ${range}`);
      settler.resolve(data);
      await flush();
    };

    const fail = async (range: string) => {
      const settler = pending.get(range)?.shift();
      if (!settler) throw new Error(`no in-flight request for ${range}`);
      settler.reject(new Error("backend 503"));
      await flush();
    };

    const renderChart = (
      overrides: Partial<Parameters<typeof useTokenPriceHistory>[0]> = {},
    ) =>
      renderHook(
        (props: Partial<Parameters<typeof useTokenPriceHistory>[0]>) =>
          useTokenPriceHistory({
            tokenId: "native",
            network: NETWORKS.PUBLIC,
            ...overrides,
            ...props,
          }),
        { initialProps: {} },
      );

    it("issues no warm request until the selected range's fetch resolves", async () => {
      renderChart();

      await flush();
      jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS * 4);
      await flush();

      // First paint must not get slower: 1D is alone in flight.
      expect(requestedRanges()).toEqual(["1D"]);

      await settle("1D");

      expect(requestedRanges()).toEqual(["1D", "1H"]);
    });

    it("does not warm when the selected range's own load failed", async () => {
      // One outage must stay one request. With a 15s client timeout, warming
      // the other five after a failed load is up to 75s of further timeouts
      // for a chart the user already saw fail.
      renderChart();
      await flush();

      await fail("1D");
      jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS * 4);
      await flush();

      expect(requestedRanges()).toEqual(["1D"]);
    });

    it("warms the remaining five one at a time, in selector order", async () => {
      renderChart();
      await flush();
      await settle("1D");

      // One at a time: after 1D only 1H is in flight, never all five.
      expect(requestedRanges()).toEqual(["1D", "1H"]);

      await settle("1H");
      expect(requestedRanges()).toEqual(["1D", "1H", "1W"]);

      await settle("1W");
      await settle("1M");
      await settle("1Y");
      expect(requestedRanges()).toEqual(["1D", "1H", "1W", "1M", "1Y", "ALL"]);

      await settle("ALL");

      // Exactly one pass: six ranges, six requests, nothing periodic.
      jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS * 20);
      await flush();
      expect(mockFetchHistory).toHaveBeenCalledTimes(6);
    });

    it("stops the queue when the component unmounts mid-warm", async () => {
      const { unmount } = renderChart();
      await flush();
      await settle("1D");
      expect(mockFetchHistory).toHaveBeenCalledTimes(2);

      unmount();
      await settle("1H");

      // The in-flight 1H settled but 1W was never started.
      expect(mockFetchHistory).toHaveBeenCalledTimes(2);
    });

    it("stops the queue when the token changes mid-warm", async () => {
      const { rerender } = renderChart();
      await flush();
      await settle("1D");
      expect(requestedRangesFor("native")).toEqual(["1D", "1H"]);

      rerender({ tokenId: "USDC:GA5Z" });
      await flush();

      await settle("1H");

      // The outgoing token's queue is dead; the incoming token fetched its own
      // selected range and nothing else yet.
      expect(requestedRangesFor("native")).toEqual(["1D", "1H"]);
      expect(requestedRangesFor("USDC:GA5Z")).toEqual(["1D"]);
    });

    it("skips ranges already valid in the session cache", async () => {
      const cached = (range: "1H" | "1W") => ({
        data: makeHistory({ range }),
        updatedAt: Date.now(),
      });
      usePriceHistoryStore.setState({
        historyByNetwork: {
          [NETWORKS.PUBLIC]: {
            native: { "1H": cached("1H"), "1W": cached("1W") },
          },
        },
      });

      renderChart();
      await flush();
      await settle("1D");

      expect(requestedRanges()).toEqual(["1D", "1M"]);
    });

    it("emits no loaded and no range_changed for warmed ranges", async () => {
      const onLoaded = jest.fn();
      const onRangeSettled = jest.fn();

      renderChart({ onLoaded, onRangeSettled });
      await flush();
      await settle("1D");

      // The one user-visible load.
      expect(onLoaded).toHaveBeenCalledTimes(1);

      await settle("1H");
      await settle("1W");
      await settle("1M");
      await settle("1Y");
      await settle("ALL");

      // A full warm pass added nothing: six token_chart.loaded events per
      // screen-open would destroy the empty-state rate.
      expect(onLoaded).toHaveBeenCalledTimes(1);
      expect(onRangeSettled).not.toHaveBeenCalled();
    });

    it("leaves the displayed range, series and loading state untouched", async () => {
      const { result } = renderChart();
      await flush();
      await settle("1D", makeHistory({ range: "1D" }));

      await settle("1H", makeHistory({ range: "1H", points: [] }));
      await settle("1W");
      await settle("1M");
      await settle("1Y");
      await settle("ALL");

      expect(result.current.range).toBe("1D");
      expect(result.current.data?.range).toBe("1D");
      expect(result.current.data?.points).toHaveLength(2);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("makes a switch to a warmed range a cache hit that renders at once", async () => {
      const { result } = renderChart();
      await flush();
      await settle("1D");
      await settle("1H");
      await settle("1W", makeHistory({ range: "1W" }));

      const callsBeforeSwitch = mockFetchHistory.mock.calls.length;

      act(() => {
        result.current.setRange("1W");
      });

      // Instant: the warmed series is on screen before the debounce even runs.
      expect(result.current.range).toBe("1W");
      expect(result.current.data?.range).toBe("1W");
      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS + 10);
        await Promise.resolve();
      });

      // ...and the debounced fetch was a cache hit, not a request.
      expect(mockFetchHistory).toHaveBeenCalledTimes(callsBeforeSwitch);
      expect(result.current.data?.range).toBe("1W");
    });

    it("keeps a warm failure silent, then reports it on a real user switch", async () => {
      const { result } = renderChart();
      await flush();
      await settle("1D");

      await fail("1H");

      // No error UI, no Sentry report — the user never asked for 1H.
      expect(result.current.error).toBeNull();
      expect(logger.error).not.toHaveBeenCalled();
      // ...and the queue carried on to the next range.
      expect(requestedRanges()).toEqual(["1D", "1H", "1W"]);

      act(() => {
        result.current.setRange("1H");
      });
      await act(async () => {
        jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS + 10);
        await Promise.resolve();
      });
      await fail("1H");

      expect(result.current.error).toBe("backend 503");
      expect(logger.error).toHaveBeenCalled();
    });

    it("never warms where the chart is hidden (off-mainnet or flag off)", async () => {
      const offMainnet = renderChart({ network: NETWORKS.TESTNET });
      await flush();
      jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS * 4);
      await flush();
      expect(mockFetchHistory).not.toHaveBeenCalled();
      offMainnet.unmount();

      renderChart({ enabled: false });
      await flush();
      jest.advanceTimersByTime(PRICE_HISTORY_RANGE_DEBOUNCE_MS * 4);
      await flush();
      expect(mockFetchHistory).not.toHaveBeenCalled();
    });
  });
});
