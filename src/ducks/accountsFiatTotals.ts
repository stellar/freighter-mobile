import { BigNumber } from "bignumber.js";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
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
  /**
   * Account to skip in the fetch — pass the active account, whose total is
   * already kept current from the app's own balances via
   * `syncAccountFiatTotal`, saving one request per cycle.
   */
  excludePublicKey?: string;
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
 *   missing key means the account hasn't been fetched yet. The active
 *   account's entry is maintained by `syncAccountFiatTotal`, not fetched.
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
 * Fetches are deliberately infrequent — users mostly live on one account, so
 * the list only refreshes on the Home warm-up (once per network landing),
 * pull-to-refresh, sheet open (TTL-gated) and account switches; the active
 * account's own row is instead kept current from the app's balances via
 * `syncAccountFiatTotal`. Notably, neither the 30s balances poll nor
 * active-account movement triggers a refetch of the other accounts.
 *
 * Fiat values are mainnet-only: on other networks the store clears itself and
 * never hits the backend.
 */
export const useAccountsFiatTotalsStore = create<AccountsFiatTotalsState>(
  (set, get) => {
    /**
     * Monotonic token identifying the latest fetch request. A new cycle (or a
     * non-mainnet clear) bumps it, so an in-flight batch loop from a previous
     * cycle aborts at its next checkpoint instead of writing stale totals —
     * e.g. mainnet values landing after the user switched to testnet.
     * Closure-scoped (not module-level) so it follows the store instance.
     */
    let fetchGeneration = 0;

    return {
      fiatTotals: {},
      isLoading: false,
      lastUpdatedAt: null,
      lastNetwork: null,

      fetchAccountsFiatTotals: async ({
        publicKeys,
        network,
        forceRefresh = false,
        excludePublicKey = undefined,
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

        // A forced call (pull-to-refresh, account switch) supersedes an
        // in-flight cycle instead of being dropped: the generation bump
        // below makes the old cycle abort at its next checkpoint.
        if (isLoading && !forceRefresh) {
          return;
        }

        // The active account's total is synced from the app's own balances,
        // so fetching it again would be a wasted request.
        const keysToFetch = publicKeys.filter(
          (publicKey) => publicKey !== excludePublicKey,
        );

        const isSameNetwork = lastNetwork === network;
        const isFresh =
          lastUpdatedAt !== null &&
          Date.now() - lastUpdatedAt < ACCOUNTS_FIAT_TOTALS_TTL_MS;
        // Failed (null) entries don't count as fetched, so a reopen within the
        // TTL retries them instead of leaving rows blank until it expires.
        const hasAllAccounts = keysToFetch.every(
          (publicKey) => fiatTotals[publicKey] != null,
        );

        if (!forceRefresh && isSameNetwork && isFresh && hasAllAccounts) {
          return;
        }

        // Totals from another network are meaningless here — drop them so
        // the list never shows stale values while the new fetch is in
        // flight. The excluded (active) account's entry survives the clear:
        // it's owned by the sync, which only writes values for the current
        // network, and this cycle won't refetch it — on first launch the
        // sync usually lands just before this first cycle, and wiping it
        // would leave the active row stuck at $0.00.
        const preservedTotals =
          excludePublicKey != null && fiatTotals[excludePublicKey] != null
            ? { [excludePublicKey]: fiatTotals[excludePublicKey] }
            : {};

        set({
          isLoading: true,
          ...(isSameNetwork ? {} : { fiatTotals: preservedTotals }),
        });

        fetchGeneration += 1;
        const thisGeneration = fetchGeneration;
        const useV2 = useRemoteConfigStore.getState().use_token_prices_v2;

        // The prices store skips identifiers it already holds, so without an
        // occasional forced pass a quote fetched once would price totals for
        // the whole session. Forced and stale (TTL-expired / other-network)
        // cycles refresh quotes; each identifier only once per cycle, so
        // tokens shared across accounts (e.g. XLM) aren't refetched per batch.
        const shouldRefreshPrices = forceRefresh || !isFresh || !isSameNetwork;
        const refreshedTokens = new Set<string>();

        try {
          for (
            let i = 0;
            i < keysToFetch.length;
            i += ACCOUNTS_FIAT_TOTALS_BATCH_SIZE
          ) {
            const batch = keysToFetch.slice(
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
                  // One account failing shouldn't blank out the whole list —
                  // its row falls back to a zero total. Warn (not error): a
                  // per-account fetch failing is an expected offline/backend
                  // hiccup, logged as forensic context.
                  logger.warn(
                    "fetchAccountsFiatTotals",
                    "Failed to fetch balances for account",
                    { publicKey, error },
                  );

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

            const tokensToPrice = shouldRefreshPrices
              ? tokens.filter((token) => !refreshedTokens.has(token))
              : tokens;

            if (tokensToPrice.length > 0) {
              // On non-refreshing cycles this still dedupes against the shared
              // prices cache, so tokens held by several accounts (e.g. XLM)
              // are only requested once.
              // eslint-disable-next-line no-await-in-loop
              await usePricesStore.getState().fetchPricesForTokenIds({
                tokens: tokensToPrice,
                network,
                useV2,
                forceRefresh: shouldRefreshPrices,
              });

              if (shouldRefreshPrices) {
                tokensToPrice.forEach((token) => refreshedTokens.add(token));
              }
            }

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

          // Superseded after the last batch checkpoint? The newer cycle
          // owns isLoading and the freshness stamp — don't stomp them.
          if (fetchGeneration === thisGeneration) {
            set({
              isLoading: false,
              lastUpdatedAt: Date.now(),
              lastNetwork: network,
            });
          }
        } catch (error) {
          // Per-account and price errors are already handled above; this is a
          // safety net so isLoading can't get stuck if something unexpected
          // throws mid-cycle. Warn (not error): the wallets-list totals are a
          // nice-to-have, and rows degrade gracefully to zero totals.
          logger.warn(
            "fetchAccountsFiatTotals",
            "Unexpected error during totals fetch cycle",
            { error },
          );

          if (fetchGeneration === thisGeneration) {
            set({ isLoading: false, lastNetwork: network });
          }
        }
      },

      /**
       * Keeps the active account's total in step with balances the app
       * already holds, without hitting the backend — its row is always
       * current and the fetch cycles skip it. Deliberately does NOT
       * invalidate the other accounts' cache: their values change with live
       * prices on every balances poll, and treating that drift as movement
       * used to defeat the TTL and refetch every account each poll. The
       * other rows refresh on the TTL'd triggers instead (sheet open,
       * pull-to-refresh, account switch).
       */
      syncAccountFiatTotal: ({ publicKey, network, pricedBalances }) => {
        // Fiat totals are mainnet-only, and this gate is not redundant with
        // the unpriced-balances one below: right after a switch to another
        // network, the balances store still briefly holds the previous
        // mainnet data — real fiatTotal values included — until the refetch
        // replaces it. Syncing in that window would write USD totals into a
        // store that was just cleared for the new network.
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

        set({ fiatTotals: { ...get().fiatTotals, [publicKey]: total } });
      },
    };
  },
);
