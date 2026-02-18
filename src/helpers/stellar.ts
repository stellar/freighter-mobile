import {
  Account,
  hash,
  Keypair,
  MuxedAccount,
  StrKey,
} from "@stellar/stellar-sdk";
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
 * Checks if an address is a muxed account (M... format)
 *
 * @param address The address to check
 * @returns True if the address is a muxed account
 */
export const isMuxedAccount = (address: string): boolean =>
  StrKey.isValidMed25519PublicKey(address);

/**
 * Extracts the base ED25519 account (G...) from a muxed account (M...)
 *
 * @param muxedAddress The muxed account address
 * @returns The base account address or null if conversion fails
 */
export const getBaseAccount = (muxedAddress: string): string | null => {
  try {
    if (isMuxedAccount(muxedAddress)) {
      const mAccount = MuxedAccount.fromAddress(muxedAddress, "0");
      return mAccount.baseAccount().accountId();
    }
    return muxedAddress;
  } catch (error) {
    logger.error("StellarHelper", "Error extracting base account:", error);

    return null;
  }
};

/**
 * Creates a muxed account address from a base account and a muxed ID (memo)
 * This is used for CAP-0067 to support memo in Soroban transfers
 *
 * @param baseAccount The base ED25519 account (G...)
 * @param muxedId The muxed ID (memo) as a string or number
 * @returns The muxed account address (M...) or null if conversion fails
 */
export const createMuxedAccount = (
  baseAccount: string,
  muxedId: string | number,
): string | null => {
  try {
    if (!StrKey.isValidEd25519PublicKey(baseAccount)) {
      logger.error(
        "StellarHelper",
        "Invalid base account for muxed account creation",
        { baseAccount },
      );
      return null;
    }

    // Create a minimal Account object for MuxedAccount constructor
    const account = new Account(baseAccount, "0");
    const muxedAccount = new MuxedAccount(account, String(muxedId));
    const muxedAddress = muxedAccount.accountId();

    return muxedAddress;
  } catch (error) {
    logger.error("StellarHelper", "Error creating muxed account", error, {
      baseAccount,
      muxedId: String(muxedId),
    });
    return null;
  }
};

/**
 * Gets the muxed ID from a muxed account address
 *
 * @param muxedAddress The muxed account address (M...)
 * @returns The muxed ID (memo) as a string or null if extraction fails
 */
export const getMuxedId = (muxedAddress: string): string | null => {
  try {
    if (!isMuxedAccount(muxedAddress)) {
      return null;
    }
    const mAccount = MuxedAccount.fromAddress(muxedAddress, "0");
    const muxedId = mAccount.id();

    return muxedId;
  } catch (error) {
    return null;
  }
};

/**
 * Checks if a public key is valid (ED25519, MED25519, contract ID, or federation address)
 *
 * @param publicKey The public key to check
 * @returns True if the public key is valid
 */
export const isValidStellarAddress = (publicKey: string): boolean => {
  try {
    // Must have a value to validate
    if (
      !publicKey ||
      typeof publicKey !== "string" ||
      publicKey.trim() === ""
    ) {
      return false;
    }

    // Check if it's a valid Ed25519 public key (G... addresses)
    if (StrKey.isValidEd25519PublicKey(publicKey)) {
      return true;
    }

    // Check if it's a valid muxed account (M... addresses)
    if (StrKey.isValidMed25519PublicKey(publicKey)) {
      return true;
    }

    // Check if it's a valid contract ID (C... addresses)
    if (publicKey.startsWith("C")) {
      const isValid = isContractId(publicKey);
      return isValid;
    }

    // Check if it's a valid federation address (user*domain.com)
    if (isFederationAddress(publicKey)) {
      return true;
    }

    return false;
  } catch (error) {
    logger.error("StellarHelper", "Error validating Stellar address:", error);

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
  const suffix = address.slice(address.length - suffixChars);

  return `${prefix}...${suffix}`;
};

export const formattedBuffer = (data: Buffer) =>
  truncateAddress(Buffer.from(data).toString("hex").toUpperCase());

/**
 * Determines if two Stellar addresses refer to the same account
 * Only considers direct match between Ed25519 public keys
 * Doesn't consider federation addresses or contract IDs to be the same account
 * For muxed accounts, compares their base G addresses
 *
 * @param address1 First address to compare
 * @param address2 Second address to compare
 * @returns True if addresses refer to the same account
 */
export const isSameAccount = (address1: string, address2: string): boolean => {
  try {
    // If either address is empty or not a string, they're not the same
    if (
      !address1 ||
      !address2 ||
      typeof address1 !== "string" ||
      typeof address2 !== "string"
    ) {
      return false;
    }

    // If addresses are exactly the same string, they might be the same account
    if (address1 === address2) {
      // For identical strings, verify they're valid Ed25519 public keys or muxed accounts
      return (
        StrKey.isValidEd25519PublicKey(address1) ||
        StrKey.isValidMed25519PublicKey(address1)
      );
    }

    // Special handling for federation addresses, muxed accounts, and contract IDs
    const isAddress1ContractId =
      address1.startsWith("C") && isContractId(address1);
    const isAddress2ContractId =
      address2.startsWith("C") && isContractId(address2);

    // Contract IDs should never be considered the same account as a G address
    if (isAddress1ContractId || isAddress2ContractId) {
      return false;
    }

    // Handle muxed accounts by converting to base accounts if needed
    const isAddress1Muxed = isMuxedAccount(address1);
    const isAddress2Muxed = isMuxedAccount(address2);

    if (isAddress1Muxed || isAddress2Muxed) {
      // Convert addresses to base accounts
      const baseAddress1 = isAddress1Muxed
        ? getBaseAccount(address1)
        : address1;
      const baseAddress2 = isAddress2Muxed
        ? getBaseAccount(address2)
        : address2;

      // If conversion failed, they can't be the same
      if (!baseAddress1 || !baseAddress2) {
        return false;
      }

      // Compare the base addresses
      return (
        baseAddress1 === baseAddress2 &&
        StrKey.isValidEd25519PublicKey(baseAddress1)
      );
    }

    // Final case - different addresses that are both valid Ed25519 keys
    return false;
  } catch (error) {
    logger.error("StellarHelper", "Error comparing Stellar addresses:", error);

    return false;
  }
};

/**
 * SEP-53 message signing prefix
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md
 */
export const SIGN_MESSAGE_PREFIX = "Stellar Signed Message:\n";

/**
 * Encodes a message using SEP-53 format (prefix + hash)
 * This follows the SEP-53 standard for signing arbitrary messages on Stellar
 *
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md
 * @param message - UTF-8 string message to encode
 * @returns Buffer containing the 32-byte SHA-256 hash ready for signing
 *
 * @example
 * const message = "Hello, Stellar!";
 * const encodedMessage = encodeSep53Message(message);
 * // Returns Buffer containing SHA-256 hash of "Stellar Signed Message:\nHello, Stellar!"
 */
export const encodeSep53Message = (message: string): Buffer => {
  const messageBytes = Buffer.from(message, "utf8");
  const prefixBytes = Buffer.from(SIGN_MESSAGE_PREFIX, "utf8");
  const encodedMessage = Buffer.concat([prefixBytes, messageBytes]);
  return hash(encodedMessage);
};

/**
 * Signs a message using the account's private key following SEP-53 standard
 *
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md
 * @param message - UTF-8 string message to sign (must not be empty or whitespace-only)
 * @param privateKey - Account's secret key (S...)
 * @returns Base64-encoded signature
 *
 * @throws {Error} If message is empty or whitespace-only
 * @throws {Error} If private key is invalid
 * @throws {Error} If message encoding fails
 *
 * @example
 * const message = "Hello, Stellar!";
 * const privateKey = "SBXXXX...";
 * const signature = signMessage(message, privateKey);
 * // Returns base64 signature string
 */
export const signMessage = (message: string, privateKey: string): string => {
  // Validate message is not empty or whitespace-only
  if (!message || message.trim().length === 0) {
    throw new Error("Cannot sign empty or whitespace-only message");
  }

  const keyPair = Keypair.fromSecret(privateKey);
  const encodedMessage = encodeSep53Message(message);
  const signature = keyPair.sign(encodedMessage);
  return signature.toString("base64");
};
