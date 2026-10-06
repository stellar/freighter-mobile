import { NETWORKS } from "config/constants";
import {
  PriceHistoryRange,
  TokenIdentifier,
  TokenPriceHistory,
} from "config/types";
import {
  DEFAULT_PRICE_HISTORY_RANGE,
  getPriceHistoryKey,
  IDLE_PRICE_HISTORY_STATUS,
  usePriceHistoryEntry,
  usePriceHistoryStatus,
  usePriceHistoryStore,
  useSelectedPriceHistoryRange,
} from "ducks/priceHistory";
import { PRICE_HISTORY_WARM_ORDER } from "helpers/priceHistoryChart";
import useDebounce from "hooks/useDebounce";
import { useCallback, useEffect, useRef, useState } from "react";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

/** Rapid tab cycling fires one request for the settled range, not one per tap. */
export const PRICE_HISTORY_RANGE_DEBOUNCE_MS = 250;

export { DEFAULT_PRICE_HISTORY_RANGE };

interface PriceHistoryRangeState {
  /** Cached series for this range, when present */
  data: TokenPriceHistory | undefined;
  isLoading: boolean;
  error: string | null;
}

/**
 * The render state of ONE slot, derived in one place so the chart section and
 * the header's delta agree. A range without cached data is "loading" from the
 * instant it is selected: the debounce gates the network call, not the
 * placeholder, or a never-fetched range shows the empty-state copy for 250ms
 * before its request has even started.
 */
export const usePriceHistoryRangeState = (
  network: NETWORKS,
  tokenId: TokenIdentifier,
  range: PriceHistoryRange,
  isEnabled: boolean,
): PriceHistoryRangeState => {
  const entry = usePriceHistoryEntry(network, tokenId, range);
  const status = usePriceHistoryStatus(network, tokenId, range);

  return {
    data: entry?.data,
    isLoading: status.isLoading || (isEnabled && !entry && !status.error),
    error: status.error,
  };
};

interface UseTokenPriceHistoryParams {
  /** App-side token identifier (route-param form; "native" for XLM) */
  tokenId: TokenIdentifier;
  /** Active network — the chart is mainnet-only and never fetches elsewhere */
  network: NETWORKS;
  /** Caller-side gate (the `use_token_price_history` feature flag) */
  enabled?: boolean;
  /** On a resolved network fetch only — not cache hits, stale responses or errors. */
  onLoaded?: (data: TokenPriceHistory) => void;
  /** Once per SETTLED timeframe, from the debounced path — never per tap. */
  onRangeSettled?: (range: PriceHistoryRange) => void;
}

interface UseTokenPriceHistoryReturn {
  /** Currently selected timeframe */
  range: PriceHistoryRange;
  /** Switch timeframe (debounced fetch; selection updates immediately) */
  setRange: (range: PriceHistoryRange) => void;
  /** Cached series for the selected timeframe, when present */
  data: TokenPriceHistory | undefined;
  isLoading: boolean;
  error: string | null;
  /** Refetch the selected range, bypassing the session cache */
  retry: () => void;
  /** False off-mainnet or when the caller disabled the feature */
  isEnabled: boolean;
  /** True once this token's warm pass has settled every range */
  rangesSettled: boolean;
}

/**
 * Fetch-and-cache hook for the detail chart. Both the selection and the series
 * live in the `priceHistory` duck, so the header's delta reads the very value
 * the selector renders. Only this hook fetches — the header subscribes — so a
 * range is fetched exactly once.
 *
 * Races are structural: each response lands in its own range's slot and this
 * renders only the selected slot, so a late response cannot overwrite it.
 */
const useTokenPriceHistory = ({
  tokenId,
  network,
  enabled = true,
  onLoaded,
  onRangeSettled,
}: UseTokenPriceHistoryParams): UseTokenPriceHistoryReturn => {
  const range = useSelectedPriceHistoryRange(network, tokenId);

  // Mainnet only: the endpoint prices nothing elsewhere, so the chart is
  // hidden and no request is ever made (§7.3).
  const isEnabled = enabled && network === NETWORKS.PUBLIC;

  const fetchPriceHistory = usePriceHistoryStore(
    (state) => state.fetchPriceHistory,
  );
  const warmPriceHistory = usePriceHistoryStore(
    (state) => state.warmPriceHistory,
  );
  const setSelectedRange = usePriceHistoryStore(
    (state) => state.setSelectedRange,
  );
  const clearSelectedRange = usePriceHistoryStore(
    (state) => state.clearSelectedRange,
  );
  const { data, isLoading, error } = usePriceHistoryRangeState(
    network,
    tokenId,
    range,
    isEnabled,
  );

  // The duck owns the selection, so it outlives this hook: drop it on exit so
  // the next visit opens on 1D. Clearing is by key, so a screen unmounting
  // after its successor mounted cannot clear the new selection.
  useEffect(
    () => () => clearSelectedRange({ network, tokenId }),
    [clearSelectedRange, network, tokenId],
  );

  // Keep the analytics callbacks out of the effect deps — a re-created
  // callback must not retrigger fetches.
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  const onRangeSettledRef = useRef(onRangeSettled);
  useEffect(() => {
    onRangeSettledRef.current = onRangeSettled;
  }, [onRangeSettled]);

  /** The last range actually reported as settled (the mount range is not a change). */
  const settledRangeRef = useRef<PriceHistoryRange>(
    DEFAULT_PRICE_HISTORY_RANGE,
  );

  /**
   * Cancels the running warm pass. The cleanup below bumps it on unmount and
   * whenever the (network, token) scope or the feature gate changes, so every
   * range still queued in a pass started under an older generation becomes a
   * no-op: a user who bounces into a token and straight back out must not
   * cost six requests.
   */
  const warmGenerationRef = useRef(0);
  const scope = `${network}/${tokenId}`;
  const [settledScope, setSettledScope] = useState<string | null>(null);
  useEffect(
    () => () => {
      warmGenerationRef.current += 1;
    },
    [network, tokenId, isEnabled],
  );

  const doFetch = useCallback(
    async (fetchRange: PriceHistoryRange, forceRefresh = false) => {
      if (!isEnabled) return false;

      // Captured BEFORE the await. `warmGenerationRef` is bumped by the
      // cleanup below on unmount and on any (network, token, gate) change, so
      // comparing it afterwards is what tells us this request still belongs to
      // the scope that started it.
      const generation = warmGenerationRef.current;

      const fetched = await fetchPriceHistory({
        tokenId,
        network,
        range: fetchRange,
        forceRefresh,
      });

      // Scope ended while the request was in flight: the user left the screen
      // or the kill switch went off. `token_chart.loaded` means "the user was
      // shown this range", so emitting now would report a chart nobody saw.
      if (warmGenerationRef.current !== generation) {
        return false;
      }

      // Non-null only when a network fetch resolved (see the duck) — the
      // moment the component knows has_data.
      if (fetched) {
        onLoadedRef.current?.(fetched);
      }
      return true;
    },
    [isEnabled, fetchPriceHistory, tokenId, network],
  );

  /**
   * Prefetch the unopened timeframes, strictly one at a time: five parallel
   * requests would compete with the balance and price loads that deferring
   * exists to avoid. Calls the duck's warm action, never `doFetch` — the warm
   * resolves with nothing, so `onLoaded` structurally cannot fire from here.
   */
  const warmOtherRanges = useCallback(
    async (loadedRange: PriceHistoryRange) => {
      const generation = warmGenerationRef.current;

      /* eslint-disable no-await-in-loop -- sequential is the requirement:
         each range starts only once the previous one has settled. */
      for (let i = 0; i < PRICE_HISTORY_WARM_ORDER.length; i += 1) {
        const warmRange = PRICE_HISTORY_WARM_ORDER[i];

        // Cancelled by unmount, or by a token / network / gate change.
        if (warmGenerationRef.current !== generation) {
          return;
        }

        if (warmRange !== loadedRange) {
          await warmPriceHistory({ tokenId, network, range: warmRange });
        }
      }
      /* eslint-enable no-await-in-loop */
      if (warmGenerationRef.current === generation) {
        setSettledScope(scope);
      }
    },
    [warmPriceHistory, tokenId, network, scope],
  );

  const debouncedFetch = useDebounce((fetchRange: PriceHistoryRange) => {
    // range_changed reports the range the user SETTLED on, from the same
    // debounced path that triggers the fetch. Firing per tap would report
    // ranges that were never fetched or shown, breaking the §7.5 contract
    // against the extension (which counts settles) and preventing
    // reconciliation with token_chart.loaded.
    if (fetchRange !== settledRangeRef.current) {
      settledRangeRef.current = fetchRange;
      onRangeSettledRef.current?.(fetchRange);
    }

    doFetch(fetchRange).catch(() => {
      // Errors are already reported and stored by the duck.
    });
  }, PRICE_HISTORY_RANGE_DEBOUNCE_MS);

  /**
   * Load the selected range, THEN warm the rest. Warming is deferred, never
   * on mount: nothing about first paint may get slower, so the queue starts
   * only once the range the user is actually looking at has settled — with
   * data, empty, or failed (a failure is already reported and stored by the
   * duck, and warm failures of their own stay silent).
   *
   * One pass per (network, token) visit — never a loop, never periodic.
   */
  const hasWarmedRef = useRef(false);
  const loadThenWarm = useCallback(
    async (loadRange: PriceHistoryRange) => {
      let stillCurrent = false;
      try {
        stillCurrent = await doFetch(loadRange);
      } catch {
        // Errors are already reported and stored by the duck.
      }

      // Without this, an unmount during the fetch above is invisible here:
      // the cleanup bumps the generation first, and `warmOtherRanges` then
      // captures the ALREADY-bumped value, passes its own guard, and queues
      // five requests for a screen the user has left.
      if (!stillCurrent) return;

      // A failed load must not fan out: one outage would become six requests,
      // up to 75s of further timeouts for a chart the user already saw fail.
      // `doFetch` cannot tell a failure from a cache hit (both resolve null),
      // so the status the duck stored for this key is what says which it was.
      const { error: loadError } =
        usePriceHistoryStore.getState().historyStatusByKey[
          getPriceHistoryKey(network, tokenId, loadRange)
        ] ?? IDLE_PRICE_HISTORY_STATUS;
      if (loadError) {
        // No pass will run this visit, so nothing is left to wait for.
        setSettledScope(scope);
        return;
      }

      if (hasWarmedRef.current) return;
      hasWarmedRef.current = true;

      await warmOtherRanges(loadRange);
    },
    [doFetch, warmOtherRanges, network, tokenId, scope],
  );

  /**
   * Cancel a pending range switch when the scope changes. `useDebounce`
   * memoises its timer on the delay alone and only cancels on unmount, so a
   * callback armed under the previous scope survives a token / network /
   * gate change — and fires with the NEW closure but the OLD range argument.
   * That fetches a range the user never chose for this token and emits
   * `range_changed` for it. Cleanup form, so it runs before the per-scope
   * refs below are reset for the incoming scope.
   */
  useEffect(
    () => () => debouncedFetch.cancel(),
    [tokenId, network, isEnabled, debouncedFetch],
  );

  // First fetch for a (token, network) is immediate — there's nothing to
  // debounce against and the skeleton should resolve as fast as possible.
  // Subsequent range switches go through the debounce.
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    hasFetchedRef.current = false;
    hasWarmedRef.current = false;
    // The settled-range sentinel is per token too. Left alone, it carries the
    // previous token's last range into the next one, and the first switch
    // BACK to that range emits no `range_changed` — token A settling on 1Y
    // silently swallows token B's move to 1Y.
    settledRangeRef.current = DEFAULT_PRICE_HISTORY_RANGE;
  }, [tokenId, network]);

  useEffect(() => {
    if (!isEnabled) return;

    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      loadThenWarm(range).catch(() => {
        // Errors are already reported and stored by the duck.
      });
    } else {
      debouncedFetch(range);
    }
    // debouncedFetch is stable per useDebounce's ref-based implementation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, isEnabled, loadThenWarm]);

  const setRange = useCallback(
    (nextRange: PriceHistoryRange) => {
      setSelectedRange({ network, tokenId, range: nextRange });
    },
    [setSelectedRange, network, tokenId],
  );

  const retry = useCallback(() => {
    doFetch(range, true).catch(() => {
      // Errors are already reported and stored by the duck.
    });
  }, [doFetch, range]);

  return {
    range,
    setRange,
    data,
    isLoading,
    error,
    retry,
    isEnabled,
    rangesSettled: settledScope === scope,
  };
};

export default useTokenPriceHistory;
