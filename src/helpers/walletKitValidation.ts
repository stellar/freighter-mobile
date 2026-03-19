/**
 * Shared validation helpers for WalletKit sign requests.
 * Used by both WalletKitProvider (pre-UI validation) and walletKitUtil (approval-time validation).
 */
import { hash, xdr } from "@stellar/stellar-sdk";

// ─────────────────────────────────────────────────────────────────────────────
// Error Keys (full i18n translation key paths)
// ─────────────────────────────────────────────────────────────────────────────

export const ValidationErrorKeys = {
  INVALID_MESSAGE: "walletKit.errorInvalidMessage",
  MESSAGE_TOO_LONG: "walletKit.errorMessageTooLong",
  INVALID_AUTH_ENTRY: "walletKit.errorInvalidAuthEntry",
  AUTH_ENTRY_NETWORK_MISMATCH: "walletKit.errorAuthEntryNetworkMismatch",
} as const;

/** Max UTF-8 byte length for sign_message content per SEP-53. */
export const SIGN_MESSAGE_MAX_BYTES = 1024;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationSuccess<T> = { valid: true; value: T };
export type ValidationErrorKey =
  (typeof ValidationErrorKeys)[keyof typeof ValidationErrorKeys];
export type ValidationError = { valid: false; errorKey: ValidationErrorKey };
export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

// ─────────────────────────────────────────────────────────────────────────────
// Sign Message Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates sign_message content: must be a non-empty string.
 */
export function validateSignMessageContent(
  message: unknown,
): ValidationResult<string> {
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return { valid: false, errorKey: ValidationErrorKeys.INVALID_MESSAGE };
  }
  return { valid: true, value: message };
}

/**
 * Validates sign_message length: max 1KB UTF-8 bytes per SEP-53.
 */
export function validateSignMessageLength(
  message: string,
): ValidationResult<string> {
  const messageByteLength = new TextEncoder().encode(message).length;
  if (messageByteLength > SIGN_MESSAGE_MAX_BYTES) {
    return { valid: false, errorKey: ValidationErrorKeys.MESSAGE_TOO_LONG };
  }
  return { valid: true, value: message };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign Auth Entry Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates sign_auth_entry content: must be a non-empty string.
 */
export function validateSignAuthEntryContent(
  entryXdr: unknown,
): ValidationResult<string> {
  if (
    !entryXdr ||
    typeof entryXdr !== "string" ||
    entryXdr.trim().length === 0
  ) {
    return { valid: false, errorKey: ValidationErrorKeys.INVALID_AUTH_ENTRY };
  }
  return { valid: true, value: entryXdr };
}

/**
 * Parses entryXdr as a HashIdPreimage. Returns the parsed preimage or an error.
 */
export function parseAuthEntryPreimage(
  entryXdr: string,
): ValidationResult<xdr.HashIdPreimage> {
  try {
    const preimage = xdr.HashIdPreimage.fromXDR(entryXdr, "base64");
    return { valid: true, value: preimage };
  } catch (e) {
    return { valid: false, errorKey: ValidationErrorKeys.INVALID_AUTH_ENTRY };
  }
}

/**
 * Validates that the networkId in the preimage matches the expected network.
 * Returns the invocation from the sorobanAuthorization on success.
 */
export function validateAuthEntryNetwork(
  preimage: xdr.HashIdPreimage,
  networkPassphrase: string,
): ValidationResult<xdr.SorobanAuthorizedInvocation> {
  try {
    const sorobanAuth = preimage.sorobanAuthorization();
    const embeddedNetworkId = sorobanAuth.networkId();
    const expectedNetworkId = hash(Buffer.from(networkPassphrase));

    if (!embeddedNetworkId.equals(expectedNetworkId)) {
      return {
        valid: false,
        errorKey: ValidationErrorKeys.AUTH_ENTRY_NETWORK_MISMATCH,
      };
    }

    return { valid: true, value: sorobanAuth.invocation() };
  } catch (e) {
    // If we can't extract sorobanAuthorization, the preimage type is not
    // envelopeTypeSorobanAuthorization — treat as invalid.
    return { valid: false, errorKey: ValidationErrorKeys.INVALID_AUTH_ENTRY };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined Validators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates all aspects of a sign_auth_entry request.
 * @returns The parsed preimage on success, or an error with the appropriate key.
 */
export function validateSignAuthEntry(
  entryXdr: unknown,
  networkPassphrase: string,
): ValidationResult<xdr.HashIdPreimage> {
  // Step 1: Content validation
  const contentResult = validateSignAuthEntryContent(entryXdr);
  if (!contentResult.valid) return contentResult;

  // Step 2: XDR format validation
  const parseResult = parseAuthEntryPreimage(contentResult.value);
  if (!parseResult.valid) return parseResult;

  // Step 3: Network validation
  const networkResult = validateAuthEntryNetwork(
    parseResult.value,
    networkPassphrase,
  );
  if (!networkResult.valid) return networkResult;

  return { valid: true, value: parseResult.value };
}
