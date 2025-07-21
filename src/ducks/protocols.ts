import { DiscoverProtocol } from "config/types";
import { fetchProtocols } from "services/backend";
import { create } from "zustand";

interface ProtocolsState {
  protocols: DiscoverProtocol[];
  isLoading: boolean;
  lastUpdated: number | null;
  fetchProtocols: () => Promise<void>;
}

/**
 * Protocols Store
 *
 * A Zustand store that manages the state of protocols in the application.
 * Handles fetching and storing for discover protocols data.
 */
export const useProtocolsStore = create<ProtocolsState>((set) => ({
  protocols: [],
  isLoading: false,
  lastUpdated: null,

  fetchProtocols: async () => {
    try {
      set({ isLoading: true });

      const protocols = await fetchProtocols();

      set({
        protocols,
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      // In case of error, let's keep the current protocols list we have in store
      set({ isLoading: false });
    }
  },
}));
