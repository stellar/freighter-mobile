import { BigNumber } from "bignumber.js";
import { NETWORKS } from "config/constants";
import { BalanceMap, PricedBalanceMap, TokenPricesMap } from "config/types";
import { usePricesStore } from "ducks/prices";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import {
  getTokenIdentifier,
  getTokenIdentifiersFromBalances,
} from "helpers/balances";
import { isMainnet } from "helpers/networks";
import { fetchBalances } from "services/backend";
import { create } from "zustand";

/**
 * Number of accounts fetched concurrently per batch. Batches run sequentially
 * so a wallet with many accounts doesn't fire all its balance requests at
 * once (the backend rate-limits per IP).
 */
export const ACCOUNTS_FIAT_TOTALS_BATCH_SIZE = 6;

/**
 * How long fetched totals stay fresh. Within this window a re-open of the
 * account list reuses the cached totals instead of refetching every account.
 */
export const ACCOUNTS_FIAT_TOTALS_TTL_MS = 3 * 60 * 1000;

interface FetchAccountsFiatTotalsParams {
  publicKeys: string[];
  network: NETWORKS;
  forceRefresh?: boolean;
}

interface SyncAccountFiatTotalParams {
  publicKey: string;
  network: NETWORKS;
  pricedBalances: PricedBalanceMap;
}

/**
 * State for the accounts fiat totals store
 *
 * @interface AccountsFiatTotalsState
 * @property {Record<string, BigNumber | null>} fiatTotals - USD total keyed by
 *   publicKey. `null` means the account's balances couldn't be fetched; a
 *   missing key means the account hasn't been fetched yet.
 * @property {boolean} isLoading - Whether a fetch cycle is in flight
 * @property {number | null} lastUpdatedAt - Timestamp of the last completed fetch
 * @property {NETWORKS | null} lastNetwork - Network the current totals belong to
 * @property {Function} fetchAccountsFiatTotals - Fetches USD totals for the given accounts
 */
interface AccountsFiatTotalsState {
  fiatTotals: Record<string, BigNumber | null>;
  isLoading: boolean;
  lastUpdatedAt: number | null;
  lastNetwork: NETWORKS | null;
  fetchAccountsFiatTotals: (
    params: FetchAccountsFiatTotalsParams,
  ) => Promise<void>;
  syncAccountFiatTotal: (params: SyncAccountFiatTotalParams) => void;
}

/**
 * Monotonic token identifying the latest fetch request. A new cycle (or a
 * non-mainnet clear) bumps it, so an in-flight batch loop from a previous
 * cycle aborts at its next checkpoint instead of writing stale totals —
 * e.g. mainnet values landing after the user switched to testnet.
 */
let fetchGeneration = 0;

/**
 * Sums the USD value of every priced token in an account's balances.
 * Tokens without a known price (custom tokens, LP shares, price fetch
 * failures) contribute zero, so an unfunded account totals $0.00.
 */
const computeFiatTotal = (
  balances: BalanceMap,
  prices: TokenPricesMap,
): BigNumber =>
  Object.values(balances).reduce((total, balance) => {
    const identifier = getTokenIdentifier(balance);
    const currentPrice = identifier ? prices[identifier]?.currentPrice : null;

    if (!currentPrice) {
      return total;
    }

    return total.plus(balance.total.multipliedBy(currentPrice));
  }, new BigNumber(0));

/**
 * Accounts Fiat Totals Store
 *
 * Holds the total USD value of EVERY account in the wallet (not just the
 * active one) for the account-switcher list. Balances are fetched per account
 * in small sequential batches and priced through the shared prices store
 * cache, with results applied progressively so rows fill in batch by batch.
 *
 * Fiat values are mainnet-only: on other networks the store clears itself and
 * never hits the backend.
 */
export const useAccountsFiatTotalsStore = create<AccountsFiatTotalsState>(
  (set, get) => ({
    fiatTotals: {},
    isLoading: false,
    lastUpdatedAt: null,
    lastNetwork: null,

    fetchAccountsFiatTotals: async ({
      publicKeys,
      network,
      forceRefresh = false,
    }) => {
      if (!isMainnet(network)) {
        fetchGeneration += 1;
        set({
          fiatTotals: {},
          isLoading: false,
          lastUpdatedAt: null,
          lastNetwork: network,
        });
        return;
      }

      const { fiatTotals, isLoading, lastUpdatedAt, lastNetwork } = get();

      if (isLoading) {
        return;
      }

      const isSameNetwork = lastNetwork === network;
      const isFresh =
        lastUpdatedAt !== null &&
        Date.now() - lastUpdatedAt < ACCOUNTS_FIAT_TOTALS_TTL_MS;
      // Failed (null) entries don't count as fetched, so a reopen within the
      // TTL retries them instead of leaving rows blank until it expires.
      const hasAllAccounts = publicKeys.every(
        (publicKey) => fiatTotals[publicKey] != null,
      );

      if (!forceRefresh && isSameNetwork && isFresh && hasAllAccounts) {
        return;
      }

      // Totals from another network are meaningless here — drop them so the
      // list never shows stale values while the new fetch is in flight.
      set({ isLoading: true, ...(isSameNetwork ? {} : { fiatTotals: {} }) });

      fetchGeneration += 1;
      const thisGeneration = fetchGeneration;
      const useV2 = useRemoteConfigStore.getState().use_token_prices_v2;

      try {
        for (
          let i = 0;
          i < publicKeys.length;
          i += ACCOUNTS_FIAT_TOTALS_BATCH_SIZE
        ) {
          const batch = publicKeys.slice(
            i,
            i + ACCOUNTS_FIAT_TOTALS_BATCH_SIZE,
          );

          // eslint-disable-next-line no-await-in-loop
          const results = await Promise.all(
            batch.map(async (publicKey) => {
              try {
                const { balances } = await fetchBalances({
                  publicKey,
                  network,
                  shouldSkipScan: true,
                });

                return { publicKey, balances: balances ?? {} };
              } catch (error) {
                // One account failing shouldn't blank out the whole list.
                return { publicKey, balances: null };
              }
            }),
          );

          const tokens = [
            ...new Set(
              results.flatMap(({ balances }) =>
                balances ? getTokenIdentifiersFromBalances(balances) : [],
              ),
            ),
          ];

          // Deduped against the shared prices cache, so tokens held by
          // several accounts (e.g. XLM) are only requested once.
          // eslint-disable-next-line no-await-in-loop
          await usePricesStore.getState().fetchPricesForTokenIds({
            tokens,
            network,
            useV2,
          });

          // Superseded (e.g. the network switched mid-flight)? The newer
          // cycle owns the state now — abort without writing.
          if (fetchGeneration !== thisGeneration) {
            return;
          }

          const prices = usePricesStore.getState().pricesByNetwork[network];

          const batchTotals: Record<string, BigNumber | null> = {};
          results.forEach(({ publicKey, balances }) => {
            batchTotals[publicKey] =
              balances === null
                ? null
                : computeFiatTotal(balances, prices ?? {});
          });

          set({ fiatTotals: { ...get().fiatTotals, ...batchTotals } });
        }

        set({
          isLoading: false,
          lastUpdatedAt: Date.now(),
          lastNetwork: network,
        });
      } catch (error) {
        // Per-account and price errors are already handled above; this is a
        // safety net so isLoading can't get stuck if something unexpected
        // throws mid-cycle.
        if (fetchGeneration === thisGeneration) {
          set({ isLoading: false, lastNetwork: network });
        }
      }
    },

    /**
     * Keeps an account's total in step with balances the app already holds
     * (the active account's store), without hitting the backend. When the
     * value actually changes — e.g. after a send — the cache is marked stale
     * so the next sheet open refetches every account (a self-transfer also
     * moves the receiving account's total).
     */
    syncAccountFiatTotal: ({ publicKey, network, pricedBalances }) => {
      // Fiat totals are mainnet-only, and this gate is not redundant with the
      // unpriced-balances one below: right after a switch to another network,
      // the balances store still briefly holds the previous mainnet data —
      // real fiatTotal values included — until the refetch replaces it.
      // Syncing in that window would write USD totals into a store that was
      // just cleared for the new network.
      if (!isMainnet(network)) {
        return;
      }

      const entries = Object.values(pricedBalances);

      // An empty map is indistinguishable from the transient cleared state
      // during an account switch, and balances without fiat values are just
      // prices that haven't loaded yet — syncing either would write a bogus
      // zero over a real total.
      if (
        entries.length === 0 ||
        !entries.some((balance) => balance.fiatTotal != null)
      ) {
        return;
      }

      const total = entries.reduce(
        (sum, balance) => sum.plus(balance.fiatTotal || 0),
        new BigNumber(0),
      );

      const current = get().fiatTotals[publicKey];

      if (current?.isEqualTo(total)) {
        return;
      }

      set({
        fiatTotals: { ...get().fiatTotals, [publicKey]: total },
        // Only a change to a previously-known value signals real balance
        // movement worth invalidating the other accounts' cache for.
        ...(current ? { lastUpdatedAt: null } : {}),
      });
    },
  }),
);
