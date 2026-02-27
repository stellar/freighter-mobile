/**
 * Protocol matching utilities
 * @fileoverview Helper functions for finding and matching protocols based on domain URLs
 */
import { DiscoverProtocol } from "config/types";
import { parse } from "tldts";

/**
 * Parameters for finding a matched protocol
 * @interface FindMatchedProtocolParams
 * @property {DiscoverProtocol[]} protocols - Array of protocols to search through
 * @property {string} [searchUrl] - Optional URL to match against protocol website URLs
 */
interface FindMatchedProtocolParams {
  protocols: DiscoverProtocol[];
  searchUrl?: string;
}

/**
 * Extracts the hostname from a URL using tldts for strict domain matching.
 * This is the security-critical function that prevents domain impersonation attacks.
 *
 * @param url - The URL to extract the hostname from (must be HTTPS)
 * @returns The hostname (normalized to lowercase by tldts), or null if invalid
 *
 * @note
 * - Only accepts HTTPS URLs (http:// URLs are rejected for security)
 * - Returns null for non-HTTPS URLs, IP addresses, localhost, or invalid URLs
 *
 * @example
 * getHostname("https://stellarx.com/path") // returns "stellarx.com"
 * getHostname("https://app.stellarx.com/path") // returns "app.stellarx.com"
 * getHostname("https://stellarx.com.evil.com") // returns "stellarx.com.evil.com"
 * getHostname("http://stellarx.com/path") // returns null (not HTTPS)
 * getHostname("mailto:stellarx.com/path") // returns null (not HTTPS)
 * getHostname("https://192.168.1.1") // returns null (IP address)
 */
export const getHostname = (url: string): string | null => {
  try {
    // Only accept HTTPS URLs (reject http:// and other protocols for security)
    if (new URL(url).protocol !== "https:") {
      return null;
    }

    const parsed = parse(url);
    // The 'hostname' property from tldts is the full hostname including subdomains
    // It returns null for IP addresses, invalid URLs, or localhost
    // Note: tldts normalizes hostnames to lowercase
    if (!parsed.hostname) {
      return null;
    }
    return parsed.hostname;
  } catch {
    return null;
  }
};

/**
 * Extracts the hostname from a URL for display purposes (UI-friendly).
 * Less strict than getHostname - allows localhost and http:// in development.
 * Use this for UI display only, NOT for security-critical operations.
 *
 * @param url - The URL to extract the hostname from
 * @returns The hostname (normalized to lowercase), or null if invalid
 *
 * @note
 * - Allows both HTTP and HTTPS protocols (unlike getHostname)
 * - Allows localhost and development domains
 * - Use this only for displaying domain information to users
 * - Do NOT use this for security checks or protocol matching
 *
 * @example
 * getDisplayHost("https://stellarx.com/path") // returns "stellarx.com"
 * getDisplayHost("http://localhost:3001") // returns "localhost"
 * getDisplayHost("http://192.168.1.1:8000") // returns "192.168.1.1"
 */
export const getDisplayHost = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
};

/**
 * Finds a matched protocol based on exact hostname matching (no subdomains).
 * This function uses secure domain parsing to prevent domain impersonation attacks.
 *
 * @function findMatchedProtocol
 * @description
 * Searches through a list of protocols to find a match based on exact hostname matching.
 * Uses tldts to extract the hostname from both the search URL and protocol website URLs,
 * then performs an exact match. Hostnames are normalized to lowercase by tldts.
 *
 * Security features:
 * - Only accepts HTTPS URLs (http:// URLs are rejected for security)
 * - Prevents subdomain attacks (e.g., "app.stellarx.com" won't match "stellarx.com")
 * - Prevents domain suffix attacks (e.g., "stellarx.com.evil.com" won't match "stellarx.com")
 * - Handles IP addresses and invalid URLs safely
 * - Requires exact hostname match (including subdomains)
 *
 * @param {FindMatchedProtocolParams} params - Object containing protocols array and optional search URL
 * @param {string} params.searchUrl - The URL to match (must be HTTPS)
 * @returns {DiscoverProtocol | undefined} The matched protocol or undefined if no match found
 *
 * @note
 * - If searchUrl is undefined or invalid, returns undefined
 * - Only accepts HTTPS URLs (http:// URLs are rejected)
 * - Hostname matching is exact (must match character-for-character, case-insensitive due to tldts normalization)
 * - Subdomains are NOT matched (e.g., "app.stellarx.com" will NOT match protocol with "stellarx.com")
 * - IP addresses and localhost are not matched
 *
 * @example
 * ```tsx
 * // Matches: exact hostname match
 * const matchedProtocol = findMatchedProtocol({
 *   protocols: protocolList,
 *   searchUrl: "https://stellarx.com"
 * });
 *
 * // Does NOT match: subdomain mismatch
 * const noMatch1 = findMatchedProtocol({
 *   protocols: protocolList,
 *   searchUrl: "https://app.stellarx.com"
 * });
 *
 * // Does NOT match: domain suffix attack
 * const noMatch2 = findMatchedProtocol({
 *   protocols: protocolList,
 *   searchUrl: "https://stellarx.com.evil.com"
 * });
 * ```
 */
export const findMatchedProtocol = ({
  protocols,
  searchUrl,
}: FindMatchedProtocolParams): DiscoverProtocol | undefined => {
  if (!searchUrl) {
    return undefined;
  }

  const searchHostname = getHostname(searchUrl);
  if (!searchHostname) {
    return undefined;
  }

  return protocols.find(({ websiteUrl }) => {
    const protocolHostname = getHostname(websiteUrl);
    if (!protocolHostname) {
      return false;
    }

    // Exact hostname match (tldts normalizes to lowercase)
    return searchHostname === protocolHostname;
  });
};
