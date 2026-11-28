import { create } from "zustand";

/** Home's tabs, in the order they show. */
export enum TabType {
  /** Display tokens/balances list */
  TOKENS = "tokens",
  /** Display the account's Earn positions */
  POSITIONS = "positions",
  /** Display collectibles grid */
  COLLECTIBLES = "collectibles",
}

interface HomeTabsState {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

/**
 * The tab Home has open. Kept outside Home so it survives Home mounting
 * again: a deposit started from Positions returns Home through a navigation
 * reset, and should land back on Positions, where it's about to show up.
 * Session-only, as the extension keeps it.
 */
export const useHomeTabsStore = create<HomeTabsState>()((set) => ({
  activeTab: TabType.TOKENS,
  setActiveTab: (activeTab) => set({ activeTab }),
}));
