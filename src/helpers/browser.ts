import CookieManager from "@react-native-cookies/cookies";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import { clearAllScreenshots } from "helpers/screenshots";

/**
 * Checks if the given URL is the homepage URL.
 * @param url - The URL to check
 * @returns True if the URL is the homepage, false otherwise
 */
export const isHomepageUrl = (url: string): boolean =>
  !url || url === BROWSER_CONSTANTS.HOMEPAGE_URL;

/**
 * Generates a favicon URL from a website URL.
 * @param url - The website URL
 * @returns The favicon URL, or an empty string if invalid
 */
export const getFaviconUrl = (url: string): string => {
  if (isHomepageUrl(url)) {
    return "";
  }

  try {
    const urlObj = new URL(url);
    const faviconUrl = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
    return faviconUrl;
  } catch (error) {
    logger.debug("getFaviconUrl", "Failed to extract favicon:", url, error);
    return "";
  }
};

/**
 * Normalizes user input into a valid URL or Google search URL.
 * Adds https:// if needed, or converts to a search if not a URL.
 * @param input - The user input string
 * @returns An object with the normalized URL and a boolean indicating if it's a search
 */
export const normalizeUrl = (
  input: string,
): { url: string; isSearch: boolean } => {
  const trimmed = input.trim();

  // Check if it's already a valid URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return { url: trimmed, isSearch: false };
  }

  // Check if it looks like a domain (contains . and no spaces)
  if (trimmed.includes(".") && !trimmed.includes(" ")) {
    return { url: `https://${trimmed}`, isSearch: false };
  }

  // If it's not a URL, treat it as a Google search query
  const searchQuery = encodeURIComponent(trimmed);
  const searchUrl = `${BROWSER_CONSTANTS.GOOGLE_SEARCH_BASE_URL}${searchQuery}`;
  return { url: searchUrl, isSearch: true };
};

/**
 * Extracts the search query from a Google search URL.
 * @param url - The URL to extract the search query from
 * @returns The search query string, or null if not a Google search URL
 */
export const extractSearchQuery = (url: string): string | null => {
  if (!url.startsWith(BROWSER_CONSTANTS.GOOGLE_SEARCH_BASE_URL)) {
    return null;
  }

  try {
    const urlObj = new URL(url);
    const searchQuery = urlObj.searchParams.get("q");
    const decodedSearchQuery = searchQuery
      ? decodeURIComponent(searchQuery)
      : null;
    return decodedSearchQuery;
  } catch {
    return null;
  }
};

/**
 * Formats a display URL for the input field, showing search queries or the original URL.
 * @param url - The URL to format
 * @returns The formatted display string
 */
export const formatDisplayUrl = (url: string): string => {
  if (isHomepageUrl(url)) {
    return "";
  }

  const searchQuery = extractSearchQuery(url);
  if (searchQuery) {
    return searchQuery;
  }

  return url;
};

/**
 * Generates a unique tab ID based on the current timestamp.
 * @returns A string representing the unique tab ID
 */
export const generateTabId = (): string => Date.now().toString();

/**
 * Clears all cookies from WebView instances. Called during logout for security reasons.
 * @returns Promise<boolean> - True if cookies were cleared successfully, false otherwise
 */
export const clearAllCookies = async (): Promise<boolean> => {
  try {
    logger.debug("clearAllCookies", "Starting cookie cleanup");

    // Clear all cookies using CookieManager
    const result = await CookieManager.clearAll(true); // true = useWebKit for WebView

    if (result) {
      logger.debug("clearAllCookies", "All cookies cleared successfully");
    } else {
      logger.warn("clearAllCookies", "Cookie cleanup may have failed");
    }

    return result;
  } catch (error) {
    logger.error("clearAllCookies", "Failed to clear cookies", error);

    return false;
  }
};

/**
 * Clears all WebView data including cookies and screenshots. Called during logout for security reasons.
 * @returns Promise<boolean> - True if cleanup was successful, false otherwise
 */
export const clearAllWebViewData = async (): Promise<boolean> => {
  try {
    logger.debug("clearAllWebViewData", "Starting WebView data cleanup");

    // Clear cookies and screenshots in parallel
    const [cookieResult, screenshotResult] = await Promise.all([
      clearAllCookies(),
      clearAllScreenshots(),
    ]);

    const success = cookieResult && screenshotResult;
    if (success) {
      logger.debug(
        "clearAllWebViewData",
        "WebView data cleanup completed successfully",
      );
    } else {
      logger.warn(
        "clearAllWebViewData",
        "WebView data cleanup may have failed",
      );
    }

    return success;
  } catch (error) {
    logger.error("clearAllWebViewData", "Failed to clear WebView data", error);

    return false;
  }
};
