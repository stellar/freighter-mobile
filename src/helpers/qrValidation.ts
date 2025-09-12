import { QRCodeType, QRCodeError } from "config/constants";
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
 * Validates QR code content for wallet address (send flow specific)
 * Checks if the content is a valid Stellar address and handles self-send detection
 *
 * @param content The QR code content to validate
 * @param currentUserPublicKey Optional current user's public key for self-send detection
 * @returns Object with validation result and detected type
 */
export const validateQRCodeWalletAddress = (
  content: string,
  currentUserPublicKey?: string,
) => {
  const trimmedContent = content.trim();

  // Check if it's a Stellar address
  if (isValidStellarAddressForQR(trimmedContent)) {
    // Check for self-send if current user's public key is provided
    if (currentUserPublicKey && trimmedContent === currentUserPublicKey) {
      return {
        isValid: false,
        type: QRCodeType.STELLAR_ADDRESS,
        content: trimmedContent,
        error: QRCodeError.SELF_SEND,
      };
    }

    return {
      isValid: true,
      type: QRCodeType.STELLAR_ADDRESS,
      content: trimmedContent,
    };
  }

  // Not a valid Stellar address
  return {
    isValid: false,
    type: QRCodeType.UNKNOWN,
    content: trimmedContent,
    error: QRCodeError.INVALID_FORMAT,
  };
};
