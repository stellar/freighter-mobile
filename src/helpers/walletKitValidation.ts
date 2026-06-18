/**
 * Shared validation helpers for WalletKit sign requests.
 * Used by both WalletKitProvider (pre-UI validation) and walletKitUtil (approval-time validation).
 */
import { hash, StrKey, xdr } from "@stellar/stellar-sdk";

// ─────────────────────────────────────────────────────────────────────────────
// Error Keys (full i18n translation key paths)
// ─────────────────────────────────────────────────────────────────────────────

export const ValidationErrorKeys = {
  INVALID_MESSAGE: "walletKit.errorInvalidMessage",
  MESSAGE_TOO_LONG: "walletKit.errorMessageTooLong",
  INVALID_AUTH_ENTRY: "walletKit.errorInvalidAuthEntry",
  AUTH_ENTRY_NETWORK_MISMATCH: "walletKit.errorAuthEntryNetworkMismatch",
  AUTH_ENTRY_ADDRESS_MISMATCH: "walletKit.errorAuthEntryAddressMismatch",
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
 * The arm-agnostic shape of a Soroban authorization preimage.
 * CAP-71 (Protocol 27) adds `envelopeTypeSorobanAuthorizationWithAddress`,
 * which dapps on protocol 27 send for ADDRESS_V2 credentials — it carries the
 * signer address in addition to the legacy fields.
 */
export interface NormalizedAuthPreimage {
  networkId: Buffer;
  invocation: xdr.SorobanAuthorizedInvocation;
  /** Present only for envelopeTypeSorobanAuthorizationWithAddress (CAP-71 ADDRESS_V2). */
  address?: xdr.ScAddress;
}

/**
 * Normalizes a HashIdPreimage into a single shape regardless of which Soroban
 * authorization arm it uses. Returns null for non-authorization preimage types.
 */
export function normalizeAuthPreimage(
  preimage: xdr.HashIdPreimage,
): NormalizedAuthPreimage | null {
  try {
    switch (preimage.switch()) {
      case xdr.EnvelopeType.envelopeTypeSorobanAuthorization(): {
        const auth = preimage.sorobanAuthorization();
        return { networkId: auth.networkId(), invocation: auth.invocation() };
      }
      case xdr.EnvelopeType.envelopeTypeSorobanAuthorizationWithAddress(): {
        const auth = preimage.sorobanAuthorizationWithAddress();
        return {
          networkId: auth.networkId(),
          invocation: auth.invocation(),
          address: auth.address(),
        };
      }
      default:
        // Not a Soroban authorization preimage — unsupported for signing.
        return null;
    }
  } catch (e) {
    // Malformed preimage object — treat as unsupported.
    return null;
  }
}

/**
 * Validates that the networkId in the preimage matches the expected network.
 * Returns the invocation from the authorization preimage on success.
 * Supports both envelopeTypeSorobanAuthorization and the CAP-71
 * envelopeTypeSorobanAuthorizationWithAddress arms.
 */
export function validateAuthEntryNetwork(
  preimage: xdr.HashIdPreimage,
  networkPassphrase: string,
): ValidationResult<xdr.SorobanAuthorizedInvocation> {
  const normalized = normalizeAuthPreimage(preimage);
  if (!normalized) {
    // The preimage type is not a Soroban authorization — treat as invalid.
    return { valid: false, errorKey: ValidationErrorKeys.INVALID_AUTH_ENTRY };
  }

  const expectedNetworkId = hash(Buffer.from(networkPassphrase));
  if (!normalized.networkId.equals(expectedNetworkId)) {
    return {
      valid: false,
      errorKey: ValidationErrorKeys.AUTH_ENTRY_NETWORK_MISMATCH,
    };
  }

  return { valid: true, value: normalized.invocation };
}

/**
 * Validates that a CAP-71 (ADDRESS_V2) preimage is bound to the active wallet
 * account. The withAddress preimage embeds the signer address; if it is an
 * account address that differs from the wallet, signing would produce a
 * signature bound to someone else — reject it.
 *
 * Legacy preimages (no bound address) and contract-bound addresses (which a
 * wallet account key can't match — e.g. delegate/contract signers) pass through.
 */
export function validateAuthEntryAddress(
  preimage: xdr.HashIdPreimage,
  walletPublicKey: string,
): ValidationResult<true> {
  const normalized = normalizeAuthPreimage(preimage);
  if (!normalized) {
    return { valid: false, errorKey: ValidationErrorKeys.INVALID_AUTH_ENTRY };
  }

  // Legacy arm carries no bound address — nothing to enforce.
  if (!normalized.address) {
    return { valid: true, value: true };
  }

  // Only enforce for account-type bound addresses.
  if (normalized.address.switch().name !== "scAddressTypeAccount") {
    return { valid: true, value: true };
  }

  const boundAddress = StrKey.encodeEd25519PublicKey(
    normalized.address.accountId().ed25519(),
  );
  if (boundAddress !== walletPublicKey) {
    return {
      valid: false,
      errorKey: ValidationErrorKeys.AUTH_ENTRY_ADDRESS_MISMATCH,
    };
  }

  return { valid: true, value: true };
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
  walletPublicKey: string,
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

  // Step 4: Address binding (CAP-71 ADDRESS_V2) — must match the active wallet
  const addressResult = validateAuthEntryAddress(
    parseResult.value,
    walletPublicKey,
  );
  if (!addressResult.valid) return addressResult;

  return { valid: true, value: parseResult.value };
}
