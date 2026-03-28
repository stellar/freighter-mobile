import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "config/constants";
import { DiscoverProtocol } from "config/types";
import { findMatchedProtocol } from "helpers/protocols";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const MAX_RECENT_PROTOCOLS = 5;

/**
 * Represents a recently visited protocol.
 * We store the websiteUrl (canonical protocol URL) and a timestamp.
 * The full DiscoverProtocol is resolved at render time from the protocols store.
 */
interface RecentProtocolEntry {
  websiteUrl: string;
  lastAccessed: number;
}

interface RecentProtocolsState {
  recentProtocols: RecentProtocolEntry[];
  /**
   * Adds a URL to the recent protocols list.
   * Only adds if the URL matches a known protocol.
   * If already present, moves it to the front and updates timestamp.
   * Caps the list at MAX_RECENT_PROTOCOLS.
   */
  addRecentProtocol: (url: string, protocols: DiscoverProtocol[]) => void;
  /** Clears all recent protocols. */
  clearRecentProtocols: () => void;
}

export const useRecentProtocolsStore = create<RecentProtocolsState>()(
  persist(
    (set) => ({
      recentProtocols: [],

      addRecentProtocol: (url: string, protocols: DiscoverProtocol[]) => {
        set((state) => {
          const matched = findMatchedProtocol({ protocols, searchUrl: url });
          if (!matched) {
            return state;
          }

          const filtered = state.recentProtocols.filter(
            (entry) => entry.websiteUrl !== matched.websiteUrl,
          );

          const updated = [
            { websiteUrl: matched.websiteUrl, lastAccessed: Date.now() },
            ...filtered,
          ].slice(0, MAX_RECENT_PROTOCOLS);

          return { recentProtocols: updated };
        });
      },

      clearRecentProtocols: () => {
        set({ recentProtocols: [] });
      },
    }),
    {
      name: STORAGE_KEYS.RECENT_PROTOCOLS_STORAGE,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
