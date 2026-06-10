import AsyncStorage from "@react-native-async-storage/async-storage";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import { BrowserTab } from "ducks/browserTabs";
import {
  getStoredScreenshots,
  findTabScreenshot,
  saveScreenshot,
  pruneScreenshots,
  clearAllScreenshots,
  captureTabScreenshot,
  removeTabScreenshot,
  migrateOldScreenshots,
  ScreenshotMeta,
} from "helpers/screenshots";
import ViewShot from "react-native-view-shot";

// Mock dependencies
jest.mock("@react-native-async-storage/async-storage");
jest.mock("config/logger");
jest.mock("react-native-view-shot");
jest.mock("helpers/screenshotCrypto", () => ({
  encryptScreenshot: jest.fn().mockResolvedValue("encrypted-base64"),
  decryptScreenshot: jest
    .fn()
    .mockResolvedValue("data:image/jpeg;base64,decrypted"),
}));
jest.mock("@dr.pogodin/react-native-fs", () => ({
  DocumentDirectoryPath: "/mock/documents",
  exists: jest.fn().mockResolvedValue(false),
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue("encrypted-base64"),
  unlink: jest.fn().mockResolvedValue(undefined),
  readDir: jest.fn().mockResolvedValue([]),
}));

import * as RNFS from "@dr.pogodin/react-native-fs";
import * as screenshotCrypto from "helpers/screenshotCrypto";

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockRNFS = RNFS as jest.Mocked<typeof RNFS>;
const mockCrypto = screenshotCrypto as jest.Mocked<typeof screenshotCrypto>;

const mockMeta: ScreenshotMeta = {
  tabId: "tab-123",
  tabUrl: "https://example.com",
  timestamp: 1234567890,
  file: "tab-123.enc",
};

const mockTab: BrowserTab = {
  id: "tab-123",
  url: "https://example.com",
  title: "Example",
  canGoBack: false,
  canGoForward: false,
  lastAccessed: 1234567890,
};

describe("screenshots helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockRNFS.exists as jest.Mock).mockResolvedValue(false);
  });

  describe("getStoredScreenshots", () => {
    it("should return empty Map when no screenshots stored", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getStoredScreenshots();

      expect(result).toEqual(new Map());
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(
        BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
      );
    });

    it("should return parsed metadata Map from storage", async () => {
      const storedData = JSON.stringify({ "tab-123": mockMeta });
      mockAsyncStorage.getItem.mockResolvedValue(storedData);

      const result = await getStoredScreenshots();
      const expectedMap = new Map([["tab-123", mockMeta]]);

      expect(result).toEqual(expectedMap);
    });

    it("should handle storage errors gracefully", async () => {
      const error = new Error("Storage error");
      mockAsyncStorage.getItem.mockRejectedValue(error);

      const result = await getStoredScreenshots();

      expect(result).toEqual(new Map());
      expect(mockLogger.error).toHaveBeenCalledWith(
        "screenshots",
        "Failed to get stored screenshots:",
        error,
      );
    });

    it("should handle invalid JSON gracefully", async () => {
      mockAsyncStorage.getItem.mockResolvedValue("invalid json");

      const result = await getStoredScreenshots();

      expect(result).toEqual(new Map());
      expect(mockLogger.error).toHaveBeenCalledWith(
        "screenshots",
        "Failed to get stored screenshots:",
        expect.any(Error),
      );
    });
  });

  describe("findTabScreenshot", () => {
    it("should return null when no metadata found", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({}));

      const result = await findTabScreenshot("tab-123");

      expect(result).toBeNull();
    });

    it("should return null when encrypted file is missing", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ "tab-123": mockMeta }),
      );
      (mockRNFS.exists as jest.Mock).mockResolvedValue(false);

      const result = await findTabScreenshot("tab-123");

      expect(result).toBeNull();
      // Stale metadata should be cleaned up
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it("should decrypt and return screenshot when file exists", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ "tab-123": mockMeta }),
      );
      (mockRNFS.exists as jest.Mock).mockResolvedValue(true);
      (mockRNFS.readFile as jest.Mock).mockResolvedValue("encrypted-base64");
      mockCrypto.decryptScreenshot.mockResolvedValue(
        "data:image/jpeg;base64,decrypted",
      );

      const result = await findTabScreenshot("tab-123");

      expect(result).toEqual({
        ...mockMeta,
        uri: "data:image/jpeg;base64,decrypted",
      });
      expect(mockRNFS.readFile).toHaveBeenCalledWith(
        "/mock/documents/tab-screenshots/tab-123.enc",
        "base64",
      );
      expect(mockCrypto.decryptScreenshot).toHaveBeenCalledWith(
        "encrypted-base64",
      );
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Storage error");
      mockAsyncStorage.getItem.mockRejectedValue(error);

      const result = await findTabScreenshot("tab-123");

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "screenshots",
        "Failed to get stored screenshots:",
        error,
      );
    });
  });

  describe("saveScreenshot", () => {
    it("should create directory, encrypt, write file, and update metadata", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({}));
      mockCrypto.encryptScreenshot.mockResolvedValue("encrypted-base64");

      await saveScreenshot("tab-123", "https://example.com", "data:image/jpeg;base64,raw");

      expect(mockRNFS.mkdir).toHaveBeenCalledWith(
        "/mock/documents/tab-screenshots",
      );
      expect(mockCrypto.encryptScreenshot).toHaveBeenCalledWith(
        "data:image/jpeg;base64,raw",
      );
      expect(mockRNFS.writeFile).toHaveBeenCalledWith(
        "/mock/documents/tab-screenshots/tab-123.enc",
        "encrypted-base64",
        "base64",
      );
      const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
      expect(savedData["tab-123"].tabId).toBe("tab-123");
      expect(savedData["tab-123"].file).toBe("tab-123.enc");
      expect(savedData["tab-123"].uri).toBeUndefined(); // no plaintext in storage
    });

    it("should skip mkdir when directory already exists", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({}));
      (mockRNFS.exists as jest.Mock).mockResolvedValue(true);

      await saveScreenshot("tab-123", "https://example.com", "data:image/jpeg;base64,raw");

      expect(mockRNFS.mkdir).not.toHaveBeenCalled();
    });

    it("should limit stored screenshots to MAX_SCREENSHOTS_STORED", async () => {
      const manyScreenshots = Object.fromEntries(
        Array.from({ length: 30 }, (_, i) => [
          `tab-${i}`,
          { tabId: `tab-${i}`, tabUrl: "https://example.com", timestamp: i, file: `tab-${i}.enc` },
        ]),
      );
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(manyScreenshots),
      );

      await saveScreenshot("tab-new", "https://example.com", "data:image/jpeg;base64,raw");

      const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
      expect(Object.keys(savedData).length).toBeLessThanOrEqual(
        BROWSER_CONSTANTS.MAX_SCREENSHOTS_STORED,
      );
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Storage error");
      mockAsyncStorage.getItem.mockRejectedValue(error);

      await expect(
        saveScreenshot("tab-123", "https://example.com", "data:image/jpeg;base64,raw"),
      ).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "screenshots",
        "Failed to get stored screenshots:",
        error,
      );
    });
  });

  describe("pruneScreenshots", () => {
    it("should delete files and keep only metadata for active tabs", async () => {
      const screenshotsMap = {
        "tab-1": { tabId: "tab-1", tabUrl: "https://a.com", timestamp: 1, file: "tab-1.enc" },
        "tab-2": { tabId: "tab-2", tabUrl: "https://b.com", timestamp: 2, file: "tab-2.enc" },
        "tab-3": { tabId: "tab-3", tabUrl: "https://c.com", timestamp: 3, file: "tab-3.enc" },
      };
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(screenshotsMap),
      );
      (mockRNFS.exists as jest.Mock).mockResolvedValue(true);

      await pruneScreenshots(["tab-1", "tab-3"]);

      // tab-2 file should be deleted
      expect(mockRNFS.unlink).toHaveBeenCalledWith(
        "/mock/documents/tab-screenshots/tab-2.enc",
      );
      const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
      expect(savedData["tab-1"]).toBeDefined();
      expect(savedData["tab-3"]).toBeDefined();
      expect(savedData["tab-2"]).toBeUndefined();
    });

    it("should remove all screenshots when no active tabs", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ "tab-1": { ...mockMeta, tabId: "tab-1" } }),
      );

      await pruneScreenshots([]);

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
      );
    });

    it("should handle storage errors gracefully", async () => {
      const error = new Error("Storage error");
      mockAsyncStorage.getItem.mockRejectedValue(error);

      await expect(pruneScreenshots(["tab-1"])).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "screenshots",
        "Failed to get stored screenshots:",
        error,
      );
    });
  });

  describe("removeTabScreenshot", () => {
    it("should delete file and remove metadata successfully", async () => {
      const screenshotsMap = {
        "tab-123": mockMeta,
        "other-tab": { ...mockMeta, tabId: "other-tab", file: "other-tab.enc" },
      };
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(screenshotsMap),
      );
      (mockRNFS.exists as jest.Mock).mockResolvedValue(true);

      const result = await removeTabScreenshot("tab-123");

      expect(result).toBe(true);
      expect(mockRNFS.unlink).toHaveBeenCalledWith(
        "/mock/documents/tab-screenshots/tab-123.enc",
      );
      const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
      expect(savedData["tab-123"]).toBeUndefined();
      expect(savedData["other-tab"]).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "removeTabScreenshot",
        "Screenshot removed for tab tab-123",
      );
    });

    it("should return true even if screenshot metadata doesn't exist", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ "other-tab": { ...mockMeta, tabId: "other-tab" } }),
      );

      const result = await removeTabScreenshot("non-existent");

      expect(result).toBe(true);
      expect(mockRNFS.unlink).not.toHaveBeenCalled();
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it("should handle storage errors gracefully", async () => {
      const error = new Error("Storage error");
      mockAsyncStorage.getItem.mockRejectedValue(error);

      const result = await removeTabScreenshot("tab-123");

      expect(result).toBe(true); // getStoredScreenshots returns empty Map on error
    });
  });

  describe("clearAllScreenshots", () => {
    it("should delete all files and remove AsyncStorage key", async () => {
      (mockRNFS.exists as jest.Mock).mockResolvedValue(true);
      (mockRNFS.readDir as jest.Mock).mockResolvedValue([
        { path: "/mock/documents/tab-screenshots/tab-1.enc" },
        { path: "/mock/documents/tab-screenshots/tab-2.enc" },
      ]);

      const result = await clearAllScreenshots();

      expect(result).toBe(true);
      expect(mockRNFS.unlink).toHaveBeenCalledWith(
        "/mock/documents/tab-screenshots/tab-1.enc",
      );
      expect(mockRNFS.unlink).toHaveBeenCalledWith(
        "/mock/documents/tab-screenshots/tab-2.enc",
      );
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "clearAllScreenshots",
        "All screenshots cleared successfully",
      );
    });

    it("should skip file deletion when directory does not exist", async () => {
      (mockRNFS.exists as jest.Mock).mockResolvedValue(false);

      const result = await clearAllScreenshots();

      expect(result).toBe(true);
      expect(mockRNFS.readDir).not.toHaveBeenCalled();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
      );
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Storage error");
      mockAsyncStorage.removeItem.mockRejectedValue(error);
      (mockRNFS.exists as jest.Mock).mockResolvedValue(false);

      const result = await clearAllScreenshots();

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "clearAllScreenshots",
        "Failed to clear screenshots:",
        error,
      );
    });
  });

  describe("migrateOldScreenshots", () => {
    it("should clear old blob when old uri format detected", async () => {
      const oldFormat = JSON.stringify({
        "tab-123": { tabId: "tab-123", tabUrl: "https://example.com", uri: "data:image/jpeg;base64,old", timestamp: 1 },
      });
      mockAsyncStorage.getItem.mockResolvedValue(oldFormat);

      await migrateOldScreenshots();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        BROWSER_CONSTANTS.SCREENSHOT_STORAGE_KEY,
      );
    });

    it("should be a no-op when new file format is present", async () => {
      const newFormat = JSON.stringify({
        "tab-123": mockMeta, // has 'file', no 'uri'
      });
      mockAsyncStorage.getItem.mockResolvedValue(newFormat);

      await migrateOldScreenshots();

      expect(mockAsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it("should be a no-op when AsyncStorage is empty", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await migrateOldScreenshots();

      expect(mockAsyncStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  describe("captureTabScreenshot", () => {
    const mockUpdateTab = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      (mockRNFS.exists as jest.Mock).mockResolvedValue(false);
    });

    it("should capture, encrypt, save, and update tab state", async () => {
      const mockUri = "data:image/jpeg;base64,captured";
      const mockViewShotRef = {
        capture: jest.fn().mockResolvedValue(mockUri),
      } as unknown as ViewShot;
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({}));

      await captureTabScreenshot({
        viewShotRef: mockViewShotRef,
        tabId: "tab-123",
        tabs: [mockTab],
        updateTab: mockUpdateTab,
        source: "test",
      });

      expect(mockCrypto.encryptScreenshot).toHaveBeenCalledWith(mockUri);
      expect(mockUpdateTab).toHaveBeenCalledWith("tab-123", { screenshot: mockUri });
    });

    it("should not capture if viewShotRef is null", async () => {
      await captureTabScreenshot({
        viewShotRef: null,
        tabId: "tab-123",
        tabs: [mockTab],
        updateTab: mockUpdateTab,
        source: "test",
      });

      expect(mockUpdateTab).not.toHaveBeenCalled();
    });

    it("should not capture if tab is not found", async () => {
      const mockViewShotRef = {
        capture: jest.fn().mockResolvedValue("data:image/jpeg;base64,test"),
      } as unknown as ViewShot;

      await captureTabScreenshot({
        viewShotRef: mockViewShotRef,
        tabId: "non-existent",
        tabs: [mockTab],
        updateTab: mockUpdateTab,
        source: "test",
      });

      expect(mockUpdateTab).not.toHaveBeenCalled();
    });

    it("should handle capture errors gracefully", async () => {
      const error = new Error("Capture error");
      const mockViewShotRef = {
        capture: jest.fn().mockRejectedValue(error),
      } as unknown as ViewShot;

      await expect(
        captureTabScreenshot({
          viewShotRef: mockViewShotRef,
          tabId: "tab-123",
          tabs: [mockTab],
          updateTab: mockUpdateTab,
          source: "test",
        }),
      ).resolves.not.toThrow();
    });

    it("should handle save errors gracefully", async () => {
      const mockViewShotRef = {
        capture: jest.fn().mockResolvedValue("data:image/jpeg;base64,test"),
      } as unknown as ViewShot;
      mockCrypto.encryptScreenshot.mockRejectedValueOnce(
        new Error("Encrypt error"),
      );

      await expect(
        captureTabScreenshot({
          viewShotRef: mockViewShotRef,
          tabId: "tab-123",
          tabs: [mockTab],
          updateTab: mockUpdateTab,
          source: "test",
        }),
      ).resolves.not.toThrow();
    });
  });
});
