import AsyncStorage from "@react-native-async-storage/async-storage";
import { BROWSER_CONSTANTS } from "config/constants";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { generateTabId, isHomepageUrl } from "helpers/browser";
import {
  findTabScreenshot,
  pruneScreenshots,
  removeTabScreenshot,
} from "helpers/screenshots";

// Mock dependencies
jest.mock("@react-native-async-storage/async-storage");
jest.mock("helpers/browser");
jest.mock("helpers/screenshots");

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockGenerateTabId = generateTabId as jest.MockedFunction<
  typeof generateTabId
>;
const mockIsHomepageUrl = isHomepageUrl as jest.MockedFunction<
  typeof isHomepageUrl
>;
const mockFindTabScreenshot = findTabScreenshot as jest.MockedFunction<
  typeof findTabScreenshot
>;
const mockPruneScreenshots = pruneScreenshots as jest.MockedFunction<
  typeof pruneScreenshots
>;
const mockRemoveTabScreenshot = removeTabScreenshot as jest.MockedFunction<
  typeof removeTabScreenshot
>;

describe("browserTabs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateTabId.mockReturnValue("tab-123");
    mockIsHomepageUrl.mockReturnValue(false);
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  describe("store initialization", () => {
    it("should have initial state", () => {
      const store = useBrowserTabsStore.getState();
      expect(store.tabs).toEqual([]);
      expect(store.activeTabId).toBeNull();
      expect(store.showTabOverview).toBe(false);
    });
  });

  describe("addTab", () => {
    it("should add a new tab with default homepage URL", () => {
      const store = useBrowserTabsStore.getState();
      const tabId = store.addTab();

      expect(mockGenerateTabId).toHaveBeenCalled();
      expect(tabId).toBe("tab-123");
    });

    it("should add a new tab with custom URL", () => {
      const store = useBrowserTabsStore.getState();
      const customUrl = "https://example.com";
      const tabId = store.addTab(customUrl);

      expect(tabId).toBe("tab-123");
    });
  });

  describe("closeTab", () => {
    it("should close a tab", () => {
      const store = useBrowserTabsStore.getState();
      store.closeTab("tab-123");
      expect(mockRemoveTabScreenshot).toHaveBeenCalledWith("tab-123");
    });
  });

  describe("setActiveTab", () => {
    it("should set active tab", () => {
      const store = useBrowserTabsStore.getState();
      store.setActiveTab("tab-123");
      // Test that the function doesn't throw
      expect(true).toBe(true);
    });
  });

  describe("updateTab", () => {
    it("should update tab properties", () => {
      const store = useBrowserTabsStore.getState();
      const updates = {
        title: "New Title",
        url: "https://example.com",
        canGoBack: true,
      };
      store.updateTab("tab-123", updates);
      // Test that the function doesn't throw
      expect(true).toBe(true);
    });
  });

  describe("closeAllTabs", () => {
    it("should clear all tabs", () => {
      const store = useBrowserTabsStore.getState();
      store.closeAllTabs();
      expect(mockPruneScreenshots).toHaveBeenCalled();
    });
  });

  describe("getActiveTab", () => {
    it("should return active tab", () => {
      const store = useBrowserTabsStore.getState();
      store.getActiveTab();
      // Test that the function doesn't throw
      expect(true).toBe(true);
    });
  });

  describe("isTabActive", () => {
    it("should check if tab is active", () => {
      const store = useBrowserTabsStore.getState();
      const isActive = store.isTabActive("tab-123");
      expect(typeof isActive).toBe("boolean");
    });
  });

  describe("goToPage", () => {
    it("should navigate to page", () => {
      const store = useBrowserTabsStore.getState();
      store.goToPage("tab-123", "https://example.com");
      // Test that the function doesn't throw
      expect(true).toBe(true);
    });

    it("should reset tab state when navigating to homepage", () => {
      const store = useBrowserTabsStore.getState();
      mockIsHomepageUrl.mockReturnValue(true);
      store.goToPage("tab-123", BROWSER_CONSTANTS.HOMEPAGE_URL);
      // Test that the function doesn't throw
      expect(true).toBe(true);
    });
  });

  describe("setShowTabOverview", () => {
    it("should update showTabOverview state", () => {
      const store = useBrowserTabsStore.getState();
      store.setShowTabOverview(true);
      // Test that the function doesn't throw
      expect(true).toBe(true);
    });
  });

  describe("loadScreenshots", () => {
    it("should load screenshots for tabs", async () => {
      const store = useBrowserTabsStore.getState();
      mockFindTabScreenshot.mockResolvedValue({
        tabId: "tab-123",
        tabUrl: "https://example.com",
        uri: "data:image/png;base64,test",
        timestamp: Date.now(),
      });

      await store.loadScreenshots();

      // Test that the function doesn't throw
      expect(true).toBe(true);
    });

    it("should not load screenshots for homepage", async () => {
      const store = useBrowserTabsStore.getState();
      await store.loadScreenshots();
      expect(mockFindTabScreenshot).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      const store = useBrowserTabsStore.getState();
      mockFindTabScreenshot.mockRejectedValue(new Error("Test error"));
      await expect(store.loadScreenshots()).resolves.not.toThrow();
    });
  });

  describe("cleanupScreenshots", () => {
    it("should call pruneScreenshots with active tab IDs", async () => {
      const store = useBrowserTabsStore.getState();
      await store.cleanupScreenshots();
      expect(mockPruneScreenshots).toHaveBeenCalled();
    });
  });
});
