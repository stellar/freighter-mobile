/**
 * Protocol matching utilities
 * @fileoverview Helper functions for finding and matching protocols based on names and URLs
 */
import { DiscoverProtocol } from "config/types";
import { getDomainFromUrl } from "helpers/browser";

/**
 * Parameters for finding a matched protocol
 * @interface FindMatchedProtocolParams
 * @property {DiscoverProtocol[]} protocols - Array of protocols to search through
 * @property {string} [searchName] - Optional app name to match against protocol names
 * @property {string} [searchUrl] - Optional URL to match against protocol website URLs
 */
interface FindMatchedProtocolParams {
  protocols: DiscoverProtocol[];
  searchName?: string;
  searchUrl?: string;
}

/**
 * Finds a matched protocol based on name and domain matching
 * @function findMatchedProtocol
 * @description
 * Searches through a list of protocols to find a match based on:
 * 1. Name matching: Checks if the search name contains the protocol name (case-insensitive)
 * 2. Domain matching: Checks if the search URL contains the protocol's website domain
 *
 * Returns the first protocol that matches either condition. Name matching takes priority
 * over domain matching when both conditions are met.
 *
 * @param {FindMatchedProtocolParams} params - Object containing protocols array, search name, and optional search URL
 * @returns {DiscoverProtocol | undefined} The matched protocol or undefined if no match found
 *
 * @note
 * - If both searchName and searchUrl are undefined, returns undefined
 * - Matching is case-insensitive for both name and domain comparisons
 * - Partial matches are supported (e.g., "Stellar" will match "StellarX")
 *
 * @example
 * ```tsx
 * const matchedProtocol = findMatchedProtocol({
 *   protocols: protocolList,
 *   searchName: "StellarX",
 *   searchUrl: "https://stellarx.com"
 * });
 * ```
 */
export const findMatchedProtocol = ({
  protocols,
  searchName,
  searchUrl,
}: FindMatchedProtocolParams): DiscoverProtocol | undefined =>
  protocols.find(({ name, websiteUrl }) => {
    const matchedName =
      searchName?.toLowerCase().includes(name.toLowerCase()) || false;
    const matchedDomain =
      searchUrl?.includes(getDomainFromUrl(websiteUrl)) || false;
    return matchedName || matchedDomain;
  });
