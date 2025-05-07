import { StrKey } from "@stellar/stellar-sdk";
import { logger } from "config/logger";
import { isContractId } from "helpers/soroban";

/**
 * Checks if an address is a federation address (username*domain.com format)
 *
 * @param address The address to check
 * @returns True if the address is a federation address
 */
export const isFederationAddress = (address: string): boolean => {
  const federationAddressRegex = /^[^*@]+\*[^*@]+(\.[^*@]+)+$/;
  return federationAddressRegex.test(address);
};

/**
 * Checks if a public key is valid (ED25519, MED25519, contract ID, or federation address)
 *
 * @param publicKey The public key to check
 * @returns True if the public key is valid
 */
export const isValidStellarAddress = (publicKey: string): boolean => {
  try {
    if (StrKey.isValidEd25519PublicKey(publicKey)) {
      return true;
    }

    if (StrKey.isValidMed25519PublicKey(publicKey)) {
      return true;
    }

    if (isContractId(publicKey)) {
      return true;
    }

    if (isFederationAddress(publicKey)) {
      return true;
    }

    return false;
  } catch (error) {
    logger.error("Error validating Stellar address:", String(error));
    return false;
  }
};

/**
 * Truncates a Stellar address for display
 *
 * @param address The full Stellar address
 * @param prefixChars Number of characters to keep at the beginning
 * @param suffixChars Number of characters to keep at the end
 * @returns The truncated address
 */
export const truncateAddress = (
  address: string,
  prefixChars = 4,
  suffixChars = 4,
): string => {
  if (!address) {
    return "";
  }

  // For federation addresses, keep them as is
  if (isFederationAddress(address)) {
    return address;
  }

  // For Stellar addresses
  if (address.length <= prefixChars + suffixChars) {
    return address;
  }

  const prefix = address.slice(0, prefixChars);
  const suffix = address.slice(-suffixChars);

  return `${prefix}...${suffix}`;
};
