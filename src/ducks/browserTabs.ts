import { create } from "zustand";

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
}

interface BrowserTabsState {
  tabs: BrowserTab[];
  activeTabId: string | null;
  addTab: (url?: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<BrowserTab>) => void;
  closeAllTabs: () => void;
}

export const useBrowserTabsStore = create<BrowserTabsState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (url = "https://stellar.org") => {
    const newTab: BrowserTab = {
      id: Date.now().toString(),
      url,
      title: "New Tab",
      canGoBack: false,
      canGoForward: false,
      isLoading: false,
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
    }));
  },

  closeTab: (tabId: string) => {
    set((state) => {
      const newTabs = state.tabs.filter((tab) => tab.id !== tabId);
      let newActiveTabId = state.activeTabId;

      // If we're closing the active tab, switch to another tab
      if (state.activeTabId === tabId) {
        const currentIndex = state.tabs.findIndex((tab) => tab.id === tabId);
        if (newTabs.length > 0) {
          // Switch to the next tab, or the previous one if we're at the end
          const nextIndex = currentIndex < newTabs.length ? currentIndex : currentIndex - 1;
          newActiveTabId = newTabs[nextIndex]?.id || null;
        } else {
          newActiveTabId = null;
        }
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveTabId,
      };
    });
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId });
  },

  updateTab: (tabId: string, updates: Partial<BrowserTab>) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, ...updates } : tab
      ),
    }));
  },

  closeAllTabs: () => {
    set({ tabs: [], activeTabId: null });
  },
})); 