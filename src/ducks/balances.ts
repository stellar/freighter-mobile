import { NETWORKS } from "config/constants";
import { Balance } from "config/types";
import { fetchBalances } from "services/backend";
import { create } from "zustand";

/**
 * Balances State Interface
 *
 * Defines the structure of the balances state store using Zustand.
 * This store manages account balances for a given public key and network,
 * along with loading and error states, and methods to fetch the balances.
 *
 * @interface BalancesState
 * @property {Record<string, Balance>} balances - Object mapping balance IDs to Balance objects
 * @property {boolean} isLoading - Indicates if balance data is currently being fetched
 * @property {string | null} error - Error message if fetch failed, null otherwise
 * @property {Function} fetchAccountBalances - Function to fetch account balances from the backend
 */
interface BalancesState {
  balances: Record<string, Balance>;
  isLoading: boolean;
  error: string | null;
  fetchAccountBalances: (params: {
    publicKey: string;
    network: NETWORKS;
    contractIds?: string[];
  }) => Promise<void>;
}

/**
 * Balances Store
 *
 * A Zustand store that manages the state of account balances in the application.
 * Handles fetching, storing, and error states for token balances.
 */
export const useBalancesStore = create<BalancesState>((set) => ({
  balances: {},
  isLoading: false,
  error: null,
  /**
   * Fetches account balances for a given public key and network
   *
   * @async
   * @param {Object} params - Parameters for fetching balances
   * @param {string} params.publicKey - The account's public key
   * @param {NETWORKS} params.network - The network to fetch balances from (e.g., TESTNET, PUBLIC)
   * @param {string[]} [params.contractIds] - Optional array of contract IDs to filter by
   * @returns {Promise<void>} A promise that resolves when the operation completes
   */
  fetchAccountBalances: async (params) => {
    try {
      set({ isLoading: true, error: null });

      const { balances } = await fetchBalances(params);

      set({ balances, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch balances",
        isLoading: false,
      });
    }
  },
}));
