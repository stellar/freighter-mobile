import { NETWORKS } from "config/constants";
import { Balance, TokenIdentifier, TokenPricesMap } from "config/types";
import { getTokenIdentifiersFromBalances } from "helpers/balances";
import { fetchTokenPrices } from "services/backend";
import { create } from "zustand";

/**
 * Stable empty map so selectors return a referentially-stable value when a
 * network has no cached prices yet (avoids a fresh `{}` re-render each call).
 */
const EMPTY_PRICES: TokenPricesMap = Object.freeze({});

interface PricesState {
  /**
   * Per-network price caches, keyed by {@link NETWORKS}. v2 prices are
   * network-scoped, so keying the cache by network makes a cross-network read
   * impossible by construction — a network *switch* never needs to clear the
   * cache (which previously caused a blank-price flicker), and a price response
   * that resolves after the user switched networks still lands in its own
   * network's submap rather than polluting the active one.
   */
  pricesByNetwork: Record<string, TokenPricesMap>;
  /**
   * Endpoint version (`use_token_prices_v2`) that populated each network's
   * cache. A v1<->v2 rollback flips this; the next fetch for that network drops
   * its stale-endpoint cache and refetches, so the rollback applies even to
   * already-cached tokens.
   */
  sourceByNetwork: Record<string, boolean>;
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
    /** Endpoint version, from the `use_token_prices_v2` flag. */
    useV2: boolean;
    /** Refetch even tokens already in the map (e.g. pull-to-refresh). */
    forceRefresh?: boolean;
  }) => Promise<void>;
}

/**
 * Drop a network's cache when the endpoint (v1/v2) that populated it differs
 * from the requested one, and stamp the new endpoint. A network *switch* is
 * handled purely by the per-network key, so this only fires on an actual
 * v1<->v2 rollback (rare). Returns whether a clear happened.
 */
const reconcileSource = (
  get: () => PricesState,
  set: (partial: Partial<PricesState>) => void,
  network: NETWORKS,
  useV2: boolean,
): void => {
  if (get().sourceByNetwork[network] === useV2) return;
  set({
    pricesByNetwork: { ...get().pricesByNetwork, [network]: {} },
    sourceByNetwork: { ...get().sourceByNetwork, [network]: useV2 },
  });
};

export const usePricesStore = create<PricesState>((set, get) => ({
  pricesByNetwork: {},
  sourceByNetwork: {},
  isLoading: false,
  error: null,
  lastUpdated: null,
  /** Fetch prices for tokens present in the user's balances. */
  fetchPricesForBalances: async ({ balances, network, useV2 }) => {
    try {
      set({ isLoading: true, error: null });

      const tokens = getTokenIdentifiersFromBalances(balances);
      if (tokens.length === 0) {
        set({ isLoading: false, lastUpdated: Date.now() });
        return;
      }

      reconcileSource(get, set, network, useV2);

      // Dedupe against the network's cache (emptied above if the endpoint just
      // changed, so a rollback refetches everything).
      const cached = get().pricesByNetwork[network] ?? EMPTY_PRICES;
      const toFetch = tokens.filter((t) => !cached[t]);
      if (toFetch.length === 0) {
        set({ isLoading: false, lastUpdated: Date.now() });
        return;
      }

      const response = await fetchTokenPrices({
        tokens: toFetch,
        network,
        useV2,
      });

      // A v1<->v2 rollback may have landed while this request was in flight;
      // its response is for the now-superseded endpoint, so drop it rather than
      // polluting the freshly-stamped cache. (No network guard needed — a late
      // response only ever writes its own network's submap.)
      if (get().sourceByNetwork[network] !== useV2) {
        set({ isLoading: false });
        return;
      }

      set({
        pricesByNetwork: {
          ...get().pricesByNetwork,
          [network]: {
            ...(get().pricesByNetwork[network] ?? EMPTY_PRICES),
            ...response,
          },
        },
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      set({
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

      reconcileSource(get, set, network, useV2);

      // Skip tokens already loaded to avoid duplicate requests — unless the
      // caller forces a refresh (e.g. pull-to-refresh), since otherwise a price
      // fetched once would never update for the rest of the session.
      const cached = get().pricesByNetwork[network] ?? EMPTY_PRICES;
      const toFetch = forceRefresh ? tokens : tokens.filter((t) => !cached[t]);
      if (toFetch.length === 0) return;

      const response = await fetchTokenPrices({
        tokens: toFetch,
        network,
        useV2,
      });

      // Drop the response if a v1<->v2 rollback superseded its endpoint while
      // it was in flight (see fetchPricesForBalances for the rationale).
      if (get().sourceByNetwork[network] !== useV2) return;

      set({
        pricesByNetwork: {
          ...get().pricesByNetwork,
          [network]: {
            ...(get().pricesByNetwork[network] ?? EMPTY_PRICES),
            ...response,
          },
        },
        lastUpdated: Date.now(),
      });
    } catch (error) {
      // Silently keep existing prices on error.
    }
  },
}));

/**
 * Live price map for the given network. Returns a stable empty map when the
 * network has no cached prices yet. Use this instead of reading the raw store
 * so consumers never see another network's (or the wrong endpoint's) prices.
 */
export const usePricesForNetwork = (network: NETWORKS): TokenPricesMap =>
  usePricesStore((state) => state.pricesByNetwork[network] ?? EMPTY_PRICES);
