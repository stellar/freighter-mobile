/**
 * Protocol matching utilities
 * @fileoverview Helper functions for finding and matching protocols based on domain URLs
 */
import { DiscoverProtocol } from "config/types";
import { getDomainFromUrl } from "helpers/browser";

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
 * Finds a matched protocol based on domain matching
 * @function findMatchedProtocol
 * @description
 * Searches through a list of protocols to find a match based on domain matching.
 * Checks if the search URL contains the protocol's website domain.
 *
 * @param {FindMatchedProtocolParams} params - Object containing protocols array and optional search URL
 * @returns {DiscoverProtocol | undefined} The matched protocol or undefined if no match found
 *
 * @note
 * - If searchUrl is undefined, returns undefined
 * - Domain matching is case-insensitive
 * - Supports subdomains (e.g., "app.stellarx.com" matches "stellarx.com")
 *
 * @example
 * ```tsx
 * const matchedProtocol = findMatchedProtocol({
 *   protocols: protocolList,
 *   searchUrl: "https://stellarx.com"
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

  return protocols.find(({ websiteUrl }) => {
    const protocolDomain = getDomainFromUrl(websiteUrl);
    if (!protocolDomain) {
      return false;
    }

    return searchUrl.includes(protocolDomain);
  });
};
