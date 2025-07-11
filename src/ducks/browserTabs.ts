import AsyncStorage from "@react-native-async-storage/async-storage";
import { BROWSER_CONSTANTS } from "config/constants";
import { generateTabId } from "helpers/browser";
import { findTabScreenshot, pruneScreenshots } from "helpers/screenshots";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  screenshot?: string; // Base64 encoded screenshot of the website
  logoUrl?: string; // Favicon URL
  lastAccessed: number; // Timestamp for sorting
}

interface BrowserTabsState {
  tabs: BrowserTab[];
  activeTabId: string | null;
  showTabOverview: boolean;
  addTab: (url?: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<BrowserTab>) => void;
  closeAllTabs: () => void;
  getActiveTab: () => BrowserTab | undefined;
  getTabById: (tabId: string) => BrowserTab | undefined;
  isTabActive: (tabId: string) => boolean;
  goToPage: (tabId: string, url: string) => void;
  setLogo: (tabId: string, logoUrl: string) => void;
  setNavState: (
    tabId: string,
    navState: { canGoBack: boolean; canGoForward: boolean },
  ) => void;
  loadScreenshots: () => Promise<void>;
  cleanupScreenshots: () => Promise<void>;
  setShowTabOverview: (show: boolean) => void;
}

export const useBrowserTabsStore = create<BrowserTabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      showTabOverview: false,

      addTab: (url = BROWSER_CONSTANTS.HOMEPAGE_URL) => {
        const newTab: BrowserTab = {
          id: generateTabId(),
          url,
          title: BROWSER_CONSTANTS.DEFAULT_TAB_TITLE,
          canGoBack: false,
          canGoForward: false,
          screenshot: undefined,
          logoUrl: undefined,
          lastAccessed: Date.now(),
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
            const currentIndex = state.tabs.findIndex(
              (tab) => tab.id === tabId,
            );
            if (newTabs.length > 0) {
              // Switch to the next tab, or the previous one if we're at the end
              const nextIndex =
                currentIndex < newTabs.length ? currentIndex : currentIndex - 1;
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

        // Clean up screenshots for closed tabs
        get().cleanupScreenshots();
      },

      setActiveTab: (tabId: string) => {
        set((state) => ({
          activeTabId: tabId,
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, lastAccessed: Date.now() } : tab,
          ),
        }));
      },

      updateTab: (tabId: string, updates: Partial<BrowserTab>) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, ...updates } : tab,
          ),
        }));
      },

      closeAllTabs: () => {
        set({ tabs: [], activeTabId: null });
        get().cleanupScreenshots();
      },

      getActiveTab: () => {
        const state = get();
        return state.tabs.find((tab) => tab.id === state.activeTabId);
      },

      getTabById: (tabId: string) => {
        const state = get();
        return state.tabs.find((tab) => tab.id === tabId);
      },

      isTabActive: (tabId: string) => {
        const state = get();
        return state.activeTabId === tabId;
      },

      goToPage: (tabId: string, url: string) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId
              ? { ...tab, url, screenshot: undefined, lastAccessed: Date.now() }
              : tab,
          ),
        }));
      },

      setLogo: (tabId: string, logoUrl: string) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, logoUrl } : tab,
          ),
        }));
      },

      setNavState: (
        tabId: string,
        navState: {
          canGoBack: boolean;
          canGoForward: boolean;
        },
      ) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, ...navState } : tab,
          ),
        }));
      },

      setShowTabOverview: (show: boolean) => {
        set({ showTabOverview: show });
      },

      loadScreenshots: async () => {
        const state = get();
        const updatedTabs = [...state.tabs];

        // Use Promise.all to load screenshots in parallel
        const screenshotPromises = updatedTabs.map(async (tab, index) => {
          if (tab.url && tab.url !== BROWSER_CONSTANTS.HOMEPAGE_URL) {
            try {
              const screenshot = await findTabScreenshot(tab.id, tab.url);
              if (screenshot) {
                updatedTabs[index] = { ...tab, screenshot: screenshot.uri };
              }
            } catch (error) {
              // Ignore errors when loading screenshots
            }
          }
        });

        await Promise.all(screenshotPromises);
        set({ tabs: updatedTabs });
      },

      cleanupScreenshots: async () => {
        const state = get();
        const activeTabIds = state.tabs.map((tab) => tab.id);
        await pruneScreenshots(activeTabIds);
      },
    }),
    {
      name: "browser-tabs-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        // Note: showTabOverview is intentionally excluded from persistence
        // as it should always start as false when the app loads
      }),
    },
  ),
);
