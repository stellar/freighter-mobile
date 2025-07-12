import CookieManager from "@react-native-cookies/cookies";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import { clearAllScreenshots } from "helpers/screenshots";

/**
 * Checks if URL is the homepage
 */
export const isHomepageUrl = (url: string): boolean =>
  !url || url === BROWSER_CONSTANTS.HOMEPAGE_URL;

/**
 * Extracts domain from URL for display purposes
 */
export const getDomainFromUrl = (url: string): string => {
  if (isHomepageUrl(url)) {
    return "";
  }

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace("www.", "");
    return domain;
  } catch {
    return url;
  }
};

/**
 * Generates favicon URL from website URL
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
 * Normalizes URL input (adds https:// if needed, converts to Google search if not a URL)
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
 * Extracts search query from Google search URL
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
 * Formats display URL for input field
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
 * Generates unique tab ID
 */
export const generateTabId = (): string => Date.now().toString();

/**
 * Clears all cookies from WebView instances
 * This is called during logout for security reasons to prevent data leakage
 *
 * @returns Promise<boolean> - True if cookies were cleared successfully
 */
export const clearAllCookies = async (): Promise<boolean> => {
  try {
    logger.info("clearAllCookies", "Starting cookie cleanup");

    // Clear all cookies using CookieManager
    const result = await CookieManager.clearAll(true); // true = useWebKit for WebView

    if (result) {
      logger.info("clearAllCookies", "All cookies cleared successfully");
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
 * Clears all WebView data including cookies and screenshots
 * This is called during logout for security reasons to prevent data leakage
 *
 * @returns Promise<boolean> - True if cleanup was successful
 */
export const clearAllWebViewData = async (): Promise<boolean> => {
  try {
    logger.info("clearAllWebViewData", "Starting WebView data cleanup");

    // Clear cookies and screenshots in parallel
    const [cookieResult, screenshotResult] = await Promise.all([
      clearAllCookies(),
      clearAllScreenshots(),
    ]);

    const success = cookieResult && screenshotResult;
    if (success) {
      logger.info(
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
