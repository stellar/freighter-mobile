import CookieManager from "@react-native-cookies/cookies";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import {
  isHomepageUrl,
  getDomainFromUrl,
  getFaviconUrl,
  normalizeUrl,
  extractSearchQuery,
  formatDisplayUrl,
  generateTabId,
  clearAllCookies,
  clearAllWebViewData,
} from "helpers/browser";
import { clearAllScreenshots } from "helpers/screenshots";

// Mock dependencies
jest.mock("@react-native-cookies/cookies");
jest.mock("config/logger");
jest.mock("helpers/screenshots");

const mockCookieManager = CookieManager as jest.Mocked<typeof CookieManager>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockClearAllScreenshots = clearAllScreenshots as jest.MockedFunction<
  typeof clearAllScreenshots
>;

describe("browser helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(1234567890);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("isHomepageUrl", () => {
    it("should return true for empty URL", () => {
      expect(isHomepageUrl("")).toBe(true);
    });

    it("should return true for null/undefined URL", () => {
      expect(isHomepageUrl(null as unknown as string)).toBe(true);
      expect(isHomepageUrl(undefined as unknown as string)).toBe(true);
    });

    it("should return true for homepage URL", () => {
      expect(isHomepageUrl(BROWSER_CONSTANTS.HOMEPAGE_URL)).toBe(true);
    });

    it("should return false for other URLs", () => {
      expect(isHomepageUrl("https://example.com")).toBe(false);
      expect(isHomepageUrl("http://google.com")).toBe(false);
    });
  });

  describe("getDomainFromUrl", () => {
    it("should return empty string for homepage", () => {
      expect(getDomainFromUrl("")).toBe("");
      expect(getDomainFromUrl(BROWSER_CONSTANTS.HOMEPAGE_URL)).toBe("");
    });

    it("should extract domain from valid URLs", () => {
      expect(getDomainFromUrl("https://www.example.com")).toBe("example.com");
      expect(getDomainFromUrl("http://example.com/path")).toBe("example.com");
      expect(getDomainFromUrl("https://sub.example.com")).toBe(
        "sub.example.com",
      );
    });

    it("should handle URLs without www", () => {
      expect(getDomainFromUrl("https://example.com")).toBe("example.com");
    });

    it("should return original URL for invalid URLs", () => {
      expect(getDomainFromUrl("not-a-url")).toBe("not-a-url");
      expect(getDomainFromUrl("invalid://url")).toBe("url");
    });

    it("should handle URLs with ports", () => {
      expect(getDomainFromUrl("https://example.com:8080")).toBe("example.com");
    });
  });

  describe("getFaviconUrl", () => {
    it("should return empty string for homepage", () => {
      expect(getFaviconUrl("")).toBe("");
      expect(getFaviconUrl(BROWSER_CONSTANTS.HOMEPAGE_URL)).toBe("");
    });

    it("should generate favicon URL for valid URLs", () => {
      expect(getFaviconUrl("https://example.com")).toBe(
        "https://example.com/favicon.ico",
      );
      expect(getFaviconUrl("http://www.google.com")).toBe(
        "http://www.google.com/favicon.ico",
      );
    });

    it("should handle URLs with paths", () => {
      expect(getFaviconUrl("https://example.com/path")).toBe(
        "https://example.com/favicon.ico",
      );
    });

    it("should return empty string for invalid URLs", () => {
      expect(getFaviconUrl("not-a-url")).toBe("");
      const { calls } = mockLogger.debug.mock;
      expect(calls[0][0]).toBe("getFaviconUrl");
      expect(calls[0][1]).toBe("Failed to extract favicon:");
      expect(calls[0][2]).toBe("not-a-url");
      expect(calls[0][3]).toBeDefined();
      expect((calls[0][3] as Error).message).toMatch(/Invalid URL/);
    });
  });

  describe("normalizeUrl", () => {
    it("should return valid URLs as-is", () => {
      expect(normalizeUrl("https://example.com")).toEqual({
        url: "https://example.com",
        isSearch: false,
      });
      expect(normalizeUrl("http://google.com")).toEqual({
        url: "http://google.com",
        isSearch: false,
      });
    });

    it("should add https:// to domain-like inputs", () => {
      expect(normalizeUrl("example.com")).toEqual({
        url: "https://example.com",
        isSearch: false,
      });
      expect(normalizeUrl("www.google.com")).toEqual({
        url: "https://www.google.com",
        isSearch: false,
      });
    });

    it("should convert search queries to Google search", () => {
      expect(normalizeUrl("react native")).toEqual({
        url: `${BROWSER_CONSTANTS.GOOGLE_SEARCH_BASE_URL}react%20native`,
        isSearch: true,
      });
      expect(normalizeUrl("  test query  ")).toEqual({
        url: `${BROWSER_CONSTANTS.GOOGLE_SEARCH_BASE_URL}test%20query`,
        isSearch: true,
      });
    });

    it("should handle empty input", () => {
      expect(normalizeUrl("")).toEqual({
        url: `${BROWSER_CONSTANTS.GOOGLE_SEARCH_BASE_URL}`,
        isSearch: true,
      });
    });

    it("should handle special characters in search queries", () => {
      expect(normalizeUrl("test & query")).toEqual({
        url: `${BROWSER_CONSTANTS.GOOGLE_SEARCH_BASE_URL}test%20%26%20query`,
        isSearch: true,
      });
    });
  });

  describe("extractSearchQuery", () => {
    it("should extract search query from Google search URL", () => {
      expect(
        extractSearchQuery(
          `${BROWSER_CONSTANTS.GOOGLE_SEARCH_BASE_URL}test%20query`,
        ),
      ).toBe("test query");
      expect(
        extractSearchQuery(
          `${BROWSER_CONSTANTS.GOOGLE_SEARCH_BASE_URL}react%20native`,
        ),
      ).toBe("react native");
    });

    it("should return null for non-Google search URLs", () => {
      expect(extractSearchQuery("https://example.com")).toBeNull();
      expect(extractSearchQuery("https://google.com/search?q=test")).toBeNull();
    });

    it("should return null for invalid URLs", () => {
      expect(extractSearchQuery("not-a-url")).toBeNull();
    });

    it("should handle URLs without search parameters", () => {
      expect(
        extractSearchQuery(`${BROWSER_CONSTANTS.GOOGLE_SEARCH_BASE_URL}`),
      ).toBeNull();
    });
  });

  describe("formatDisplayUrl", () => {
    it("should return empty string for homepage", () => {
      expect(formatDisplayUrl("")).toBe("");
      expect(formatDisplayUrl(BROWSER_CONSTANTS.HOMEPAGE_URL)).toBe("");
    });

    it("should return search query for Google search URLs", () => {
      expect(
        formatDisplayUrl(
          `${BROWSER_CONSTANTS.GOOGLE_SEARCH_BASE_URL}test%20query`,
        ),
      ).toBe("test query");
    });

    it("should return original URL for non-search URLs", () => {
      expect(formatDisplayUrl("https://example.com")).toBe(
        "https://example.com",
      );
      expect(formatDisplayUrl("http://google.com")).toBe("http://google.com");
    });
  });

  describe("generateTabId", () => {
    it("should return timestamp as string", () => {
      expect(generateTabId()).toBe("1234567890");
    });

    it("should return different IDs for different timestamps", () => {
      const firstId = generateTabId();
      jest.spyOn(Date, "now").mockReturnValue(1234567891);
      const secondId = generateTabId();

      expect(firstId).toBe("1234567890");
      expect(secondId).toBe("1234567891");
      expect(firstId).not.toBe(secondId);
    });
  });

  describe("clearAllCookies", () => {
    it("should clear cookies successfully", async () => {
      mockCookieManager.clearAll.mockResolvedValue(true);

      const result = await clearAllCookies();

      expect(mockCookieManager.clearAll).toHaveBeenCalledWith(true);
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "clearAllCookies",
        "Starting cookie cleanup",
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "clearAllCookies",
        "All cookies cleared successfully",
      );
    });

    it("should handle failed cookie cleanup", async () => {
      mockCookieManager.clearAll.mockResolvedValue(false);

      const result = await clearAllCookies();

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "clearAllCookies",
        "Cookie cleanup may have failed",
      );
    });

    it("should handle errors during cookie cleanup", async () => {
      const error = new Error("Cookie error");
      mockCookieManager.clearAll.mockRejectedValue(error);

      const result = await clearAllCookies();

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "clearAllCookies",
        "Failed to clear cookies",
        error,
      );
    });
  });

  describe("clearAllWebViewData", () => {
    it("should clear both cookies and screenshots successfully", async () => {
      mockCookieManager.clearAll.mockResolvedValue(true);
      mockClearAllScreenshots.mockResolvedValue(true);

      const result = await clearAllWebViewData();

      expect(mockCookieManager.clearAll).toHaveBeenCalledWith(true);
      expect(mockClearAllScreenshots).toHaveBeenCalled();
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "clearAllWebViewData",
        "Starting WebView data cleanup",
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "clearAllWebViewData",
        "WebView data cleanup completed successfully",
      );
    });

    it("should handle partial failure", async () => {
      mockCookieManager.clearAll.mockResolvedValue(true);
      mockClearAllScreenshots.mockResolvedValue(false);

      const result = await clearAllWebViewData();

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "clearAllWebViewData",
        "WebView data cleanup may have failed",
      );
    });

    it("should handle complete failure", async () => {
      mockCookieManager.clearAll.mockResolvedValue(false);
      mockClearAllScreenshots.mockResolvedValue(false);

      const result = await clearAllWebViewData();

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "clearAllWebViewData",
        "WebView data cleanup may have failed",
      );
    });

    it("should handle errors during cleanup", async () => {
      const error = new Error("Cleanup error");
      mockCookieManager.clearAll.mockRejectedValue(error);

      const result = await clearAllWebViewData();

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "clearAllCookies",
        "Failed to clear cookies",
        error,
      );
    });
  });
});
