/**
 * Helper functions for formatting addresses
 */

/**
 * Truncates an address to show only the first n and last m characters
 * with an ellipsis in between.
 *
 * @param {string} address - The address to truncate
 * @param {number} [prefixLength=4] - Number of characters to show at the beginning
 * @param {number} [suffixLength=4] - Number of characters to show at the end
 * @returns {string} The truncated address with ellipsis
 *
 * @example
 * truncateAddress("GBQZGOCUYJFZB7WSDMFWJ2NDLXUFS7XK4WPIW4UR4TLQFFZGHC77T5NL");
 * // Returns "GBQZ...T5NL"
 *
 * truncateAddress("GBQZGOCUYJFZB7WSDMFWJ2NDLXUFS7XK4WPIW4UR4TLQFFZGHC77T5NL", 6, 4);
 * // Returns "GBQZGO...T5NL"
 */
export const truncateAddress = (
  address: string,
  prefixLength = 4,
  suffixLength = 4,
): string => {
  if (!address) return "";
  if (address.length <= prefixLength + suffixLength + 3) return address;

  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
};
