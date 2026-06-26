import { NETWORKS } from "config/constants";
import { Balance, TokenIdentifier, TokenPricesMap } from "config/types";
import { getTokenIdentifiersFromBalances } from "helpers/balances";
import { fetchTokenPrices } from "services/backend";
import { create } from "zustand";

interface PricesState {
  prices: TokenPricesMap;
  /**
   * Network the cached `prices` were fetched for. v2 is network-scoped, so
   * prices from a different network are stale and must not be reused — when a
   * fetch arrives for a different network the cache is dropped and refetched.
   */
  pricesNetwork: NETWORKS | null;
  /**
   * Endpoint version (`use_token_prices_v2`) the cached `prices` came from.
   * Together with `pricesNetwork` this identifies the price source — when the
   * Amplitude flag rolls v2 back to v1 (or vice versa) the cache is dropped and
   * refetched, so the rollback applies even to already-cached token-id lookups.
   */
  pricesUseV2: boolean | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  fetchPricesForBalances: (params: {
    balances: Record<string, Balance>;
    publicKey: string;
    network: NETWORKS;
    /** Endpoint version, from the `use_token_prices_v2` flag. */
    useV2: boolean;
  }) => Promise<void>;
  /** Fetch prices for arbitrary token identifiers (e.g., from Blockaid diffs) */
  fetchPricesForTokenIds: (params: {
    tokens: TokenIdentifier[];
    /** Active network — required by the network-scoped v2 prices endpoint. */
    network: NETWORKS;
    /** Endpoint version, from the `use_token_prices_v2` flag. Callers subscribe
     * to the flag so a rollback re-runs the fetch and invalidates the cache. */
    useV2: boolean;
    /** Refetch even tokens already in the map (e.g. pull-to-refresh). */
    forceRefresh?: boolean;
  }) => Promise<void>;
}

export const usePricesStore = create<PricesState>((set, get) => ({
  prices: {},
  pricesNetwork: null,
  pricesUseV2: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
  /** Fetch prices for tokens present in the user's balances. */
  fetchPricesForBalances: async ({ balances, network, useV2 }) => {
    try {
      set({ isLoading: true, error: null });

      // The cache is identified by its source — (network, endpoint version).
      // v2 is network-scoped, and a v1/v2 rollback changes which endpoint the
      // prices came from. If either differs, drop the cache before doing
      // anything, which also resets the dedupe baseline so every token is
      // re-queried from the current source.
      if (get().pricesNetwork !== network || get().pricesUseV2 !== useV2) {
        set({ prices: {}, pricesNetwork: network, pricesUseV2: useV2 });
      }

      const tokens = getTokenIdentifiersFromBalances(balances);

      if (tokens.length === 0) {
        set({
          isLoading: false,
          lastUpdated: Date.now(),
        });
        return;
      }

      const response = await fetchTokenPrices({ tokens, network, useV2 });

      // The source may have changed while this request was in flight (network
      // switch or flag flip). The response is scoped to (network, useV2); if the
      // active source has since moved on, discard it rather than merging stale
      // prices into the new source's cache.
      if (get().pricesNetwork !== network || get().pricesUseV2 !== useV2) {
        set({ isLoading: false });
        return;
      }

      // Merge instead of replacing — otherwise prices populated by
      // fetchPricesForTokenIds for non-held tokens get wiped every time
      // balances refresh.
      set({
        prices: { ...get().prices, ...response },
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      // Preserve existing prices data in case of error
      const currentPrices = get().prices;

      set({
        prices: currentPrices,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch token prices",
        isLoading: false,
      });
    }
  },
  /** Lightweight fetch for arbitrary tokens */
  fetchPricesForTokenIds: async ({
    tokens,
    network,
    useV2,
    forceRefresh = false,
  }) => {
    try {
      if (!tokens || tokens.length === 0) return;

      // Drop the cache when its source — (network, endpoint version) — differs
      // from this request: v2 is network-scoped, and a v1/v2 rollback changes
      // the endpoint. Callers pass the current flag so a rollback invalidates
      // already-cached token-id lookups too; clearing empties the dedupe
      // baseline so every requested token is refetched.
      if (get().pricesNetwork !== network || get().pricesUseV2 !== useV2) {
        set({ prices: {}, pricesNetwork: network, pricesUseV2: useV2 });
      }

      // Skip tokens already loaded to avoid duplicate requests — unless the
      // caller forces a refresh (e.g. pull-to-refresh), since otherwise a
      // price fetched once would never update for the rest of the session.
      const existing = get().prices;
      const toFetch = forceRefresh
        ? tokens
        : tokens.filter((t) => !existing[t]);
      if (toFetch.length === 0) return;

      const response = await fetchTokenPrices({
        tokens: toFetch,
        network,
        useV2,
      });

      // Discard if the source changed while this request was in flight (network
      // switch or flag flip) — the response is scoped to the now-stale
      // (network, useV2) (see the balances fetch above for the full rationale).
      if (get().pricesNetwork !== network || get().pricesUseV2 !== useV2)
        return;

      set({
        prices: { ...get().prices, ...response },
        lastUpdated: Date.now(),
      });
    } catch (error) {
      // Silently keep existing prices on error
      set({ lastUpdated: Date.now() });
    }
  },
}));
