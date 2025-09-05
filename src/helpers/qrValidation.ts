import { logger } from "config/logger";
import { isValidStellarAddress } from "helpers/stellar";

/**
 * Validates if a string is a valid WalletConnect URI
 * WalletConnect URIs typically start with "wc:" followed by a topic and version
 * Format: wc:{topic}@{version}?bridge={bridge}&key={key}
 *
 * @param uri The URI string to validate
 * @returns True if the URI appears to be a valid WalletConnect URI
 */
export const isValidWalletConnectURI = (uri: string): boolean => {
  try {
    // Must have a value to validate
    if (!uri || typeof uri !== "string" || uri.trim() === "") {
      return false;
    }

    const trimmedUri = uri.trim();

    // Check if it starts with "wc:" (WalletConnect protocol)
    if (!trimmedUri.startsWith("wc:")) {
      return false;
    }

    // simplified check
    const wcPattern = /^wc:[a-f0-9-]+@[0-9]+\?.*$/i;

    if (!wcPattern.test(trimmedUri)) {
      return false;
    }

    // Additional validation: check for required parameters
    // WalletConnect v1 URIs should contain bridge and key parameters
    // WalletConnect v2 URIs should contain relay-protocol and symKey parameters
    const hasBridge = trimmedUri.includes("bridge=");
    const hasKey = trimmedUri.includes("key=");
    const hasRelayProtocol = trimmedUri.includes("relay-protocol=");
    const hasSymKey = trimmedUri.includes("symKey=");

    // Support both v1 and v2 formats
    return (hasBridge && hasKey) || (hasRelayProtocol && hasSymKey);
  } catch (error) {
    logger.error(
      "QRValidation",
      "Error validating WalletConnect URI:",
      String(error),
    );
    return false;
  }
};

/**
 * Validates if a string is a valid Stellar address
 * This is a wrapper around the existing isValidStellarAddress function
 *
 * @param address The address string to validate
 * @returns True if the address is a valid Stellar address
 */
export const isValidStellarAddressForQR = (address: string): boolean =>
  isValidStellarAddress(address);

/**
 * Determines the type of QR code content and validates it accordingly
 *
 * @param content The QR code content to validate
 * @returns Object with validation result and detected type
 */
export const validateQRCodeContent = (content: string) => {
  const trimmedContent = content.trim();

  // Check if it's a WalletConnect URI
  if (isValidWalletConnectURI(trimmedContent)) {
    return {
      isValid: true,
      type: "walletconnect" as const,
      content: trimmedContent,
    };
  }

  // Check if it's a Stellar address
  if (isValidStellarAddressForQR(trimmedContent)) {
    return {
      isValid: true,
      type: "stellar_address" as const,
      content: trimmedContent,
    };
  }

  // Not a recognized valid format
  return {
    isValid: false,
    type: "unknown" as const,
    content: trimmedContent,
  };
};
