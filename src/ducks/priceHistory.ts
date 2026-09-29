import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import {
  PriceHistoryPoint,
  PriceHistoryRange,
  TokenIdentifier,
  TokenPriceHistory,
  TokenStats,
} from "config/types";
import { hasChartData } from "helpers/priceHistoryChart";
import { useMemo } from "react";
import { fetchTokenPriceHistory, fetchTokenStats } from "services/backend";
import { create } from "zustand";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

/**
 * Flat validity for every range: one constant, no per-range table, no
 * coupling to server TTLs.
 */
export const PRICE_HISTORY_CACHE_VALIDITY_MS = 5 * 60 * 1000;

/** The timeframe a token detail view opens on. */
export const DEFAULT_PRICE_HISTORY_RANGE: PriceHistoryRange = "1D";

/** A cached price-history series, stamped for the flat validity check. */
export interface PriceHistoryEntry {
  data: TokenPriceHistory;
  updatedAt: number;
}

/** A cached token-stats payload, stamped for the flat validity check. */
export interface TokenStatsEntry {
  data: TokenStats;
  updatedAt: number;
}

/** Per-request-key loading/error status. */
export interface PriceHistoryKeyStatus {
  isLoading: boolean;
  error: string | null;
}

/**
 * The point under the user's finger (Phase 3 drag-to-inspect), keyed to the
 * scope AND the range it was chosen on: the header reads it, the chart
 * draws it, and a range switch must not carry an index into another series.
 */
export interface InspectedPoint {
  key: string;
  range: PriceHistoryRange;
  index: number;
}

/**
 * Stable idle status so selectors return a referentially-stable value for
 * keys that have never fetched (avoids a fresh object re-render each call).
 */
export const IDLE_PRICE_HISTORY_STATUS: PriceHistoryKeyStatus = Object.freeze({
  isLoading: false,
  error: null,
});

/** Status key for one (network, token, range) history request. */
export const getPriceHistoryKey = (
  network: NETWORKS,
  tokenId: TokenIdentifier,
  range: PriceHistoryRange,
): string => `${network}:${tokenId}:${range}`;

/**
 * Key for one (network, token). Not a status key: the stats section hides
 * itself when the entry is missing, so its state has no UI to drive.
 */
const getTokenScopeKey = (
  network: NETWORKS,
  tokenId: TokenIdentifier,
): string => `${network}:${tokenId}`;

/**
 * Here rather than in component state because TWO components read it — the
 * chart's selector and the header's delta — and must never disagree. Scoped
 * by key, so another token reads the default with no reset effect to sequence.
 */
interface SelectedRange {
  /** {@link getTokenScopeKey} of the token the selection belongs to */
  key: string;
  range: PriceHistoryRange;
}

interface TokenScopeParams {
  network: NETWORKS;
  tokenId: TokenIdentifier;
}

interface SequenceGuard {
  /** Starts a request for `key` and returns its sequence number. */
  start: (key: string) => number;
  /** True while `sequence` is still the newest request started for `key`. */
  isCurrent: (key: string, sequence: number) => boolean;
}

/**
 * Per-key fetch sequence (the idea is `ducks/prices.ts`'s). A response is
 * superseded when a newer fetch for the SAME key started while it was in
 * flight; cross-range races are structural, since each range has its own slot.
 * The counters live in a closure so bumping one cannot re-render.
 */
const createSequenceGuard = (): SequenceGuard => {
  const sequences: Record<string, number> = {};

  return {
    start: (key) => {
      sequences[key] = (sequences[key] ?? 0) + 1;
      return sequences[key];
    },
    isCurrent: (key, sequence) => sequences[key] === sequence,
  };
};

/**
 * In-flight requests, keyed like the cache. The warm path writes no status, so
 * without this a user selecting a warming range starts a SECOND request: the
 * guard then discards the warm response INCLUDING its cache write, and if the
 * user's own request fails the UI reports an error for data we already had.
 */
const inFlightByKey = new Map<string, Promise<unknown>>();

const joinInFlight = <T>(
  key: string,
  start: () => Promise<T>,
  // An explicit retry means "ask again", so it never adopts a request that
  // may already have failed — but it does become the one later callers join.
  forceRefresh = false,
): Promise<T> => {
  if (!forceRefresh) {
    const pending = inFlightByKey.get(key) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }
  }

  const request = start().finally(() => {
    if (inFlightByKey.get(key) === request) {
      inFlightByKey.delete(key);
    }
  });
  inFlightByKey.set(key, request);

  return request;
};

/** Test-only: the registry outlives a single store, but not the app. */
export const resetInFlightRequests = () => inFlightByKey.clear();

const historyFetchGuard = createSequenceGuard();
const statsFetchGuard = createSequenceGuard();

interface FetchPriceHistoryParams {
  tokenId: TokenIdentifier;
  network: NETWORKS;
  range: PriceHistoryRange;
  /** Bypass the 5-minute validity (e.g. explicit retry). */
  forceRefresh?: boolean;
}

interface WarmPriceHistoryParams {
  tokenId: TokenIdentifier;
  network: NETWORKS;
  range: PriceHistoryRange;
}

interface FetchStatsParams {
  tokenId: TokenIdentifier;
  network: NETWORKS;
}

interface PriceHistoryState {
  /**
   * network -> token -> range. In-memory only, deliberately not persisted: a
   * chart from before the app closed is what a cold start must not show.
   */
  historyByNetwork: Record<
    string,
    Record<string, Partial<Record<PriceHistoryRange, PriceHistoryEntry>>>
  >;
  /** Token-stats session cache keyed network -> token. In-memory only. */
  statsByNetwork: Record<string, Record<string, TokenStatsEntry>>;
  /** Per (network:token:range) request status. */
  historyStatusByKey: Record<string, PriceHistoryKeyStatus>;
  /** The selected timeframe and the token it was selected for, if any. */
  selectedRange: SelectedRange | null;
  /** Select a timeframe for one (network, token). */
  setSelectedRange: (
    params: TokenScopeParams & { range: PriceHistoryRange },
  ) => void;
  /**
   * Drop one (network, token)'s selection, so the next visit opens on the
   * default. Scoped by key: the outgoing screen unmounts AFTER the incoming
   * one mounts, and must not wipe its selection.
   */
  clearSelectedRange: (params: TokenScopeParams) => void;
  /** The inspected point, if a drag is in progress. Never persisted. */
  inspectedPoint: InspectedPoint | null;
  setInspectedPoint: (
    params: TokenScopeParams & { range: PriceHistoryRange; index: number },
  ) => void;
  /** Scoped like {@link clearSelectedRange}, for the same unmount-order reason. */
  clearInspectedPoint: (params: TokenScopeParams) => void;
  /**
   * Scope key of a live drag-to-inspect gesture. Separate from
   * `inspectedPoint`: the scroll lock must follow the GESTURE (start → end),
   * not whether an index has resolved against the current series.
   */
  inspectingKey: string | null;
  /** Marks the scope's gesture as started. */
  startInspectGesture: (params: TokenScopeParams) => void;
  /** Scoped and idempotent, like {@link clearInspectedPoint}. */
  endInspectGesture: (params: TokenScopeParams) => void;
  /**
   * Atomic sibling of `endInspectGesture` + `clearInspectedPoint`: one `set`,
   * so no subscriber can observe the gesture ended while the point lingers
   * (or the reverse).
   */
  endInspection: (params: TokenScopeParams) => void;
  /**
   * Resolves with the payload only when a network fetch completed — callers
   * fire `token_chart.loaded` off that — and null on cache hits, superseded
   * responses and errors.
   */
  fetchPriceHistory: (
    params: FetchPriceHistoryParams,
  ) => Promise<TokenPriceHistory | null>;
  /**
   * Prefetch ONE unopened range into the slot {@link fetchPriceHistory} reads.
   *
   * Resolves with NOTHING on purpose: `fetchPriceHistory` returns its payload
   * so callers can fire `token_chart.loaded`, and one open warms five ranges —
   * six `loaded` events per open would wreck the metrics. `void` makes that
   * structural rather than a convention an edit can break.
   *
   * It writes no status and reports no failures either: a warm can never move
   * the chart, the delta, the notice or the tab, and the user never asked for
   * this range. A later switch takes the normal path and reports normally.
   */
  warmPriceHistory: (params: WarmPriceHistoryParams) => Promise<void>;
  /** Fetch a token's stats with the same flat session-cache validity. */
  fetchStats: (params: FetchStatsParams) => Promise<TokenStats | null>;
}

const isFresh = (updatedAt: number): boolean =>
  Date.now() - updatedAt < PRICE_HISTORY_CACHE_VALIDITY_MS;

interface CachedFetchParams<T> {
  /** Sequence-guard key for this request (also the status key, where used). */
  key: string;
  /** The stale-response guard owning `key`. */
  guard: SequenceGuard;
  /** The currently cached entry for this key, if any. */
  cached?: { updatedAt: number };
  /** Bypass the flat validity check (e.g. explicit retry). */
  forceRefresh?: boolean;
  /** The service call. */
  fetcher: () => Promise<T>;
  /** Marks the request in flight (status-bearing callers only). */
  onStart?: () => void;
  /** Commits the fresh payload to the session cache. */
  onSuccess: (data: T) => void;
  /** Records a failure that was not superseded. */
  onError?: (message: string) => void;
  /**
   * Only warming sets it: a speculative miss is not an incident, and five per
   * screen-open would drown the real reports.
   */
  silentErrors?: boolean;
  /** logger.error tag + fallback error message for a non-Error throw. */
  logTag: string;
  logMessage: string;
}

/**
 * The keyed-cached-fetch skeleton both actions share: validity check, sequence
 * bump, stale-response guard on BOTH paths (a superseded failure must not
 * overwrite the newer request's state), Sentry report, and null whenever
 * nothing fresh was fetched. Callers supply only what differs.
 */
const runCachedFetch = async <T>({
  key,
  guard,
  cached,
  forceRefresh,
  fetcher,
  onStart,
  onSuccess,
  onError,
  silentErrors,
  logTag,
  logMessage,
}: CachedFetchParams<T>): Promise<T | null> => {
  if (!forceRefresh && cached && isFresh(cached.updatedAt)) {
    return null;
  }

  const requestSeq = guard.start(key);

  onStart?.();

  try {
    const data = await joinInFlight(key, fetcher, forceRefresh);

    // Superseded by a newer fetch for this same key while in flight — the
    // newer response owns the slot.
    if (!guard.isCurrent(key, requestSeq)) {
      return null;
    }

    onSuccess(data);

    return data;
  } catch (error) {
    // Transport failures only: a no-data 200 is the expected state for most
    // Soroban tokens and resolves above without reaching here.
    // Staleness first. `joinInFlight` hands one rejected request to every
    // caller that asked for the key, so reporting before this check turns one
    // backend failure into one Sentry event per caller — including callers
    // this guard is about to discard.
    if (!guard.isCurrent(key, requestSeq)) {
      return null;
    }

    if (!silentErrors) {
      logger.error(logTag, logMessage, error);
    }

    onError?.(error instanceof Error ? error.message : logMessage);

    return null;
  }
};

export const usePriceHistoryStore = create<PriceHistoryState>((set, get) => {
  /**
   * Both the user fetch and the warm land here, so a warmed range is the same
   * cache hit a previously-viewed one is.
   */
  const commitHistoryEntry = (
    network: NETWORKS,
    tokenId: TokenIdentifier,
    range: PriceHistoryRange,
    data: TokenPriceHistory,
  ) => {
    const { historyByNetwork } = get();

    set({
      historyByNetwork: {
        ...historyByNetwork,
        [network]: {
          ...(historyByNetwork[network] ?? {}),
          [tokenId]: {
            ...(historyByNetwork[network]?.[tokenId] ?? {}),
            [range]: { data, updatedAt: Date.now() },
          },
        },
      },
    });
  };

  return {
    historyByNetwork: {},
    statsByNetwork: {},
    historyStatusByKey: {},
    selectedRange: null,
    inspectedPoint: null,
    inspectingKey: null,

    setSelectedRange: ({ network, tokenId, range }) => {
      const key = getTokenScopeKey(network, tokenId);
      set((state) => ({
        selectedRange: { key, range },
        // Clears the point rather than ending the drag: a still-live gesture
        // re-sets it on its next move against the new range's series, so the
        // switch never leaves the index pointing at the wrong series.
        inspectedPoint:
          state.inspectedPoint?.key === key ? null : state.inspectedPoint,
      }));
    },

    clearSelectedRange: ({ network, tokenId }) => {
      if (get().selectedRange?.key !== getTokenScopeKey(network, tokenId)) {
        return;
      }

      set({ selectedRange: null });
    },

    setInspectedPoint: ({ network, tokenId, range, index }) =>
      set((state) => {
        const key = getTokenScopeKey(network, tokenId);
        const current = state.inspectedPoint;
        // A pointer move fires at touch frequency; most moves land on the
        // same snapped index as the last one. Returning the SAME state
        // object when key/range/index are unchanged keeps every subscriber
        // (header, delta, section, chart) from re-rendering on a no-op move.
        if (
          current &&
          current.key === key &&
          current.range === range &&
          current.index === index
        ) {
          return state;
        }
        return { inspectedPoint: { key, range, index } };
      }),

    clearInspectedPoint: ({ network, tokenId }) => {
      if (get().inspectedPoint?.key !== getTokenScopeKey(network, tokenId)) {
        return;
      }
      set({ inspectedPoint: null });
    },

    startInspectGesture: ({ network, tokenId }) =>
      set({ inspectingKey: getTokenScopeKey(network, tokenId) }),

    endInspectGesture: ({ network, tokenId }) => {
      if (get().inspectingKey !== getTokenScopeKey(network, tokenId)) {
        return;
      }
      set({ inspectingKey: null });
    },

    endInspection: ({ network, tokenId }) => {
      const key = getTokenScopeKey(network, tokenId);
      const { inspectingKey, inspectedPoint } = get();
      if (inspectingKey !== key && inspectedPoint?.key !== key) {
        return;
      }
      set({
        inspectingKey: inspectingKey === key ? null : inspectingKey,
        inspectedPoint: inspectedPoint?.key === key ? null : inspectedPoint,
      });
    },

    fetchPriceHistory: ({ tokenId, network, range, forceRefresh }) => {
      const key = getPriceHistoryKey(network, tokenId, range);
      const setStatus = (status: PriceHistoryKeyStatus) =>
        set({
          historyStatusByKey: { ...get().historyStatusByKey, [key]: status },
        });

      return runCachedFetch({
        key,
        guard: historyFetchGuard,
        cached: get().historyByNetwork[network]?.[tokenId]?.[range],
        forceRefresh,
        fetcher: () => fetchTokenPriceHistory({ tokenId, network, range }),
        onStart: () => setStatus({ isLoading: true, error: null }),
        onSuccess: (data) => {
          commitHistoryEntry(network, tokenId, range, data);
          setStatus({ isLoading: false, error: null });
        },
        onError: (error) => setStatus({ isLoading: false, error }),
        logTag: "priceHistory.fetchPriceHistory",
        logMessage: "Failed to fetch token price history",
      });
    },

    warmPriceHistory: async ({ tokenId, network, range }) => {
      const key = getPriceHistoryKey(network, tokenId, range);

      // The user's request owns this key: warming shares the guard, so
      // starting one would supersede it and swallow its `loaded` event.
      if (get().historyStatusByKey[key]?.isLoading) {
        return;
      }

      // No onStart, no onError and no forceRefresh: warming writes the cache
      // and nothing else, skips anything still fresh, and discards the return
      // value so it can never reach the analytics callback.
      await runCachedFetch({
        key,
        guard: historyFetchGuard,
        cached: get().historyByNetwork[network]?.[tokenId]?.[range],
        fetcher: () => fetchTokenPriceHistory({ tokenId, network, range }),
        onSuccess: (data) => commitHistoryEntry(network, tokenId, range, data),
        silentErrors: true,
        logTag: "priceHistory.warmPriceHistory",
        logMessage: "Failed to warm token price history",
      });
    },

    fetchStats: ({ tokenId, network }) =>
      runCachedFetch({
        key: getTokenScopeKey(network, tokenId),
        guard: statsFetchGuard,
        cached: get().statsByNetwork[network]?.[tokenId],
        fetcher: () => fetchTokenStats({ tokenId, network }),
        onSuccess: (data) => {
          const { statsByNetwork } = get();
          set({
            statsByNetwork: {
              ...statsByNetwork,
              [network]: {
                ...(statsByNetwork[network] ?? {}),
                [tokenId]: { data, updatedAt: Date.now() },
              },
            },
          });
        },
        logTag: "priceHistory.fetchStats",
        logMessage: "Failed to fetch token stats",
      }),
  };
});

/**
 * Undefined and expired both mean "fetch"; an expired entry still renders
 * while the refresh is in flight — a stale chart beats a skeleton.
 */
export const usePriceHistoryEntry = (
  network: NETWORKS,
  tokenId: TokenIdentifier,
  range: PriceHistoryRange,
): PriceHistoryEntry | undefined =>
  usePriceHistoryStore(
    (state) => state.historyByNetwork[network]?.[tokenId]?.[range],
  );

/** Live request status for one (network, token, range). */
export const usePriceHistoryStatus = (
  network: NETWORKS,
  tokenId: TokenIdentifier,
  range: PriceHistoryRange,
): PriceHistoryKeyStatus =>
  usePriceHistoryStore(
    (state) =>
      state.historyStatusByKey[getPriceHistoryKey(network, tokenId, range)] ??
      IDLE_PRICE_HISTORY_STATUS,
  );

/**
 * Read by BOTH the chart's selector and the header's delta, so the two cannot
 * disagree. No selection of its own reads {@link DEFAULT_PRICE_HISTORY_RANGE}.
 */
export const useSelectedPriceHistoryRange = (
  network: NETWORKS,
  tokenId: TokenIdentifier,
): PriceHistoryRange =>
  usePriceHistoryStore((state) =>
    state.selectedRange?.key === getTokenScopeKey(network, tokenId)
      ? state.selectedRange.range
      : DEFAULT_PRICE_HISTORY_RANGE,
  );

/** Live stats entry for one (network, token), or undefined when absent. */
export const useTokenStatsEntry = (
  network: NETWORKS,
  tokenId: TokenIdentifier,
): TokenStatsEntry | undefined =>
  usePriceHistoryStore((state) => state.statsByNetwork[network]?.[tokenId]);

export interface InspectedPriceHistory {
  range: PriceHistoryRange;
  index: number;
  point: PriceHistoryPoint;
  first: PriceHistoryPoint;
}

/**
 * The inspected point resolved against the CACHED series it was chosen on.
 * Read by the chart (artwork), the header price and the header delta, so the
 * three cannot disagree. Null when nothing is inspected for this scope, the
 * series is gone, or the index no longer fits it. Two primitive-ish selects
 * plus a memo rather than one object-returning selector: zustand compares
 * with Object.is, and a fresh object per store write re-renders every
 * subscriber on every unrelated update.
 */
export const useInspectedPriceHistory = (
  network: NETWORKS,
  tokenId: TokenIdentifier,
): InspectedPriceHistory | null => {
  const key = getTokenScopeKey(network, tokenId);
  const inspected = usePriceHistoryStore((state) =>
    state.inspectedPoint?.key === key ? state.inspectedPoint : null,
  );
  const points = usePriceHistoryStore((state) =>
    inspected
      ? state.historyByNetwork[network]?.[tokenId]?.[inspected.range]?.data
          .points
      : undefined,
  );

  return useMemo(() => {
    if (!inspected || !points || !hasChartData(points)) {
      return null;
    }
    const point = points[inspected.index];
    if (!point) {
      return null;
    }
    return {
      range: inspected.range,
      index: inspected.index,
      point,
      first: points[0],
    };
  }, [inspected, points]);
};

// Reads `inspectingKey`, not `inspectedPoint`: a series landing under the
// finger clears the resolved point but must not drop the scroll lock.
/** True from gesture start to end for this scope. */
export const useIsInspectingPriceHistory = (
  network: NETWORKS,
  tokenId: TokenIdentifier,
): boolean =>
  usePriceHistoryStore(
    (state) => state.inspectingKey === getTokenScopeKey(network, tokenId),
  );
