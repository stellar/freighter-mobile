import { Asset, Horizon } from "@stellar/stellar-sdk";
import {
  NATIVE_TOKEN_CODE,
  NETWORKS,
  mapNetworkToNetworkDetails,
  HISTORY_FETCH_POLLING_INTERVAL,
} from "config/constants";
import { logger } from "config/logger";
import { BalanceMap } from "config/types";
import { useBalancesStore } from "ducks/balances";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { useVerifiedTokensStore } from "ducks/verifiedTokens";
import { getMonthYearKey } from "helpers/date";
import { getIconUrlFromTokensLists } from "helpers/getIconUrlFromTokensLists";
import {
  getIsDustPayment,
  getIsPayment,
  getIsSwap,
  getTokenFromTokenId,
  filterOperationsByToken,
  getIsCreateClaimableBalanceSpam,
} from "helpers/history";
import { collectTokenIds, mapV2Transaction } from "helpers/history/v2";
import {
  filterHistoryEntries,
  filterHistoryEntriesByToken,
} from "helpers/history/v2/filters";
import { HistoryEntry } from "helpers/history/v2/model";
import { buildTokenContext } from "helpers/history/v2/tokenResolver";
import { getNativeContractDetails } from "helpers/soroban";
import {
  getAccountHistory,
  getAccountHistoryV2,
  getTokenDetails,
} from "services/backend";
import { create } from "zustand";

let pollingIntervalId: NodeJS.Timeout | null = null;

/**
 * History Item Operation Type
 *
 * Extends the base Horizon operation with additional computed properties
 * for easier UI rendering and filtering.
 */
export type HistoryItemOperation = Horizon.ServerApi.OperationRecord & {
  isCreateExternalAccount: boolean;
  isPayment: boolean;
  isSwap: boolean;
};

/**
 * History Section Type
 *
 * Groups operations by month and year for organized display.
 */
export type HistorySection = {
  monthYear: string; // in format {month}:{year}
  operations: HistoryItemOperation[];
};

/**
 * Raw History Data Interface
 *
 * Contains the raw history data from the backend before any filtering.
 */
export interface RawHistoryData {
  balances: BalanceMap;
  rawOperations: Horizon.ServerApi.OperationRecord[];
}

/**
 * History Data Interface
 *
 * Contains both balance and history information needed for rendering
 * transaction history screens.
 */
export interface HistoryData {
  balances: BalanceMap;
  history: HistorySection[];
}

/** v2 section — one row per transaction, where v1 is one row per operation. */
export type HistorySectionV2 = {
  monthYear: string; // "{month}:{year}", same key format as v1
  entries: HistoryEntry[];
};

export interface RawHistoryV2Data {
  balances: BalanceMap;
  entries: HistoryEntry[];
}

export interface HistoryDataV2 {
  balances: BalanceMap;
  history: HistorySectionV2[];
}

/**
 * History State Interface
 *
 * Defines the structure of the history state store using Zustand.
 * This store manages account history data for a given public key and network,
 * along with loading and error states, and methods to fetch the history.
 *
 * @interface HistoryState
 * @property {RawHistoryData | null} rawHistoryData - The raw history data from backend
 * @property {boolean} isLoading - Indicates if history data is currently being fetched
 * @property {string | null} error - Error message if fetch failed, null otherwise
 * @property {boolean} hasRecentTransaction - Flag indicating if there's a recent transaction that should trigger refresh indicator
 * @property {boolean} isFetching - Tracks if a fetch operation is currently in progress (prevents duplicate requests)
 * @property {Function} fetchAccountHistory - Function to fetch account history from the backend
 * @property {Function} getFilteredHistoryData - Function to get filtered history data for specific token
 * @property {Function} startPolling - Function to start polling for history updates
 * @property {Function} stopPolling - Function to stop polling for history updates
 */
interface HistoryState {
  rawHistoryData: RawHistoryData | null;
  rawHistoryV2Data: RawHistoryV2Data | null;
  /**
   * Which account/network the stored history data (either field above)
   * belongs to. `getFilteredHistoryData` checks this against its own
   * `params.publicKey` *and* `params.network` before returning either
   * field, so a stale `rawHistoryV2Data`/`rawHistoryData` left behind by a
   * same-account failed refresh (see the `catch` in `fetchAccountHistory`)
   * can never be served for a *different* account or network — e.g. the
   * same public key on mainnet vs. testnet. Set alongside the data on every
   * `set()` that populates history; never touched by the `catch` (that's
   * the point).
   */
  loadedHistoryAccount: { publicKey: string; network: NETWORKS } | null;
  isLoading: boolean;
  error: string | null;
  hasRecentTransaction: boolean;
  isFetching: boolean;
  fetchAccountHistory: (params: {
    publicKey: string;
    network: NETWORKS;
    isBackgroundRefresh?: boolean;
    hasRecentTransaction?: boolean;
  }) => Promise<void>;
  getFilteredHistoryData: (params: {
    publicKey: string;
    /**
     * Compared against loadedHistoryAccount.network alongside publicKey.
     * Without this, the same account on mainnet vs. testnet is not
     * distinguished: a network switch whose fetch throws (landing in the
     * catch, which deliberately leaves the previous network's data in
     * place) or is skipped by the isFetching duplicate-request guard would
     * otherwise be served under the new network's identity.
     */
    network: NETWORKS;
    tokenId?: string;
    isHideDustEnabled?: boolean;
  }) => HistoryData | HistoryDataV2 | null;
  startPolling: (params: { publicKey: string; network: NETWORKS }) => void;
  stopPolling: () => void;
}

/**
 * Resolves a token-detail-screen tokenId (a balances-map key, e.g. "XLM" or
 * "CODE:ISSUER" — see getTokenIdentifier in helpers/balances.ts) to the
 * contract id filterHistoryEntriesByToken matches on (row.token.contractId,
 * always a C... address). Mirrors how the v1 path normalizes via
 * getTokenFromTokenId in filterOperationsByToken, so the v2 path filters on
 * the same identifier space instead of comparing a balances-map key against
 * a contract id and silently matching nothing.
 *
 * Returns null when the tokenId cannot be resolved (e.g. a classic
 * CODE:ISSUER pair whose Asset.contractId derivation throws) so the caller
 * can fall back to "no filter" rather than filtering on a wrong value.
 */
const resolveTokenIdToContractId = (
  tokenId: string,
  network: NETWORKS,
): string | null => {
  const target = getTokenFromTokenId(tokenId);

  // Already a contract id (Soroban token passed straight through).
  if (target.contractId) {
    return target.contractId;
  }

  // Native XLM: getTokenFromTokenId maps both "native" and "XLM" to
  // { code: "XLM" }.
  if (target.code === NATIVE_TOKEN_CODE && !target.issuer) {
    return getNativeContractDetails(network).contract || null;
  }

  // Classic CODE:ISSUER pair: derive the SAC contract id the same way
  // tokenResolver.ts's indexBalancesByContractId does.
  if (target.code && target.issuer) {
    try {
      const { networkPassphrase } = mapNetworkToNetworkDetails(network);
      return new Asset(target.code, target.issuer).contractId(
        networkPassphrase,
      );
    } catch {
      return null;
    }
  }

  return null;
};

/**
 * Creates history sections from raw operations
 *
 * Groups operations by month/year and applies filtering for dust payments
 * and spam operations.
 *
 * @param publicKey - The account public key
 * @param operations - Raw operations from Horizon API
 * @param isHideDustEnabled - Whether to hide dust payments
 * @returns Array of history sections grouped by month/year
 */
const createHistorySections = (
  publicKey: string,
  operations: Horizon.ServerApi.OperationRecord[],
  isHideDustEnabled: boolean,
): HistorySection[] =>
  operations.reduce(
    (
      sections: HistorySection[],
      operation: Horizon.ServerApi.OperationRecord,
    ) => {
      const isPayment = getIsPayment(operation.type);
      const isSwap = getIsSwap(operation);
      const isCreateExternalAccount =
        operation.type ===
          Horizon.HorizonApi.OperationResponseType.createAccount &&
        operation.account !== publicKey;

      const isDustPayment = getIsDustPayment(publicKey, operation);

      const parsedOperation = {
        ...operation,
        isPayment,
        isSwap,
        isCreateExternalAccount,
      };

      // Skip dust payments if enabled
      if (isDustPayment && isHideDustEnabled) {
        return sections;
      }

      // Skip spam operations
      if (getIsCreateClaimableBalanceSpam(operation)) {
        return sections;
      }

      const date = new Date(operation.created_at);
      const month = date.getMonth();
      const year = date.getFullYear();
      const monthYear = `${month}:${year}`;

      const lastSection = sections[sections.length - 1];

      // Create first section if none exist
      if (!lastSection) {
        return [{ monthYear, operations: [parsedOperation] }];
      }

      // Add to existing section if same month/year
      if (lastSection.monthYear === monthYear) {
        lastSection.operations.push(parsedOperation);
        return sections;
      }

      // Create new section for different month/year
      return [...sections, { monthYear, operations: [parsedOperation] }];
    },
    [] as HistorySection[],
  );

/**
 * History Store
 *
 * A store that manages the state of account history in the application.
 * Handles fetching, storing, and error states for transaction history.
 * Includes polling mechanism to keep data synchronized.
 */
export const useHistoryStore = create<HistoryState>((set, get) => ({
  rawHistoryData: null,
  rawHistoryV2Data: null,
  loadedHistoryAccount: null,
  isLoading: false,
  error: null,
  hasRecentTransaction: false,
  isFetching: false,

  fetchAccountHistory: async (params) => {
    try {
      if (!params.publicKey) {
        // Pre-call guardrail; caller has already returned early or
        // shown an empty state. Not error-adjacent.
        logger.info("fetchAccountHistory", "No public key provided");
        return;
      }

      // Prevent duplicate concurrent requests
      if (get().isFetching) {
        logger.info(
          "fetchAccountHistory",
          "Request already in progress, skipping",
        );

        return;
      }

      set({ isFetching: true });

      if (params.hasRecentTransaction) {
        set({ hasRecentTransaction: true });
      }

      // Only show loading spinner for initial loads, not background refreshes
      if (!params.isBackgroundRefresh) {
        set({ isLoading: true, error: null });
      }

      const { fetchAccountBalances, getBalances } = useBalancesStore.getState();
      const networkDetails = mapNetworkToNetworkDetails(params.network);

      await fetchAccountBalances({
        publicKey: params.publicKey,
        network: params.network,
      });

      const { isFunded } = useBalancesStore.getState();
      if (!isFunded) {
        logger.info(
          "fetchAccountHistory",
          "Skipping history fetch for unfunded account",
        );

        set({
          rawHistoryData: {
            balances: getBalances(),
            rawOperations: [],
          },
          // Without this, switching from a funded v2-fetched account to an
          // unfunded account would leave the previous account's entries in
          // rawHistoryV2Data — and getFilteredHistoryData checks that field
          // first, so it would render the wrong account's transaction history.
          rawHistoryV2Data: null,
          loadedHistoryAccount: {
            publicKey: params.publicKey,
            network: params.network,
          },
          isLoading: false,
          error: null,
          isFetching: false,
          hasRecentTransaction: false,
        });

        return;
      }

      // `use_history_v2` is a BOOLEAN_FLAGS entry, so fetchFeatureFlags can
      // overwrite its `false` default from Amplitude with no app release —
      // which is the intended rollout gesture now that this path serves the
      // real endpoint and no longer has fixtures behind it.
      const useV2 = useRemoteConfigStore.getState().use_history_v2;
      const nativeTokenId =
        getNativeContractDetails(params.network).contract || null;
      // v2 serves pubnet and testnet only; anything else falls through to v1
      // rather than throwing, because mobile has no legacy-screen pre-route.
      const isV2Network =
        params.network === NETWORKS.PUBLIC ||
        params.network === NETWORKS.TESTNET;

      if (useV2 && isV2Network) {
        const page = await getAccountHistoryV2({
          publicKey: params.publicKey,
          networkDetails,
        });

        const tokens = await buildTokenContext({
          tokenIds: collectTokenIds(page.data),
          networkDetails,
          publicKey: params.publicKey,
          balances: getBalances(),
          // Disk-cached with a 30-minute TTL, so this is cheap on the common
          // path. Resolution step 3 reads it to get code/decimals/icon without
          // a per-token network call.
          tokenListItems: await useVerifiedTokensStore
            .getState()
            .getVerifiedTokens({ network: params.network }),
          // Shim: the resolver's injected signature takes `networkDetails`
          // (the extension's shape), while this repo's getTokenDetails takes a
          // NETWORKS value. Returns TokenDetailsResponse | null, whose `symbol`
          // and `decimals` are what the resolver reads.
          getTokenDetailsFn: ({ contractId, publicKey }) =>
            getTokenDetails({
              contractId,
              publicKey,
              network: params.network,
            }),
          // getIconUrlFromTokensLists takes `{ asset: { contractId, issuer }, network }`
          // and resolves to `string | undefined` — the icon URL itself, not a
          // record — so the shim wraps it into the `{ icon } | null` the
          // resolver expects. It re-reads the verified-token list internally
          // rather than taking the array we already pass as `tokenListItems`;
          // that list is disk-cached with a 30-minute TTL, so the second read
          // is cheap, and threading it in would mean forking the helper.
          getIconFn: async ({ contractId }) => {
            const icon = await getIconUrlFromTokensLists({
              asset: { contractId },
              network: params.network,
            });
            return icon ? { icon } : null;
          },
        });

        const entries = page.data.map((tx) =>
          mapV2Transaction(tx, {
            tokens,
            publicKey: params.publicKey,
            nativeTokenId,
          }),
        );

        set({
          rawHistoryV2Data: { balances: getBalances(), entries },
          rawHistoryData: null,
          loadedHistoryAccount: {
            publicKey: params.publicKey,
            network: params.network,
          },
          isLoading: false,
          error: null,
          isFetching: false,
          hasRecentTransaction: false,
        });

        return;
      }

      const rawOperations = await getAccountHistory({
        publicKey: params.publicKey,
        networkDetails,
      });

      const balances = getBalances();
      const rawHistoryData: RawHistoryData = {
        balances,
        rawOperations,
      };

      set({
        rawHistoryData,
        rawHistoryV2Data: null,
        loadedHistoryAccount: {
          publicKey: params.publicKey,
          network: params.network,
        },
        isLoading: false,
        error: null,
        isFetching: false,
        // Clear hasRecentTransaction after successful fetch
        hasRecentTransaction: false,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch history";

      // Deliberately does not touch rawHistoryData / rawHistoryV2Data /
      // loadedHistoryAccount: a failed refresh should leave whatever history
      // was already loaded on screen (matches v1's original behavior) rather
      // than blanking it. This is safe from the cross-account leak that
      // motivated loadedHistoryAccount: getFilteredHistoryData validates
      // loadedHistoryAccount.publicKey against its own params.publicKey
      // before returning either data field, so a same-account failed
      // refresh still serves the (correct, stale) previously loaded data,
      // while a failure reached by switching accounts first (fetchAccountBalances
      // succeeds for the new account, then getAccountHistoryV2/getAccountHistory
      // throws before any set() for the new account runs) can never serve the
      // previous account's stale entries under the new account's identity.
      set({
        error: errorMessage,
        isLoading: false,
        isFetching: false,
      });

      logger.error("fetchAccountHistory", "Error fetching history:", error);
    }
  },

  getFilteredHistoryData: (params) => {
    const { loadedHistoryAccount, rawHistoryV2Data } = get();

    // Identity guard, checked before either data field: the stored data
    // (v1 or v2) only belongs to the account/network it was fetched for.
    // Without this, a same-account failed refresh correctly leaves stale
    // data in place (see the catch in fetchAccountHistory), but a failure
    // reached by switching accounts (or networks) first — fetchAccountBalances
    // succeeds for the new account so the unfunded short-circuit doesn't
    // fire, then getAccountHistoryV2/getAccountHistory throws before any
    // set() for the new account runs — would otherwise leave the *previous*
    // account/network's rawHistoryV2Data/rawHistoryData in place, and this
    // function would serve it under the new identity. The network half also
    // covers a plain network switch skipped by the isFetching duplicate-
    // request guard: the same public key on mainnet vs. testnet must not
    // share loaded data.
    if (
      !loadedHistoryAccount ||
      loadedHistoryAccount.publicKey !== params.publicKey ||
      loadedHistoryAccount.network !== params.network
    ) {
      return null;
    }

    if (rawHistoryV2Data) {
      const nativeTokenId =
        getNativeContractDetails(params.network).contract || null;

      let { entries } = rawHistoryV2Data;
      if (params.tokenId) {
        // params.tokenId is a balances-map key (e.g. "XLM", "CODE:ISSUER"),
        // not a contract id — see resolveTokenIdToContractId. When it can't
        // be resolved, skip filtering rather than filtering on a wrong
        // value: an unfiltered list is a safer failure than a silently
        // wrong one.
        const contractTokenId = resolveTokenIdToContractId(
          params.tokenId,
          params.network,
        );
        if (contractTokenId) {
          entries = filterHistoryEntriesByToken(entries, contractTokenId);
        }
      }
      entries = filterHistoryEntries(entries, {
        isHideDustEnabled: params.isHideDustEnabled ?? true,
        nativeTokenId,
      });

      const history = entries.reduce((sections: HistorySectionV2[], entry) => {
        // Use the ported getMonthYearKey rather than rebuilding the key inline:
        // it is the one definition of the "{month}:{year}" format that
        // MonthHeader parses back apart, and it deliberately returns "NaN:NaN"
        // for an unparseable date instead of a confident "January".
        const monthYear = getMonthYearKey(entry.createdAt);
        const lastSection = sections[sections.length - 1];

        if (!lastSection) {
          return [{ monthYear, entries: [entry] }];
        }
        if (lastSection.monthYear === monthYear) {
          lastSection.entries.push(entry);
          return sections;
        }
        return [...sections, { monthYear, entries: [entry] }];
      }, []);

      return { balances: rawHistoryV2Data.balances, history };
    }

    const { rawHistoryData } = get();

    if (!rawHistoryData) {
      return null;
    }

    const { balances, rawOperations } = rawHistoryData;
    let filteredOperations = rawOperations;

    if (params.tokenId) {
      const networkDetails = mapNetworkToNetworkDetails(params.network);
      filteredOperations = filterOperationsByToken(
        rawOperations,
        params.tokenId,
        networkDetails,
      );
    }

    const historySections = createHistorySections(
      params.publicKey,
      filteredOperations,
      params.isHideDustEnabled ?? true,
    );

    return {
      balances,
      history: historySections,
    };
  },
  startPolling: (params) => {
    // Clear any existing polling
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
    }

    // Start polling after initial interval
    pollingIntervalId = setInterval(() => {
      get().fetchAccountHistory({
        ...params,
        isBackgroundRefresh: true,
      });
    }, HISTORY_FETCH_POLLING_INTERVAL);
  },
  stopPolling: () => {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;
    }
  },
}));
