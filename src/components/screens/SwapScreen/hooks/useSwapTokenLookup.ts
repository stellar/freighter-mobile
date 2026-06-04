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
  PricedBalance,
  TokenTypeWithCustomToken,
} from "config/types";
import { useBlockaidTokenScansStore } from "ducks/blockaidTokenScans";
import { useDebugStore } from "ducks/debug";
import { useStellarExpertTopTokensStore } from "ducks/stellarExpertTopTokens";
import { useVerifiedTokensStore } from "ducks/verifiedTokens";
import { formatTokenIdentifier, getTokenType } from "helpers/balances";
import { isMainnet } from "helpers/networks";
import { splitVerifiedTokens } from "helpers/splitVerifiedTokens";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assessTokenSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";
import { searchToken } from "services/stellarExpert";

export interface SwapTokenLookupResult {
  /** Idle: "Your tokens" section. Active: held matches at the top of searchResults. */
  yourTokens: Array<PricedBalance & { id: string }>;
  /** Idle: top stellar.expert assets sorted by volume7d, EXCLUDING held tokens. Active: []. */
  popularTokens: FormattedSearchTokenRecord[];
  /**
   * Same verified intersection as popularTokens, but INCLUDING held tokens.
   * Consumed by SwapAmountScreen's Trending list — seeing held tokens'
   * live price + 24h % there is useful, since the screen has no separate
   * "Your tokens" section to visually duplicate them with.
   */
  trendingTokens: FormattedSearchTokenRecord[];
  /** Active: single flat array — held > verified > stellar.expert remainder. Idle: []. */
  searchResults: FormattedSearchTokenRecord[];
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
  publicKey?: string;
  balanceItems: Array<PricedBalance & { id: string }>;
  /**
   * When true, the hook becomes a pure client-side held-balance lookup:
   * trending tokens aren't fetched, popular tokens stay empty, and
   * `searchTerm` filters in-memory across `balanceItems` only (no
   * stellar.expert search, no Blockaid bulk scan). Use this for the
   * "Swap from" picker so typing in the search box stays instant.
   */
  holdsOnly?: boolean;
}

/**
 * Minimal shape we need from the stellar.expert /asset response.
 * Mirrors `SearchTokenResponse._embedded.records[number]` but kept loose
 * so we don't have to import the full shape just for typing.
 */
// isSorobanRecord + isClassicTokenType + StellarExpertRecord moved to
// src/components/screens/SwapScreen/helpers/recordPredicates.ts so pure
// helpers like computeTrendingIntersection don't have to reach back into
// this hook file.

/** Partial-match: does `text` contain `term` (case-insensitive)? */
const matchesTerm = (text: string | undefined, term: string): boolean => {
  if (!text) return false;
  return text.toLowerCase().includes(term.toLowerCase());
};

export const useSwapTokenLookup = ({
  network,
  // publicKey is reserved for future use (e.g., issuer-address resolution path);
  // useTokenLookup uses it for that path. Kept for interface parity.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  publicKey,
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
  // §5.1: trendingTokens = INTERSECTION of stellar.expert top-50 AND the
  // runtime verified-tokens list (held-INCLUSIVE). popularTokens below
  // excludes held tokens for the picker; the SwapAmountScreen Trending list
  // consumes this array as-is.
  const [trendingTokens, setTrendingTokens] = useState<
    FormattedSearchTokenRecord[]
  >([]);
  const [searchResults, setSearchResults] = useState<
    FormattedSearchTokenRecord[]
  >([]);
  const [hadSorobanMatches, setHadSorobanMatches] = useState<boolean>(false);
  const [stellarExpertDown, setStellarExpertDown] = useState<boolean>(false);
  const [status, setStatus] = useState<HookStatus>(HookStatus.IDLE);
  const [isTrendingLoading, setIsTrendingLoading] = useState<boolean>(false);

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
        return tokens.map((token) => {
          const key = token.issuer
            ? `${token.tokenCode}-${token.issuer}`
            : token.tokenCode;
          const scanResult = bulkScanResult.results?.[key];
          const securityInfo = assessTokenSecurity(
            scanResult,
            overriddenBlockaidResponse,
          );
          return {
            ...token,
            isSuspicious: securityInfo.isSuspicious,
            isMalicious: securityInfo.isMalicious,
            isUnableToScan: securityInfo.isUnableToScan,
            securityLevel: securityInfo.level,
            securityWarnings: extractSecurityWarnings(scanResult),
          };
        });
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

    // Optimistically flag loading until Phase 1 confirms a cache hit. Cold
    // starts keep this true until Phase 2 finishes; cache hits flip it off
    // as soon as the preliminary list is rendered.
    setIsTrendingLoading(true);

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
        setTrendingTokens(
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
      setTrendingTokens(
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
  // Runs whenever `searchTerm` changes to a non-empty value. Builds a single
  // ordered Results array: held > verified > stellar.expert remainder, all
  // deduped by CODE:ISSUER and classic-only.
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
          setSearchResults([]);
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
        setSearchResults(heldMatches);
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
        setSearchResults(enhancedHeld);
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

      // Dedupe across sources: held first, then verified, then unverified.
      const seen = new Set<string>();
      const ordered: FormattedSearchTokenRecord[] = [];
      const pushUnique = (token: FormattedSearchTokenRecord) => {
        const id = canonicalId(token.tokenCode, token.issuer);
        if (seen.has(id)) return;
        seen.add(id);
        ordered.push(token);
      };
      heldMatches.forEach(pushUnique);
      verified.forEach(pushUnique);
      unverified.forEach(pushUnique);

      const enhanced = await enhanceWithSecurityInfo(ordered, signal);
      if (signal.aborted || latestRequestRef.current !== requestId) return;

      setSearchResults(enhanced);
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
      setSearchResults([]);
      setHadSorobanMatches(false);
    } else {
      setStatus(HookStatus.IDLE);
      setSearchResults([]);
      setHadSorobanMatches(false);
    }
  }, []);

  const resetSearch = useCallback(() => {
    abortControllerRef.current?.abort();
    setSearchTerm("");
    setSearchResults([]);
    setHadSorobanMatches(false);
    setStatus(HookStatus.IDLE);
  }, []);

  /**
   * User-initiated pull-to-refresh. Force-refresh all 3 layers in
   * parallel, then re-run the intersection + Blockaid scan to produce
   * a fresh trendingTokens. Resolves on success; rejects when the
   * upstream fetch fails so the caller can surface a toast.
   */
  const refreshTrending = useCallback(async () => {
    trendingAbortRef.current?.abort();
    const controller = new AbortController();
    trendingAbortRef.current = controller;
    const { signal } = controller;

    const [topResp, verSplit] = await Promise.all([
      useStellarExpertTopTokensStore.getState().getStellarExpertTopTokens({
        network,
        forceRefresh: true,
      }),
      useVerifiedTokensStore.getState().getVerifiedTokens({
        network,
        forceRefresh: true,
      }),
    ]);
    if (signal.aborted) return;
    if (!topResp || !verSplit) {
      throw new Error("Failed to refresh trending tokens");
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
  // first (same trick at line 220) — otherwise the catch-all classifies it
  // as LIQUIDITY_POOL_SHARES and filters it out.
  const yourTokens = useMemo(
    () =>
      balanceItems.filter((b) =>
        isClassicTokenType(
          getTokenType(b.id === "native" ? NATIVE_TOKEN_CODE : b.id),
        ),
      ),
    [balanceItems],
  );
  // §5.1: popularTokens is the same verified intersection as trendingTokens,
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
    searchResults: searchTerm ? searchResults : [],
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
