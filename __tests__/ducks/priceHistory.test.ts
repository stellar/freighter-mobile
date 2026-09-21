import { act } from "@testing-library/react-hooks";
import { renderHook } from "@testing-library/react-native";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { TokenPriceHistory, TokenStats } from "config/types";
import {
  usePriceHistoryStore,
  PRICE_HISTORY_CACHE_VALIDITY_MS,
  getPriceHistoryKey,
  resetInFlightRequests,
  useInspectedPriceHistory,
  useIsInspectingPriceHistory,
} from "ducks/priceHistory";
import { fetchTokenPriceHistory, fetchTokenStats } from "services/backend";

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
const mockFetchStats = fetchTokenStats as jest.MockedFunction<
  typeof fetchTokenStats
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

const makeStats = (overrides: Partial<TokenStats> = {}): TokenStats => ({
  token: "native",
  supplyOnStellar: "105443902087.3472865",
  holders: 9926520,
  ...overrides,
});

const resetStore = () => {
  usePriceHistoryStore.setState({
    historyByNetwork: {},
    statsByNetwork: {},
    historyStatusByKey: {},
    selectedRange: null,
  });
};

describe("priceHistory duck", () => {
  beforeEach(() => {
    resetInFlightRequests();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-26T12:00:00Z"));
    resetStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("fetchPriceHistory", () => {
    it("stores the response keyed network -> token -> range with an updatedAt stamp", async () => {
      mockFetchHistory.mockResolvedValueOnce(makeHistory());

      await act(async () => {
        await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range: "1D",
        });
      });

      const entry =
        usePriceHistoryStore.getState().historyByNetwork[NETWORKS.PUBLIC]
          ?.native?.["1D"];
      expect(entry?.data.points).toHaveLength(2);
      expect(entry?.updatedAt).toBe(Date.now());
    });

    it("serves an unexpired entry from cache without a second request", async () => {
      mockFetchHistory.mockResolvedValue(makeHistory());

      await act(async () => {
        await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range: "1D",
        });
      });

      // Just inside the validity window.
      jest.advanceTimersByTime(PRICE_HISTORY_CACHE_VALIDITY_MS - 1000);

      await act(async () => {
        await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range: "1D",
        });
      });

      expect(mockFetchHistory).toHaveBeenCalledTimes(1);
    });

    it("refetches once the flat 5-minute validity has elapsed", async () => {
      mockFetchHistory.mockResolvedValue(makeHistory());

      await act(async () => {
        await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range: "1D",
        });
      });

      jest.advanceTimersByTime(PRICE_HISTORY_CACHE_VALIDITY_MS + 1000);

      await act(async () => {
        await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range: "1D",
        });
      });

      expect(mockFetchHistory).toHaveBeenCalledTimes(2);
    });

    it("keys entries by network so testnet never reads mainnet data", async () => {
      mockFetchHistory.mockResolvedValueOnce(makeHistory());

      await act(async () => {
        await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range: "1D",
        });
      });

      const state = usePriceHistoryStore.getState();
      expect(
        state.historyByNetwork[NETWORKS.PUBLIC]?.native?.["1D"],
      ).toBeDefined();
      expect(state.historyByNetwork[NETWORKS.TESTNET]).toBeUndefined();
    });

    it("passes XLM through to the service (which owns the native wire translation)", async () => {
      mockFetchHistory.mockResolvedValueOnce(makeHistory({ token: "XLM" }));

      await act(async () => {
        await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "XLM",
          network: NETWORKS.PUBLIC,
          range: "1D",
        });
      });

      expect(mockFetchHistory).toHaveBeenCalledWith({
        tokenId: "XLM",
        network: NETWORKS.PUBLIC,
        range: "1D",
      });
    });

    it("keeps ranges independent: a late response for range A never clobbers range B", async () => {
      // Tap 1W then quickly 1M; the 1W response lands LAST. The store is
      // keyed per range and per-key statused, so 1M's entry and status are
      // untouched by 1W's late arrival.
      let resolve1W!: (value: TokenPriceHistory) => void;
      const pending1W = new Promise<TokenPriceHistory>((res) => {
        resolve1W = res;
      });
      mockFetchHistory.mockImplementationOnce(() => pending1W);

      const fetch1W = usePriceHistoryStore.getState().fetchPriceHistory({
        tokenId: "native",
        network: NETWORKS.PUBLIC,
        range: "1W",
      });

      mockFetchHistory.mockResolvedValueOnce(
        makeHistory({
          range: "1M",
          points: [
            { t: 1780000000, p: "0.10" },
            { t: 1780600000, p: "0.20" },
          ],
        }),
      );

      await act(async () => {
        await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range: "1M",
        });
      });

      // Now the superseded 1W response lands.
      await act(async () => {
        resolve1W(makeHistory({ range: "1W" }));
        await fetch1W;
      });

      const state = usePriceHistoryStore.getState();
      const key1M = getPriceHistoryKey(NETWORKS.PUBLIC, "native", "1M");
      expect(
        state.historyByNetwork[NETWORKS.PUBLIC]?.native?.["1M"]?.data.points[0]
          .p,
      ).toBe("0.10");
      expect(state.historyStatusByKey[key1M]).toEqual({
        isLoading: false,
        error: null,
      });
      // The 1W response is cached under its own range, not dropped on the floor.
      expect(
        state.historyByNetwork[NETWORKS.PUBLIC]?.native?.["1W"],
      ).toBeDefined();
    });

    it("discards a superseded response for the same key (stale-response guard)", async () => {
      // Two force-refresh fetches of the SAME key in flight; the first (stale)
      // resolves last and must not overwrite the newer response.
      let resolveFirst!: (value: TokenPriceHistory) => void;
      const firstPending = new Promise<TokenPriceHistory>((res) => {
        resolveFirst = res;
      });
      mockFetchHistory.mockImplementationOnce(() => firstPending);

      const firstFetch = usePriceHistoryStore.getState().fetchPriceHistory({
        tokenId: "native",
        network: NETWORKS.PUBLIC,
        range: "1D",
      });

      mockFetchHistory.mockResolvedValueOnce(
        makeHistory({
          points: [
            { t: 1786636800, p: "0.222222" },
            { t: 1786637700, p: "0.333333" },
          ],
        }),
      );

      await act(async () => {
        await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range: "1D",
          forceRefresh: true,
        });
      });

      await act(async () => {
        resolveFirst(
          makeHistory({
            points: [
              { t: 1786636800, p: "0.111111" },
              { t: 1786637700, p: "0.111112" },
            ],
          }),
        );
        await firstFetch;
      });

      const entry =
        usePriceHistoryStore.getState().historyByNetwork[NETWORKS.PUBLIC]
          ?.native?.["1D"];
      expect(entry?.data.points[0].p).toBe("0.222222");
    });

    it("reports fetch errors to Sentry via logger.error and sets the key's error", async () => {
      mockFetchHistory.mockRejectedValueOnce(new Error("backend 503"));

      await act(async () => {
        await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range: "1D",
        });
      });

      expect(logger.error).toHaveBeenCalled();
      const key = getPriceHistoryKey(NETWORKS.PUBLIC, "native", "1D");
      expect(usePriceHistoryStore.getState().historyStatusByKey[key]).toEqual({
        isLoading: false,
        error: "backend 503",
      });
    });

    it("does NOT report a no-data (empty points) response to Sentry", async () => {
      mockFetchHistory.mockResolvedValueOnce(
        makeHistory({ points: [], change: null }),
      );

      await act(async () => {
        await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range: "1D",
        });
      });

      expect(logger.error).not.toHaveBeenCalled();
      const entry =
        usePriceHistoryStore.getState().historyByNetwork[NETWORKS.PUBLIC]
          ?.native?.["1D"];
      expect(entry?.data.points).toEqual([]);
    });

    it("returns the fetched payload and null for a cache hit", async () => {
      mockFetchHistory.mockResolvedValue(makeHistory());

      let first: TokenPriceHistory | null = null;
      let second: TokenPriceHistory | null = null;

      await act(async () => {
        first = await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range: "1D",
        });
        second = await usePriceHistoryStore.getState().fetchPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range: "1D",
        });
      });

      expect(first).not.toBeNull();
      expect(second).toBeNull();
      expect(mockFetchHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe("warm / user overlap", () => {
    it("reports one Sentry event when a shared request fails, not one per caller", async () => {
      // `joinInFlight` hands one rejected request to every caller for the key.
      // Reporting before the staleness check turned one backend failure into
      // one event per caller, including callers about to be discarded.
      mockFetchStats.mockRejectedValue(new Error("backend 503"));
      const query = { tokenId: "native", network: NETWORKS.PUBLIC };

      await act(async () => {
        await Promise.all([
          usePriceHistoryStore.getState().fetchStats(query),
          usePriceHistoryStore.getState().fetchStats(query),
        ]);
      });

      expect(mockFetchStats).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it("joins a user fetch onto the warm request already in flight", async () => {
      // The warm path writes no status, so the user selecting a warming range
      // used to start a SECOND request. The sequence guard then discarded the
      // warm response — its cache write included — and if the user's own
      // request failed, the UI reported an error for data already fetched.
      let settle: (value: TokenPriceHistory) => void = () => {};
      mockFetchHistory.mockImplementation(
        () =>
          new Promise<TokenPriceHistory>((resolve) => {
            settle = resolve;
          }),
      );
      const history = makeHistory();
      const query = {
        tokenId: "native",
        network: NETWORKS.PUBLIC,
        range: "1W" as const,
      };

      let warm: Promise<unknown> = Promise.resolve();
      let user: Promise<unknown> = Promise.resolve();
      act(() => {
        warm = usePriceHistoryStore.getState().warmPriceHistory(query);
        user = usePriceHistoryStore.getState().fetchPriceHistory(query);
      });

      await act(async () => {
        settle(history);
        await Promise.all([warm, user]);
      });

      expect(mockFetchHistory).toHaveBeenCalledTimes(1);
      // The user's path still owns the side effects: cached, and no error.
      const key = getPriceHistoryKey(NETWORKS.PUBLIC, "native", "1W");
      expect(
        usePriceHistoryStore.getState().historyByNetwork[NETWORKS.PUBLIC]
          ?.native?.["1W"]?.data,
      ).toEqual(history);
      expect(
        usePriceHistoryStore.getState().historyStatusByKey[key]?.error,
      ).toBeFalsy();
    });
  });

  describe("warmPriceHistory", () => {
    const warm = (range: "1H" | "1W") =>
      act(async () => {
        await usePriceHistoryStore.getState().warmPriceHistory({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
          range,
        });
      });

    it("commits into the same cache slot the switch path reads", async () => {
      mockFetchHistory.mockResolvedValueOnce(makeHistory({ range: "1W" }));

      await warm("1W");

      const entry =
        usePriceHistoryStore.getState().historyByNetwork[NETWORKS.PUBLIC]
          ?.native?.["1W"];
      expect(entry?.data.points).toHaveLength(2);
      expect(entry?.updatedAt).toBe(Date.now());
    });

    it("writes no status key: a warm can never move the UI", async () => {
      mockFetchHistory.mockResolvedValueOnce(makeHistory({ range: "1W" }));

      await warm("1W");

      // Not even a settled { isLoading: false } entry — the loading state of a
      // range the user has not opened must stay exactly as it was.
      expect(usePriceHistoryStore.getState().historyStatusByKey).toEqual({});
    });

    it("fails silently: no Sentry report and no error state", async () => {
      mockFetchHistory.mockRejectedValueOnce(new Error("backend 503"));

      await warm("1W");

      expect(logger.error).not.toHaveBeenCalled();
      expect(usePriceHistoryStore.getState().historyStatusByKey).toEqual({});
      expect(
        usePriceHistoryStore.getState().historyByNetwork[NETWORKS.PUBLIC]
          ?.native?.["1W"],
      ).toBeUndefined();
    });

    it("skips a range still fresh in the session cache", async () => {
      mockFetchHistory.mockResolvedValue(makeHistory({ range: "1W" }));

      await warm("1W");
      expect(mockFetchHistory).toHaveBeenCalledTimes(1);

      await warm("1W");

      expect(mockFetchHistory).toHaveBeenCalledTimes(1);
    });

    it("skips a key whose user-driven fetch is already in flight", async () => {
      // The user always wins: warming shares the stale-response guard, so
      // starting one here would supersede the in-flight user request and
      // swallow the token_chart.loaded it is about to fire.
      let resolveUserFetch!: (value: TokenPriceHistory) => void;
      mockFetchHistory.mockImplementationOnce(
        () =>
          new Promise<TokenPriceHistory>((res) => {
            resolveUserFetch = res;
          }),
      );

      const userFetch = usePriceHistoryStore.getState().fetchPriceHistory({
        tokenId: "native",
        network: NETWORKS.PUBLIC,
        range: "1H",
      });

      await warm("1H");
      expect(mockFetchHistory).toHaveBeenCalledTimes(1);

      let fetched: TokenPriceHistory | null = null;
      await act(async () => {
        resolveUserFetch(makeHistory({ range: "1H" }));
        fetched = await userFetch;
      });

      // The user's fetch was never superseded, so it still resolves with the
      // payload its caller reports token_chart.loaded from.
      expect(fetched).not.toBeNull();
    });
  });

  describe("fetchStats", () => {
    it("caches stats keyed network -> token with the same flat validity", async () => {
      mockFetchStats.mockResolvedValue(makeStats());

      await act(async () => {
        await usePriceHistoryStore.getState().fetchStats({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
        });
        await usePriceHistoryStore.getState().fetchStats({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
        });
      });

      expect(mockFetchStats).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(PRICE_HISTORY_CACHE_VALIDITY_MS + 1000);

      await act(async () => {
        await usePriceHistoryStore.getState().fetchStats({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
        });
      });

      expect(mockFetchStats).toHaveBeenCalledTimes(2);
      expect(
        usePriceHistoryStore.getState().statsByNetwork[NETWORKS.PUBLIC]?.native
          ?.data.holders,
      ).toBe(9926520);
    });

    it("reports stats fetch errors to Sentry and records the error", async () => {
      mockFetchStats.mockRejectedValueOnce(new Error("boom"));

      await act(async () => {
        await usePriceHistoryStore.getState().fetchStats({
          tokenId: "native",
          network: NETWORKS.PUBLIC,
        });
      });

      expect(logger.error).toHaveBeenCalled();
      expect(
        usePriceHistoryStore.getState().statsByNetwork[NETWORKS.PUBLIC]?.native,
      ).toBeUndefined();
    });
  });
  describe("selected range", () => {
    const select = (network: NETWORKS, tokenId: string, range: "1D" | "1Y") =>
      act(() => {
        usePriceHistoryStore
          .getState()
          .setSelectedRange({ network, tokenId, range });
      });

    it("scopes the selection to its own (network, token)", () => {
      select(NETWORKS.PUBLIC, "native", "1Y");

      expect(usePriceHistoryStore.getState().selectedRange).toEqual({
        key: `${NETWORKS.PUBLIC}:native`,
        range: "1Y",
      });
    });

    it("clears its own selection", () => {
      select(NETWORKS.PUBLIC, "native", "1Y");

      act(() => {
        usePriceHistoryStore.getState().clearSelectedRange({
          network: NETWORKS.PUBLIC,
          tokenId: "native",
        });
      });

      expect(usePriceHistoryStore.getState().selectedRange).toBeNull();
    });

    it("never clears another token's selection", () => {
      // A detail view unmounting AFTER its successor mounted (the navigation
      // transition overlap) must not wipe the incoming screen's timeframe.
      select(NETWORKS.PUBLIC, "USDC:GA5Z", "1Y");

      act(() => {
        usePriceHistoryStore.getState().clearSelectedRange({
          network: NETWORKS.PUBLIC,
          tokenId: "native",
        });
      });

      expect(usePriceHistoryStore.getState().selectedRange).toEqual({
        key: `${NETWORKS.PUBLIC}:USDC:GA5Z`,
        range: "1Y",
      });
    });
  });
});

const network = NETWORKS.PUBLIC;
const tokenId = "native";
const points = [
  { t: 1786636800, p: "0.20" },
  { t: 1786637700, p: "0.22" },
  { t: 1786638600, p: "0.26" },
];

const seedEntry = () =>
  usePriceHistoryStore.setState({
    historyByNetwork: {
      [network]: {
        [tokenId]: {
          "1D": {
            data: {
              token: "native",
              range: "1D",
              resolutionSeconds: 900,
              currency: "USD",
              lowVolume: false,
              change: { absolute: "0.06", percent: "30.00" },
              points,
            },
            updatedAt: Date.now(),
          },
        },
      },
    },
  });

describe("inspected point", () => {
  beforeEach(() => {
    usePriceHistoryStore.setState({
      historyByNetwork: {},
      selectedRange: null,
      inspectedPoint: null,
    });
  });

  it("is null until a point is set", () => {
    const { result } = renderHook(() =>
      useInspectedPriceHistory(network, tokenId),
    );
    expect(result.current).toBeNull();
  });

  it("resolves the point and the first point off the cached series", () => {
    seedEntry();
    usePriceHistoryStore
      .getState()
      .setInspectedPoint({ network, tokenId, range: "1D", index: 2 });

    const { result } = renderHook(() =>
      useInspectedPriceHistory(network, tokenId),
    );
    expect(result.current).toEqual({
      range: "1D",
      index: 2,
      point: points[2],
      first: points[0],
    });
  });

  it("is scoped: another token reads null", () => {
    seedEntry();
    usePriceHistoryStore
      .getState()
      .setInspectedPoint({ network, tokenId, range: "1D", index: 1 });

    const { result } = renderHook(() =>
      useInspectedPriceHistory(network, "USDC:GABC"),
    );
    expect(result.current).toBeNull();
  });

  it("is null when the cached series is missing or the index is out of bounds", () => {
    usePriceHistoryStore
      .getState()
      .setInspectedPoint({ network, tokenId, range: "1D", index: 1 });
    expect(
      renderHook(() => useInspectedPriceHistory(network, tokenId)).result
        .current,
    ).toBeNull();

    seedEntry();
    usePriceHistoryStore
      .getState()
      .setInspectedPoint({ network, tokenId, range: "1D", index: 7 });
    expect(
      renderHook(() => useInspectedPriceHistory(network, tokenId)).result
        .current,
    ).toBeNull();
  });

  it("clears only its own scope", () => {
    seedEntry();
    const store = usePriceHistoryStore.getState();
    store.setInspectedPoint({ network, tokenId, range: "1D", index: 1 });
    store.clearInspectedPoint({ network, tokenId: "USDC:GABC" });
    expect(usePriceHistoryStore.getState().inspectedPoint).not.toBeNull();
    store.clearInspectedPoint({ network, tokenId });
    expect(usePriceHistoryStore.getState().inspectedPoint).toBeNull();
  });

  it("a range switch for the same scope drops the inspected point", () => {
    seedEntry();
    const store = usePriceHistoryStore.getState();
    store.setInspectedPoint({ network, tokenId, range: "1D", index: 1 });
    store.setSelectedRange({ network, tokenId, range: "1W" });
    expect(usePriceHistoryStore.getState().inspectedPoint).toBeNull();
  });

  it("useIsInspectingPriceHistory reports the scope's activity", () => {
    seedEntry();
    const { result } = renderHook(() =>
      useIsInspectingPriceHistory(network, tokenId),
    );
    expect(result.current).toBe(false);
    act(() =>
      usePriceHistoryStore
        .getState()
        .setInspectedPoint({ network, tokenId, range: "1D", index: 1 }),
    );
    expect(result.current).toBe(true);
  });
});
