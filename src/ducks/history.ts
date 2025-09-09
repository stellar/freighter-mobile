import { Horizon } from "@stellar/stellar-sdk";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { logger } from "config/logger";
import { BalanceMap } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import {
  getIsDustPayment,
  getIsPayment,
  getIsSwap,
  filterOperationsByToken,
  getIsCreateClaimableBalanceSpam,
} from "helpers/history";
import { getAccountHistory } from "services/backend";
import { create } from "zustand";

const POLLING_INTERVAL = 30000;

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
 * @property {Function} fetchAccountHistory - Function to fetch account history from the backend
 * @property {Function} getFilteredHistoryData - Function to get filtered history data for specific token
 * @property {Function} startPolling - Function to start polling for history updates
 * @property {Function} stopPolling - Function to stop polling for history updates
 */
interface HistoryState {
  rawHistoryData: RawHistoryData | null;
  isLoading: boolean;
  error: string | null;
  shouldRefreshAfterNavigation: boolean;
  fetchAccountHistory: (params: {
    publicKey: string;
    network: NETWORKS;
    isBackgroundRefresh?: boolean;
  }) => Promise<void>;
  getFilteredHistoryData: (params: {
    publicKey: string;
    tokenId?: string;
    isHideDustEnabled?: boolean;
  }) => HistoryData | null;
  startPolling: (params: { publicKey: string; network: NETWORKS }) => void;
  stopPolling: () => void;
  markForRefreshAfterNavigation: () => void;
  clearRefreshAfterNavigation: () => void;
}

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

      const lastSection = sections.length > 0 && sections[sections.length - 1];

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
  isLoading: false,
  error: null,
  shouldRefreshAfterNavigation: false,

  fetchAccountHistory: async (params) => {
    try {
      if (!params.publicKey) {
        logger.warn("fetchAccountHistory", "No public key provided");
        return;
      }

      // Only show loading spinner for initial loads, not background refreshes
      if (!params.isBackgroundRefresh) {
        set({ isLoading: true, error: null });
      }

      const { fetchAccountBalances, getBalances } = useBalancesStore.getState();

      await fetchAccountBalances({
        publicKey: params.publicKey,
        network: params.network,
      });

      const networkDetails = mapNetworkToNetworkDetails(params.network);
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
        isLoading: false,
        error: null,
      });

      logger.info(
        "fetchAccountHistory",
        "Raw history data fetched successfully",
        {
          operationsCount: rawOperations.length,
          publicKey: params.publicKey,
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch history";

      set({
        error: errorMessage,
        isLoading: false,
      });

      logger.error("fetchAccountHistory", "Error fetching history:", error);
    }
  },

  getFilteredHistoryData: (params) => {
    const { rawHistoryData } = get();

    if (!rawHistoryData) {
      return null;
    }

    const { balances, rawOperations } = rawHistoryData;
    let filteredOperations = rawOperations;

    if (params.tokenId) {
      const { network } = useAuthenticationStore.getState();
      const networkDetails = mapNetworkToNetworkDetails(network);
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
    }, POLLING_INTERVAL);

    logger.info("startPolling", "History polling started", {
      interval: POLLING_INTERVAL,
      publicKey: params.publicKey,
      network: params.network,
    });
  },
  stopPolling: () => {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;

      logger.info("stopPolling", "History polling stopped");
    }
  },
  markForRefreshAfterNavigation: () => {
    set({ shouldRefreshAfterNavigation: true });

    logger.info(
      "markForRefreshAfterNavigation",
      "Marked history for refresh after navigation",
    );
  },
  clearRefreshAfterNavigation: () => {
    set({ shouldRefreshAfterNavigation: false });
  },
}));
