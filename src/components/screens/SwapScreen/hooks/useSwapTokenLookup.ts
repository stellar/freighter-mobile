/* eslint-disable no-underscore-dangle */
import { canonicalId } from "components/screens/SwapScreen/helpers/canonicalId";
import { computeTrendingIntersection } from "components/screens/SwapScreen/helpers/computeTrendingIntersection";
import { formatClassicRecord } from "components/screens/SwapScreen/helpers/formatClassicRecord";
import { mergeBlockaidScans } from "components/screens/SwapScreen/helpers/mergeBlockaidScans";
import {
  isClassicTokenType,
  isSorobanRecord,
} from "components/screens/SwapScreen/helpers/recordPredicates";
import {
  DEFAULT_DEBOUNCE_DELAY,
  NATIVE_TOKEN_CODE,
  NETWORKS,
} from "config/constants";
import {
  FormattedSearchTokenRecord,
  HookStatus,
  TokenTypeWithCustomToken,
} from "config/types";
import { useBlockaidTokenScansStore } from "ducks/blockaidTokenScans";
import { useDebugStore } from "ducks/debug";
import { useStellarExpertTopTokensStore } from "ducks/stellarExpertTopTokens";
import { useVerifiedTokensStore } from "ducks/verifiedTokens";
import { formatTokenIdentifier, getTokenType } from "helpers/balances";
import { isMainnet } from "helpers/networks";
import { splitVerifiedTokens } from "helpers/splitVerifiedTokens";
import { type HeldBalanceItem } from "hooks/useBalancesList";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchToken } from "services/stellarExpert";

export interface SwapTokenLookupResult {
  /**
   * Held classic tokens, always populated regardless of search state.
   * The picker hides this list during active search and reads
   * `heldSearchMatches` instead, but the value here is unconditional.
   */
  yourTokens: HeldBalanceItem[];
  /**
   * Top stellar.expert assets sorted by volume7d, EXCLUDING held
   * tokens. Always populated regardless of search state — the picker
   * hides this list during active search but the value here is
   * unconditional.
   */
  popularTokens: FormattedSearchTokenRecord[];
  /**
   * Same verified intersection as popularTokens, but INCLUDING held tokens.
   * Consumed by SwapAmountScreen's Trending list — seeing held tokens'
   * live price + 24h % there is useful, since the screen has no separate
   * "Your tokens" section to visually duplicate them with.
   */
  trendingTokens: FormattedSearchTokenRecord[];
  /** Active: held tokens matching the search term (always classic, balance-value ordered). Idle: []. */
  heldSearchMatches: FormattedSearchTokenRecord[];
  /** Active: SDF-verified non-held matches from stellar.expert (deduped against heldSearchMatches). Idle: []. */
  verifiedSearchMatches: FormattedSearchTokenRecord[];
  /** Active: unverified non-held matches from stellar.expert (deduped against held + verified). Idle: []. */
  unverifiedSearchMatches: FormattedSearchTokenRecord[];
  /**
   * True when the pre-filter result set contained Soroban contract tokens
   * that matched the term AND the filtered (classic-only) list ended up
   * empty. Lets the picker swap its empty-state copy for a Soroban-specific
   * notice when this is the reason nothing showed up.
   */
  hadSorobanMatches: boolean;
  /** True when the latest stellar.expert call failed (network/timeout/5xx). */
  stellarExpertDown: boolean;
  /** Hook lifecycle status — IDLE / LOADING / SUCCESS / ERROR. Reflects the latest fetch. */
  status: HookStatus;
  /** True while the trending stellar.expert fetch is in flight (idle mode). */
  isTrendingLoading: boolean;
  /** Current search term (synced with handleSearch input). Empty string = idle mode. */
  searchTerm: string;
  /** Update the search term; triggers debounced active-search fetch. */
  handleSearch: (term: string) => void;
  /** Clear the search term and return to idle mode. */
  resetSearch: () => void;
  /**
   * User-initiated pull-to-refresh. Force-refreshes all three trending
   * cache layers (stellar.expert top tokens, verified tokens, Blockaid
   * bulk scans) in parallel and re-runs the intersection pipeline.
   * Resolves on success; rejects when the upstream fetch fails so the
   * caller can surface a toast.
   */
  refreshTrending: () => Promise<void>;
}

export interface UseSwapTokenLookupProps {
  network: NETWORKS;
  balanceItems: HeldBalanceItem[];
  /**
   * When true, the hook becomes a pure client-side held-balance lookup:
   * trending tokens aren't fetched, popular tokens stay empty, and
   * `searchTerm` filters in-memory across `balanceItems` only (no
   * stellar.expert search, no Blockaid bulk scan). Use this for the
   * "Swap from" picker so typing in the search box stays instant.
   */
  holdsOnly?: boolean;
}

/** Partial-match: does `text` contain `term` (case-insensitive)? */
const matchesTerm = (text: string | undefined, term: string): boolean => {
  if (!text) return false;
  return text.toLowerCase().includes(term.toLowerCase());
};

// Module-scoped in-memory cache of the computed (Blockaid-merged,
// held-INCLUSIVE) trending list, keyed by network. Survives component
// remount within a single app session, so navigating Swap → Home →
// Swap paints the trending section with data immediately instead of
// flashing the spinner while the SWR pipeline re-reads its disk
// caches.
//
// Why this matters: useSwapTokenLookup holds trendingTokens in
// component-instance state, so every remount starts from []. The SWR
// effect below then sets isTrendingLoading=true synchronously before
// the async cache read can flip it back off — producing a visible
// spinner flash on every Swap-screen entry.
//
// First visit per app session still flashes briefly while the
// AsyncStorage read resolves; that's an acceptable cost since the
// common case is "user keeps coming back to the Swap screen".
const trendingMemoryCacheByNetwork = new Map<
  NETWORKS,
  FormattedSearchTokenRecord[]
>();

/**
 * Test-only: reset the module-scoped trending memory cache so suites
 * that exercise the SWR pipeline don't inherit a populated map from
 * sibling tests.
 */
export const resetTrendingMemoryCacheForTests = (): void => {
  trendingMemoryCacheByNetwork.clear();
};

export const useSwapTokenLookup = ({
  network,
  balanceItems,
  holdsOnly = false,
}: UseSwapTokenLookupProps): SwapTokenLookupResult => {
  const latestRequestRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const trendingAbortRef = useRef<AbortController | null>(null);
  // Hold the live balanceItems in a ref so `performSearch`'s identity stays
  // stable across renders even when the caller passes a fresh array literal
  // (very common for the empty-balance case). Without this the debounce
  // useEffect would tear down its timer on every render.
  const balanceItemsRef = useRef(balanceItems);
  balanceItemsRef.current = balanceItems;

  const [searchTerm, setSearchTerm] = useState<string>("");
  // trendingTokens = INTERSECTION of stellar.expert top-50 AND the runtime
  // verified-tokens list (held-INCLUSIVE). popularTokens below excludes held
  // tokens for the picker; the trending list consumes this array as-is.
  const [trendingTokens, setTrendingTokens] = useState<
    FormattedSearchTokenRecord[]
  >(() => trendingMemoryCacheByNetwork.get(network) ?? []);
  const [searchPartition, setSearchPartition] = useState<{
    held: FormattedSearchTokenRecord[];
    verified: FormattedSearchTokenRecord[];
    unverified: FormattedSearchTokenRecord[];
  }>({ held: [], verified: [], unverified: [] });
  const [hadSorobanMatches, setHadSorobanMatches] = useState<boolean>(false);
  const [stellarExpertDown, setStellarExpertDown] = useState<boolean>(false);
  const [status, setStatus] = useState<HookStatus>(HookStatus.IDLE);
  const [isTrendingLoading, setIsTrendingLoading] = useState<boolean>(false);

  // Co-mutate the module-scoped trending cache alongside React state so
  // future mounts hydrate synchronously from memory. Pass the same
  // value you'd pass to setTrendingTokens.
  const writeTrendingTokens = useCallback(
    (tokens: FormattedSearchTokenRecord[]) => {
      trendingMemoryCacheByNetwork.set(network, tokens);
      setTrendingTokens(tokens);
    },
    [network],
  );

  const { overriddenBlockaidResponse } = useDebugStore();

  // Apply Blockaid security info to a list of formatted records. On testnet
  // the API throws — callers swallow that and continue without security data.
  const enhanceWithSecurityInfo = useCallback(
    async (
      tokens: FormattedSearchTokenRecord[],
      signal: AbortSignal,
    ): Promise<FormattedSearchTokenRecord[]> => {
      if (tokens.length === 0 || !isMainnet(network)) {
        return tokens;
      }
      try {
        const addressList = tokens
          .filter((t) => t.issuer)
          .map((t) => `${t.tokenCode}-${t.issuer}`);
        if (addressList.length === 0) return tokens;
        const bulkScanResult = await useBlockaidTokenScansStore
          .getState()
          .scanBulkWithCache({ addressList, network });
        if (signal.aborted) return tokens;
        return mergeBlockaidScans(
          tokens,
          bulkScanResult.results ?? {},
          overriddenBlockaidResponse,
        );
      } catch {
        // Bulk scan failed (network error, non-mainnet, etc.). Continue
        // without security info — the swap picker still shows results.
        return tokens;
      }
    },
    [network, overriddenBlockaidResponse],
  );

  // Build a memoized set of canonical "CODE:ISSUER" identifiers for the
  // held balances. We key effects on the joined string instead of the
  // array reference so callers don't have to hand us a referentially
  // stable list — passing `[]` inline at each render is fine.
  const heldIdsKey = useMemo(
    () =>
      balanceItems
        .map((b) => {
          if (b.id === "native") return NATIVE_TOKEN_CODE; // XLM
          const { tokenCode, issuer } = formatTokenIdentifier(b.id);
          return canonicalId(tokenCode, issuer ?? "");
        })
        .sort()
        .join("|"),
    [balanceItems],
  );

  const hasExistingTrustline = useCallback(
    (tokenCode: string, issuer: string): boolean => {
      const id = canonicalId(tokenCode, issuer);
      // Re-derive the set from the cached key string to avoid a separate ref.
      if (!heldIdsKey) return false;
      return heldIdsKey.split("|").includes(id);
    },
    [heldIdsKey],
  );

  // -- Idle surface ---------------------------------------------------------
  //
  // Two-phase SWR pipeline for trending tokens.
  //
  // Phase 1 (sync-ish): read the top-tokens + verified-tokens disk caches in
  // parallel. If both are present we intersect them and render preliminary
  // content immediately, painting Blockaid security info from whichever
  // scans are also cached. No spinner — the user sees a list right away.
  //
  // Phase 2 (async): if either cache layer was missing or stale, fire fresh
  // fetches in parallel (forceRefresh on the stale layer only), recompute
  // the intersection, bulk-scan the (smaller) intersection through Blockaid,
  // and replace the rendered list.
  //
  // Failure handling: when the Phase 2 refresh fails AND we already rendered
  // from cache, we keep the stale list silently. Only flip to the
  // "stellar.expert down" UI when there was no cache to fall back on
  // (cold start).
  useEffect(() => {
    // Cancel any prior trending request
    trendingAbortRef.current?.abort();
    // holdsOnly callers (the "Swap from" picker) never render trending or
    // popular tokens, so the network call is wasted work — skip entirely.
    if (holdsOnly) {
      setIsTrendingLoading(false);
      setTrendingTokens([]);
      return undefined;
    }
    const controller = new AbortController();
    trendingAbortRef.current = controller;
    const { signal } = controller;
    let cancelled = false;

    const CACHE_TTL_MS = 30 * 60 * 1000;

    // Only flip to the loading state when we don't already have a list
    // for this network in the module-scoped memory cache. Repeat visits
    // within an app session paint instantly from the cached intersection
    // and let Phase 2 silently revalidate; the visible spinner stays
    // reserved for first-visit-per-session cold starts.
    const hasMemoryHit = trendingMemoryCacheByNetwork.has(network);
    if (!hasMemoryHit) {
      setIsTrendingLoading(true);
    }

    (async () => {
      // ---- Phase 1: read all caches, render preliminary if possible ----
      const [topCache, verCache] = await Promise.all([
        useStellarExpertTopTokensStore.getState().readCache(network),
        useVerifiedTokensStore.getState().readCache(network),
      ]);
      if (cancelled || signal.aborted) return;

      const haveBothCaches = !!topCache && !!verCache;
      if (haveBothCaches) {
        // Render preliminary content using whichever Blockaid scans are cached.
        const intersection = computeTrendingIntersection(
          topCache.data,
          verCache.data,
          hasExistingTrustline,
        );
        const addressList = intersection
          .filter((t) => t.issuer)
          .map((t) => `${t.tokenCode}-${t.issuer}`);
        const { hits } = await useBlockaidTokenScansStore
          .getState()
          .readScansFor(network, addressList);
        if (cancelled || signal.aborted) return;
        setStellarExpertDown(false);
        writeTrendingTokens(
          mergeBlockaidScans(intersection, hits, overriddenBlockaidResponse),
        );
        setIsTrendingLoading(false);
      }

      // ---- Phase 2: revalidate when missing or stale ----
      const topStale = !topCache || topCache.age > CACHE_TTL_MS;
      const verStale = !verCache || verCache.age > CACHE_TTL_MS;
      const needRefresh = topStale || verStale;
      if (!needRefresh) return;

      const [topResp, verSplit] = await Promise.all([
        useStellarExpertTopTokensStore.getState().getStellarExpertTopTokens({
          network,
          forceRefresh: !!topCache && topCache.age > CACHE_TTL_MS,
        }),
        useVerifiedTokensStore.getState().getVerifiedTokens({
          network,
          forceRefresh: !!verCache && verCache.age > CACHE_TTL_MS,
        }),
      ]);
      if (cancelled || signal.aborted) return;

      if (!topResp || !verSplit) {
        // Refresh failed. Only escalate to "stellar.expert down" UI when
        // there was no cache to fall back on; otherwise keep the stale list.
        if (!haveBothCaches) {
          setStellarExpertDown(true);
          setIsTrendingLoading(false);
        }
        return;
      }

      const intersection = computeTrendingIntersection(
        topResp,
        verSplit,
        hasExistingTrustline,
      );
      const addressList = intersection
        .filter((t) => t.issuer)
        .map((t) => `${t.tokenCode}-${t.issuer}`);
      const { results } = await useBlockaidTokenScansStore
        .getState()
        .scanBulkWithCache({ addressList, network });
      if (cancelled || signal.aborted) return;

      setStellarExpertDown(false);
      writeTrendingTokens(
        mergeBlockaidScans(intersection, results, overriddenBlockaidResponse),
      );
      setIsTrendingLoading(false);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // We intentionally re-run when `network` or the held-set composition
    // changes (heldIdsKey), not on every new array identity passed in.
    // hasExistingTrustline is a stable callback derived from heldIdsKey.
    // overriddenBlockaidResponse is included so flipping the Debug-screen
    // Blockaid override re-fires the pipeline and re-applies the override
    // to the rendered Trending list (QA-only path).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, heldIdsKey, holdsOnly, overriddenBlockaidResponse]);

  // -- Active-search surface ------------------------------------------------
  //
  // Runs whenever `searchTerm` changes to a non-empty value. Builds three
  // deduped buckets — held / verified / unverified — sharing a single `seen`
  // set so a held token can never duplicate into Verified or Unverified.
  // Classic-only on all three.
  const performSearch = useCallback(
    async (term: string) => {
      const requestId = ++latestRequestRef.current;
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;

      if (!term) {
        if (latestRequestRef.current === requestId) {
          setStatus(HookStatus.IDLE);
          setSearchPartition({ held: [], verified: [], unverified: [] });
          setHadSorobanMatches(false);
        }
        return;
      }

      setStatus(HookStatus.LOADING);
      setHadSorobanMatches(false);

      // 1) Held matches — partial match against tokenCode or displayName.
      const heldMatches: FormattedSearchTokenRecord[] = balanceItemsRef.current
        .filter(
          (b) =>
            matchesTerm(b.tokenCode, term) || matchesTerm(b.displayName, term),
        )
        .map((b) => {
          const { tokenCode, issuer } = formatTokenIdentifier(b.id);
          const resolvedIssuer = issuer ?? "";
          return {
            tokenCode,
            domain: "",
            hasTrustline: true,
            issuer: resolvedIssuer,
            isNative: b.id === "native",
            tokenType: resolvedIssuer
              ? getTokenType(`${tokenCode}:${resolvedIssuer}`)
              : TokenTypeWithCustomToken.NATIVE,
          };
        })
        .filter((t) => isClassicTokenType(t.tokenType));

      // holdsOnly short-circuit: the "Swap from" picker only chooses among
      // tokens the user already holds, so there's no point hitting
      // stellar.expert / Blockaid on each keystroke. Return the in-memory
      // matches immediately and bail.
      if (holdsOnly) {
        if (latestRequestRef.current !== requestId) return;
        setSearchPartition({
          held: heldMatches,
          verified: [],
          unverified: [],
        });
        setHadSorobanMatches(false);
        setStatus(HookStatus.SUCCESS);
        return;
      }

      // 2) Cross-network search via stellar.expert.
      const response = await searchToken(term, network, signal);
      if (signal.aborted || latestRequestRef.current !== requestId) return;

      if (!response) {
        // stellar.expert down — fall back to held-only results.
        setStellarExpertDown(true);
        const enhancedHeld = await enhanceWithSecurityInfo(heldMatches, signal);
        if (signal.aborted || latestRequestRef.current !== requestId) return;
        setSearchPartition({
          held: enhancedHeld,
          verified: [],
          unverified: [],
        });
        setHadSorobanMatches(false);
        setStatus(HookStatus.SUCCESS);
        return;
      }

      setStellarExpertDown(false);
      const rawRecords = response._embedded?.records ?? [];

      // Track whether the pre-filter set had any Soroban records before we
      // drop them. The flag is only meaningful when the filtered list is
      // empty (see hadSorobanMatches doc).
      const preFilterHadSoroban = rawRecords.some((r) => isSorobanRecord(r));

      const classicRecords = rawRecords.filter((r) => {
        if (isSorobanRecord(r)) return false;
        const [tokenCode, issuer] = r.asset.split("-");
        if (!issuer && r.asset !== NATIVE_TOKEN_CODE) return false;
        const tokenType = getTokenType(
          issuer ? `${tokenCode}:${issuer}` : NATIVE_TOKEN_CODE,
        );
        return isClassicTokenType(tokenType);
      });

      const formatted = classicRecords.map((r) => {
        const [tokenCode, issuer] = r.asset.split("-");
        return formatClassicRecord(
          r,
          hasExistingTrustline(tokenCode, issuer ?? ""),
        );
      });

      // 3) Verified vs unverified split.
      const { verified, unverified } = await splitVerifiedTokens({
        tokens: formatted,
        network,
      });
      if (signal.aborted || latestRequestRef.current !== requestId) return;

      // Dedupe across sources into three buckets via a shared `seen` set so
      // a held token can never duplicate into Verified or Unverified.
      const seen = new Set<string>();
      const heldDeduped: FormattedSearchTokenRecord[] = [];
      const verifiedDeduped: FormattedSearchTokenRecord[] = [];
      const unverifiedDeduped: FormattedSearchTokenRecord[] = [];

      const pushDeduped = (
        bucket: FormattedSearchTokenRecord[],
        token: FormattedSearchTokenRecord,
      ) => {
        const id = canonicalId(token.tokenCode, token.issuer);
        if (seen.has(id)) return;
        seen.add(id);
        bucket.push(token);
      };

      heldMatches.forEach((t) => pushDeduped(heldDeduped, t));
      verified.forEach((t) => pushDeduped(verifiedDeduped, t));
      unverified.forEach((t) => pushDeduped(unverifiedDeduped, t));

      // Single Blockaid call against the concat keeps the network footprint
      // flat; re-split the enhanced result by index range. enhanceWithSecurityInfo
      // preserves order (it `.map`s the input array), so this is safe.
      const concat = [...heldDeduped, ...verifiedDeduped, ...unverifiedDeduped];
      const enhanced = await enhanceWithSecurityInfo(concat, signal);
      if (signal.aborted || latestRequestRef.current !== requestId) return;

      const heldEnd = heldDeduped.length;
      const verifiedEnd = heldEnd + verifiedDeduped.length;
      const enhancedHeld = enhanced.slice(0, heldEnd);
      const enhancedVerified = enhanced.slice(heldEnd, verifiedEnd);
      const enhancedUnverified = enhanced.slice(verifiedEnd);

      setSearchPartition({
        held: enhancedHeld,
        verified: enhancedVerified,
        unverified: enhancedUnverified,
      });
      setHadSorobanMatches(enhanced.length === 0 && preFilterHadSoroban);
      setStatus(HookStatus.SUCCESS);
    },
    // balanceItems is read via balanceItemsRef (so callers can pass `[]`
    // inline without thrashing the callback identity). hasExistingTrustline
    // is the held-set fingerprint; enhanceWithSecurityInfo carries the
    // network + Blockaid debug-override fingerprint.
    [enhanceWithSecurityInfo, hasExistingTrustline, network, holdsOnly],
  );

  // Debounce wiring: a user keystroke updates `searchTerm` immediately so the
  // input stays responsive; the network call is debounced via a timer.
  // We use a plain setTimeout instead of the `useDebounce` helper because
  // the trailing-keystroke cancellation needs to share the same
  // AbortController lifecycle as the in-flight fetch.
  useEffect(() => {
    if (searchTerm === "") {
      // Empty term — nothing to do here. resetSearch / handleSearch("") are
      // responsible for clearing active-search state synchronously, so we
      // don't re-clear here (which would race with set-after-update writes
      // from in-flight performSearch resolutions).
      return undefined;
    }

    const timer = setTimeout(() => {
      performSearch(searchTerm);
    }, DEFAULT_DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [searchTerm, performSearch]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    // Optimistically flip to LOADING and clear stale results the moment the
    // user types, even before the 500ms debounce kicks the fetch. Otherwise
    // consumers gate "No tokens match …" on status===LOADING and that
    // label flashes briefly between keystroke and fetch (or between
    // keystroke and synchronous holdsOnly resolution).
    if (term.length > 0) {
      setStatus(HookStatus.LOADING);
      setSearchPartition({ held: [], verified: [], unverified: [] });
      setHadSorobanMatches(false);
    } else {
      setStatus(HookStatus.IDLE);
      setSearchPartition({ held: [], verified: [], unverified: [] });
      setHadSorobanMatches(false);
    }
  }, []);

  const resetSearch = useCallback(() => {
    abortControllerRef.current?.abort();
    setSearchTerm("");
    setSearchPartition({ held: [], verified: [], unverified: [] });
    setHadSorobanMatches(false);
    setStatus(HookStatus.IDLE);
  }, []);

  const refreshTrending = useCallback(async () => {
    trendingAbortRef.current?.abort();
    const controller = new AbortController();
    trendingAbortRef.current = controller;
    const { signal } = controller;

    // Wrap Promise.all so a fetch rejection is re-thrown with the
    // original error attached via Error.cause — Sentry breadcrumbs and
    // the toast caller both get the actual upstream failure instead of
    // just the generic wrapper.
    let topResp;
    let verSplit;
    try {
      [topResp, verSplit] = await Promise.all([
        useStellarExpertTopTokensStore.getState().getStellarExpertTopTokens({
          network,
          forceRefresh: true,
        }),
        useVerifiedTokensStore.getState().getVerifiedTokens({
          network,
          forceRefresh: true,
        }),
      ]);
    } catch (cause) {
      // The ErrorOptions ({ cause }) constructor overload needs lib
      // es2022.error which this tsconfig doesn't expose, so assign
      // .cause manually after construction. Sentry's Error-chain
      // breadcrumbs walk this field.
      const wrapped = new Error("Failed to refresh trending tokens");
      (wrapped as Error & { cause?: unknown }).cause = cause;
      throw wrapped;
    }
    if (signal.aborted) return;
    if (!topResp || !verSplit) {
      const missing = !topResp ? "stellar.expert" : "verified-tokens";
      throw new Error(
        `Failed to refresh trending tokens (${missing} returned null)`,
      );
    }

    const intersection = computeTrendingIntersection(
      topResp,
      verSplit,
      hasExistingTrustline,
    );
    const addressList = intersection
      .filter((t) => t.issuer)
      .map((t) => `${t.tokenCode}-${t.issuer}`);
    const { results } = await useBlockaidTokenScansStore
      .getState()
      .scanBulkWithCache({ addressList, network, forceRefresh: true });
    if (signal.aborted) return;

    setStellarExpertDown(false);
    setTrendingTokens(
      mergeBlockaidScans(intersection, results, overriddenBlockaidResponse),
    );
  }, [network, hasExistingTrustline, overriddenBlockaidResponse]);

  // Idle outputs
  // Filter held balances down to classic-only (native + alphanum4/12).
  // Liquidity pool shares and Soroban custom tokens are not swappable and
  // should never surface in the Swap-To picker's "Your tokens" section.
  // getTokenType expects either NATIVE_TOKEN_CODE ("XLM") or a "CODE:ISSUER"
  // string. Balance.id is "native" for XLM in this codebase, so normalize
  // first — otherwise the catch-all classifies it as LIQUIDITY_POOL_SHARES
  // and filters it out.
  const yourTokens = useMemo(
    () =>
      balanceItems.filter((b) =>
        isClassicTokenType(
          getTokenType(b.id === "native" ? NATIVE_TOKEN_CODE : b.id),
        ),
      ),
    [balanceItems],
  );
  // popularTokens is the same verified intersection as trendingTokens,
  // additionally EXCLUDING held tokens for the picker.
  const popularTokens = useMemo(
    () =>
      trendingTokens.filter(
        (t) => !hasExistingTrustline(t.tokenCode, t.issuer),
      ),
    [trendingTokens, hasExistingTrustline],
  );

  return {
    yourTokens,
    popularTokens,
    trendingTokens,
    heldSearchMatches: searchTerm ? searchPartition.held : [],
    verifiedSearchMatches: searchTerm ? searchPartition.verified : [],
    unverifiedSearchMatches: searchTerm ? searchPartition.unverified : [],
    hadSorobanMatches: searchTerm ? hadSorobanMatches : false,
    stellarExpertDown,
    status,
    isTrendingLoading,
    searchTerm,
    handleSearch,
    resetSearch,
    refreshTrending,
  };
};
