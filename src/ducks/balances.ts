import { NETWORKS } from "config/constants";
import { Balance, fetchBalances } from "services/backend";
import { create } from "zustand";

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

export const useBalancesStore = create<BalancesState>((set) => ({
  balances: {},
  isLoading: false,
  error: null,
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

// Helper hooks and selectors
export const useBalances = () => {
  const { balances, isLoading, error } = useBalancesStore();
  return { balances, isLoading, error };
};

export const useBalancesFetcher = () => {
  const { fetchAccountBalances } = useBalancesStore();
  return { fetchAccountBalances };
};
