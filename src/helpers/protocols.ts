import { DiscoverProtocol } from "config/types";
import { getDomainFromUrl } from "helpers/browser";

interface FindMatchedProtocolParams {
  protocols: DiscoverProtocol[];
  searchName?: string;
  searchUrl?: string;
}

/**
 * Finds a matched protocol based on name and domain matching
 * @param params - Object containing protocols array, search name, and optional search URL
 * @returns The matched protocol or undefined if no match found
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
