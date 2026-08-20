import { BigNumber } from "bignumber.js";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { BalanceMap, PricedBalanceMap, TokenPricesMap } from "config/types";
import { usePricesStore } from "ducks/prices";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import {
  getTokenIdentifier,
  getTokenIdentifiersFromBalances,
  getTotalUsdLabel,
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
  /** Whether the active account is funded, from the balances store. */
  isFunded: boolean;
  /** Whether the active account's balances fetch failed. */
  hasError: boolean;
}

/**
 * One account's entry in the wallets list.
 *
 * The label is the finished display string rather than a number, because the
 * choice between "$1,234.56", "$0.00" and "--" needs inputs (funded state,
 * whether anything priced, whether the fetch failed) that only the fetch cycle
 * holds — see {@link getTotalUsdLabel}. `hasError` is kept alongside so a
 * failed account is retried by the next trigger instead of being treated as
 * successfully fetched.
 */
export interface AccountFiatTotal {
  label: string;
  hasError: boolean;
}

/**
 * State for the accounts fiat totals store
 *
 * @interface AccountsFiatTotalsState
 * @property {Record<string, AccountFiatTotal>} fiatTotals - Display entry keyed
 *   by publicKey. A missing key means the account hasn't been fetched yet (the
 *   row spinner covers that); a present entry always carries a label to show,
 *   "--" included. The active account's entry is maintained by
 *   `syncAccountFiatTotal`, not fetched.
 * @property {boolean} isLoading - Whether a fetch cycle is in flight
 * @property {number | null} lastUpdatedAt - Timestamp of the last completed fetch
 * @property {NETWORKS | null} lastNetwork - Network the current totals belong to
 * @property {Function} fetchAccountsFiatTotals - Fetches USD totals for the given accounts
 */
interface AccountsFiatTotalsState {
  fiatTotals: Record<string, AccountFiatTotal>;
  isLoading: boolean;
  lastUpdatedAt: number | null;
  lastNetwork: NETWORKS | null;
  fetchAccountsFiatTotals: (
    params: FetchAccountsFiatTotalsParams,
  ) => Promise<void>;
  syncAccountFiatTotal: (params: SyncAccountFiatTotalParams) => void;
  /**
   * Wipes all totals and aborts any in-flight fetch cycle. Called from
   * `clearAccountData` so one wallet lifetime's totals never bleed into the
   * next (e.g. wipe → restore of the same seed within the TTL).
   */
  resetAccountsFiatTotals: () => void;
}

/**
 * Sums the USD value of every priced token in an account's balances.
 * Tokens without a known price (custom tokens, LP shares, price fetch
 * failures) contribute zero.
 *
 * Also reports how many tokens actually priced, which is what separates a
 * genuine zero from a total that couldn't be read: a funded account where
 * nothing priced sums to zero, but that zero is not a fact about its worth.
 */
const computeFiatTotal = (
  balances: BalanceMap,
  prices: TokenPricesMap,
): { total: BigNumber; pricedCount: number } =>
  Object.values(balances).reduce(
    (acc, balance) => {
      const identifier = getTokenIdentifier(balance);
      const currentPrice = identifier ? prices[identifier]?.currentPrice : null;

      if (!currentPrice) {
        return acc;
      }

      return {
        total: acc.total.plus(balance.total.multipliedBy(currentPrice)),
        pricedCount: acc.pricedCount + 1,
      };
    },
    { total: new BigNumber(0), pricedCount: 0 },
  );

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
          get().resetAccountsFiatTotals();

          // No feed here, so nothing is fetched and every account's total is a
          // known zero. Filled in so the row never has to infer a missing
          // entry (and never shows "--" on a network that simply has no
          // prices).
          const noFeedLabel = getTotalUsdLabel({
            hasError: false,
            hasPriceFeed: false,
            isFunded: false,
            hasPrices: false,
          });

          set({
            lastNetwork: network,
            fiatTotals: Object.fromEntries(
              publicKeys.map((publicKey) => [
                publicKey,
                { label: noFeedLabel, hasError: false },
              ]),
            ),
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
        // Failed entries don't count as fetched, so a reopen within the TTL
        // retries them instead of leaving rows on "--" until it expires.
        const hasAllAccounts = keysToFetch.every(
          (publicKey) =>
            fiatTotals[publicKey] != null && !fiatTotals[publicKey].hasError,
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
        const useBalancesV2 = useRemoteConfigStore.getState().use_balances_v2;

        // The prices store skips identifiers it already holds, so without an
        // occasional forced pass a quote fetched once would price totals for
        // the whole session. Forced and stale (TTL-expired / other-network)
        // cycles refresh quotes; each identifier only once per cycle, so
        // tokens shared across accounts (e.g. XLM) aren't refetched per batch.
        const shouldRefreshPrices = forceRefresh || !isFresh || !isSameNetwork;
        const refreshedTokens = new Set<string>();
        // The prices store swallows fetch errors (keeping whatever quotes it
        // had), so totals computed after a failed fetch can be silently
        // understated. Track it and skip the freshness stamp below — the TTL
        // must not protect known-suspect numbers from the next trigger.
        let pricesFetchFailed = false;

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
                  // Deliberately no contractIds (locally-added custom
                  // tokens): the prices backend rejects contract ids on
                  // both v1 and v2, so those balances would contribute $0
                  // to the total either way — the extension's wallets list
                  // makes the same trade-off.
                  const { balances, isFunded } = await fetchBalances({
                    publicKey,
                    network,
                    useV2: useBalancesV2,
                    shouldSkipScan: true,
                  });

                  return {
                    publicKey,
                    balances: balances ?? {},
                    isFunded: isFunded ?? false,
                  };
                } catch (error) {
                  // One account failing shouldn't blank out the whole list —
                  // its row shows "--" and the next trigger retries it. Warn
                  // (not error): a per-account fetch failing is an expected
                  // offline/backend hiccup, logged as forensic context.
                  logger.warn(
                    "fetchAccountsFiatTotals",
                    "Failed to fetch balances for account",
                    { publicKey, error },
                  );

                  return { publicKey, balances: null, isFunded: false };
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
              const pricesOk = await usePricesStore
                .getState()
                .fetchPricesForTokenIds({
                  tokens: tokensToPrice,
                  network,
                  useV2,
                  forceRefresh: shouldRefreshPrices,
                });

              if (!pricesOk) {
                pricesFetchFailed = true;
              } else if (shouldRefreshPrices) {
                tokensToPrice.forEach((token) => refreshedTokens.add(token));
              }
            }

            // Superseded (e.g. the network switched mid-flight)? The newer
            // cycle owns the state now — abort without writing.
            if (fetchGeneration !== thisGeneration) {
              return;
            }

            const prices = usePricesStore.getState().pricesByNetwork[network];

            // The label is decided here rather than in the row because this is
            // the only place that knows all of it: whether the fetch failed,
            // whether the account is funded, and whether anything priced.
            const batchTotals: Record<string, AccountFiatTotal> = {};
            results.forEach(({ publicKey, balances, isFunded }) => {
              const hasError = balances === null;
              const { total, pricedCount } = balances
                ? computeFiatTotal(balances, prices ?? {})
                : { total: new BigNumber(0), pricedCount: 0 };

              batchTotals[publicKey] = {
                label: getTotalUsdLabel({
                  hasError,
                  // Past the guard above, so the network prices tokens.
                  hasPriceFeed: isMainnet(network),
                  isFunded,
                  hasPrices: pricedCount > 0,
                  totalUsd: total,
                }),
                hasError,
              };
            });

            set({ fiatTotals: { ...get().fiatTotals, ...batchTotals } });
          }

          // Superseded after the last batch checkpoint? The newer cycle
          // owns isLoading and the freshness stamp — don't stomp them.
          if (fetchGeneration === thisGeneration) {
            set({
              isLoading: false,
              // Totals possibly computed from missing quotes don't get the
              // TTL's protection: leave the cache stale so the next trigger
              // refetches. Legitimately unpriced tokens (no market price)
              // are unaffected — this only trips on request failures.
              lastUpdatedAt: pricesFetchFailed ? null : Date.now(),
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
      syncAccountFiatTotal: ({
        publicKey,
        network,
        pricedBalances,
        isFunded,
        hasError,
      }) => {
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
        const hasPrices = entries.some((balance) => balance.fiatTotal != null);
        // Distinguishes "quotes failed" from "quotes still in flight" — both
        // leave the map unpriced, but only the former is a real "--".
        const pricesError = usePricesStore.getState().error;

        // A failed fetch and an unfunded account are both decided without
        // prices, so they're written straight through. Everything else needs
        // to guard against transient states:
        if (!hasError && isFunded) {
          // An empty map is indistinguishable from the transient cleared
          // state during an account switch, and an unpriced map with no price
          // error is just quotes that haven't landed yet — syncing either
          // would replace a real label with a placeholder.
          if (entries.length === 0 || (!hasPrices && !pricesError)) {
            return;
          }
        }

        const total = entries.reduce(
          (sum, balance) => sum.plus(balance.fiatTotal || 0),
          new BigNumber(0),
        );

        // Same helper as the fetch cycle and the Home header, so the active
        // account's row can't disagree with the balance shown above it.
        const label = getTotalUsdLabel({
          hasError,
          hasPriceFeed: isMainnet(network),
          isFunded,
          hasPrices,
          totalUsd: total,
        });

        const current = get().fiatTotals[publicKey];

        if (current?.label === label && current.hasError === hasError) {
          return;
        }

        set({
          fiatTotals: { ...get().fiatTotals, [publicKey]: { label, hasError } },
        });
      },

      resetAccountsFiatTotals: () => {
        // The generation bump aborts any in-flight cycle at its next
        // checkpoint — an external setState alone couldn't, and the old
        // cycle would write its (pre-reset) totals back a moment later.
        fetchGeneration += 1;

        set({
          fiatTotals: {},
          isLoading: false,
          lastUpdatedAt: null,
          lastNetwork: null,
        });
      },
    };
  },
);
