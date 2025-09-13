import AsyncStorage from "@react-native-async-storage/async-storage";
import { BROWSER_CONSTANTS } from "config/constants";
import { generateTabId, isHomepageUrl } from "helpers/browser";
import {
  findTabScreenshot,
  pruneScreenshots,
  removeTabScreenshot,
} from "helpers/screenshots";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Represents a single browser tab in the in-app browser.
 * @property id - Unique identifier for the tab
 * @property url - The current URL loaded in the tab
 * @property title - The title of the web page
 * @property canGoBack - Whether the tab can navigate back
 * @property canGoForward - Whether the tab can navigate forward
 * @property screenshot - (Optional) Base64 encoded screenshot of the website
 * @property logoUrl - (Optional) Favicon URL
 * @property lastAccessed - Timestamp for sorting and recency
 */
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

/**
 * Zustand store for managing browser tabs, their state, and actions.
 *
 * @property tabs - Array of all open browser tabs
 * @property activeTabId - The ID of the currently active tab
 * @property showTabOverview - Whether the tab overview UI is shown
 * @method addTab - Adds a new tab (optionally with a URL), returns the new tab's ID
 * @method closeTab - Closes a tab by ID
 * @method setActiveTab - Sets the active tab by ID
 * @method updateTab - Updates a tab's properties by ID
 * @method closeAllTabs - Closes all tabs
 * @method getActiveTab - Returns the currently active tab (if any)
 * @method isTabActive - Checks if a tab is the active tab
 * @method goToPage - Navigates a tab to a new URL
 * @method loadScreenshots - Loads screenshots for all tabs (async)
 * @method cleanupScreenshots - Removes screenshots for closed tabs (async)
 * @method setShowTabOverview - Sets the tab overview UI visibility
 */
interface BrowserTabsState {
  tabs: BrowserTab[];
  activeTabId: string | null;
  showTabOverview: boolean;
  activeWebViewIds: string[]; // Track which tabs have active WebViews
  addTab: (url?: string) => string; // Return the tab ID
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<BrowserTab>) => void;
  closeAllTabs: () => void;
  getActiveTab: () => BrowserTab | undefined;
  isTabActive: (tabId: string) => boolean;
  goToPage: (tabId: string, url: string) => void;
  loadScreenshots: () => Promise<void>;
  cleanupScreenshots: () => Promise<void>;
  setShowTabOverview: (show: boolean) => void;
  registerWebView: (tabId: string) => void;
  unregisterWebView: (tabId: string) => void;
  getWebViewDisposalCandidates: () => string[];
}

export const useBrowserTabsStore = create<BrowserTabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      showTabOverview: false,
      activeWebViewIds: [],

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

        return newTab.id;
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
            // Remove the tab from active WebView tracking
            activeWebViewIds: state.activeWebViewIds.filter(
              (id) => id !== tabId,
            ),
          };
        });

        // Clean up screenshot for closed tab
        removeTabScreenshot(tabId);
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
        set({ tabs: [], activeTabId: null, activeWebViewIds: [] });
        get().cleanupScreenshots();
      },

      getActiveTab: () => {
        const state = get();
        return state.tabs.find((tab) => tab.id === state.activeTabId);
      },

      isTabActive: (tabId: string) => {
        const state = get();
        return state.activeTabId === tabId;
      },

      goToPage: (tabId: string, url: string) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id === tabId) {
              // If we are navigating from existing webview to homepage we should
              // reset more of the tab state as the homepage is not actually a webview
              // e.g.: we can't "go back" or "go forward" from home using the web bottom navigator
              if (isHomepageUrl(url)) {
                return {
                  ...tab,
                  url,
                  lastAccessed: Date.now(),
                  canGoBack: false,
                  canGoForward: false,
                  screenshot: undefined,
                  logoUrl: undefined,
                };
              }

              // Otherwise we should just update the url so that the webview can navigate to it
              return {
                ...tab,
                url,
                screenshot: undefined,
                lastAccessed: Date.now(),
              };
            }

            return tab;
          }),
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
          try {
            const screenshot = await findTabScreenshot(tab.id);
            if (screenshot) {
              updatedTabs[index] = { ...tab, screenshot: screenshot.uri };
            }
          } catch (error) {
            // Ignore errors when loading screenshots
          }
        });

        await Promise.all(screenshotPromises);
        set({ tabs: updatedTabs });

        // Make sure to remove unused screenshots from storage
        get().cleanupScreenshots();
      },

      cleanupScreenshots: async () => {
        const state = get();
        const activeTabIds = state.tabs.map((tab) => tab.id);
        await pruneScreenshots(activeTabIds);
      },

      registerWebView: (tabId: string) => {
        set((state) => {
          const { activeWebViewIds } = state;

          // If WebView is already registered, don't add it again
          if (activeWebViewIds.includes(tabId)) {
            return state;
          }

          const newActiveWebViewIds = [...activeWebViewIds, tabId];

          // If we exceed the limit, we need to dispose of the oldest WebViews
          if (
            newActiveWebViewIds.length > BROWSER_CONSTANTS.MAX_ACTIVE_WEBVIEWS
          ) {
            // Keep only the most recent WebViews (including the new one)
            const excessCount =
              newActiveWebViewIds.length -
              BROWSER_CONSTANTS.MAX_ACTIVE_WEBVIEWS;
            const disposalCandidates = newActiveWebViewIds.slice(
              0,
              excessCount,
            );

            // Remove disposal candidates from the active list
            const filteredWebViewIds = newActiveWebViewIds.filter(
              (id) => !disposalCandidates.includes(id),
            );

            return {
              ...state,
              activeWebViewIds: filteredWebViewIds,
            };
          }

          return {
            ...state,
            activeWebViewIds: newActiveWebViewIds,
          };
        });
      },

      unregisterWebView: (tabId: string) => {
        set((state) => ({
          ...state,
          activeWebViewIds: state.activeWebViewIds.filter((id) => id !== tabId),
        }));
      },

      getWebViewDisposalCandidates: () => {
        const state = get();
        const { activeWebViewIds, tabs } = state;

        // Return tab IDs that have WebViews but are not in the active list
        return tabs
          .filter((tab) => !activeWebViewIds.includes(tab.id))
          .map((tab) => tab.id);
      },
    }),
    {
      name: "browser-tabs-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        tabs: state.tabs.map((tab) => ({
          ...tab,
          // Don't persist screenshots in tab storage - they're stored separately
          screenshot: undefined,
        })),
        activeTabId: state.activeTabId,
        // Note: showTabOverview is intentionally excluded from persistence
        // as it should always start as false when the app loads
      }),
      onRehydrateStorage: () => (state) => {
        // Load screenshots after store is rehydrated from storage
        if (state?.tabs && state.tabs.length > 0) {
          // Use setTimeout to ensure the store is fully rehydrated
          setTimeout(() => {
            state.loadScreenshots();
          }, 0);
        }
      },
    },
  ),
);
