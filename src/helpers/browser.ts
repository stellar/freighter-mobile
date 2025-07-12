import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";

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
