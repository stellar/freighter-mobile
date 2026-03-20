import { Address, hash, Networks, xdr } from "@stellar/stellar-sdk";
import {
  parseAuthEntryPreimage,
  SIGN_MESSAGE_MAX_BYTES,
  validateAuthEntryNetwork,
  validateSignAuthEntry,
  validateSignAuthEntryContent,
  validateSignMessageContent,
  validateSignMessageLength,
  ValidationErrorKeys,
} from "helpers/walletKitValidation";

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a valid base64 HashIdPreimage for the given network passphrase.
 */
const buildTestPreimage = (
  network: string = Networks.TESTNET,
  nonce: string = "1234567890",
): string => {
  const invocation = new xdr.SorobanAuthorizedInvocation({
    function:
      xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(
            "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
          ).toScAddress(),
          functionName: "test_function",
          args: [],
        }),
      ),
    subInvocations: [],
  });

  return xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(Buffer.from(network)),
      nonce: xdr.Int64.fromString(nonce) as xdr.Int64,
      signatureExpirationLedger: 999999,
      invocation,
    }),
  ).toXDR("base64");
};

// ─────────────────────────────────────────────────────────────────────────────
// validateSignMessageContent
// ─────────────────────────────────────────────────────────────────────────────

describe("validateSignMessageContent", () => {
  it("returns valid with value for a non-empty string", () => {
    const result = validateSignMessageContent("hello world");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toBe("hello world");
    }
  });

  it("returns error for null", () => {
    const result = validateSignMessageContent(null);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_MESSAGE);
    }
  });

  it("returns error for undefined", () => {
    const result = validateSignMessageContent(undefined);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_MESSAGE);
    }
  });

  it("returns error for empty string", () => {
    const result = validateSignMessageContent("");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_MESSAGE);
    }
  });

  it("returns error for whitespace-only string", () => {
    const result = validateSignMessageContent("   ");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_MESSAGE);
    }
  });

  it("returns error for non-string types", () => {
    expect(validateSignMessageContent(123).valid).toBe(false);
    expect(validateSignMessageContent({}).valid).toBe(false);
    expect(validateSignMessageContent([]).valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateSignMessageLength
// ─────────────────────────────────────────────────────────────────────────────

describe("validateSignMessageLength", () => {
  it("returns valid for a short message", () => {
    const result = validateSignMessageLength("hello");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toBe("hello");
    }
  });

  it("returns valid for a message exactly at the 1 KB limit", () => {
    const message = "a".repeat(SIGN_MESSAGE_MAX_BYTES);
    const result = validateSignMessageLength(message);
    expect(result.valid).toBe(true);
  });

  it("returns error for a message exceeding 1 KB (ASCII)", () => {
    const message = "a".repeat(SIGN_MESSAGE_MAX_BYTES + 1);
    const result = validateSignMessageLength(message);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.MESSAGE_TOO_LONG);
    }
  });

  it("returns error for a message exceeding 1 KB due to multi-byte UTF-8 chars", () => {
    // Each emoji is 4 bytes in UTF-8 — 257 emojis = 1028 bytes > 1024
    const message = "🚀".repeat(257);
    const result = validateSignMessageLength(message);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.MESSAGE_TOO_LONG);
    }
  });

  it("returns valid for multi-byte chars that stay within 1 KB", () => {
    // 256 emojis = 1024 bytes — exactly at the limit
    const message = "🚀".repeat(256);
    const result = validateSignMessageLength(message);
    expect(result.valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateSignAuthEntryContent
// ─────────────────────────────────────────────────────────────────────────────

describe("validateSignAuthEntryContent", () => {
  it("returns valid with value for a non-empty string", () => {
    const result = validateSignAuthEntryContent("someBase64XDR==");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toBe("someBase64XDR==");
    }
  });

  it("returns error for null", () => {
    const result = validateSignAuthEntryContent(null);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });

  it("returns error for undefined", () => {
    const result = validateSignAuthEntryContent(undefined);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });

  it("returns error for empty string", () => {
    const result = validateSignAuthEntryContent("");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });

  it("returns error for whitespace-only string", () => {
    const result = validateSignAuthEntryContent("   ");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });

  it("returns error for non-string types", () => {
    expect(validateSignAuthEntryContent(42).valid).toBe(false);
    expect(validateSignAuthEntryContent({}).valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseAuthEntryPreimage
// ─────────────────────────────────────────────────────────────────────────────

describe("parseAuthEntryPreimage", () => {
  it("returns valid preimage for a well-formed HashIdPreimage XDR", () => {
    const preimageXdr = buildTestPreimage();
    const result = parseAuthEntryPreimage(preimageXdr);
    expect(result.valid).toBe(true);
    if (result.valid) {
      // Should be parseable back into the XDR type
      expect(result.value).toBeInstanceOf(xdr.HashIdPreimage);
    }
  });

  it("returns error for invalid base64 input", () => {
    const result = parseAuthEntryPreimage("not-valid-base64!!!");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });

  it("returns error for valid base64 but not a HashIdPreimage", () => {
    // Valid base64 but arbitrary bytes that don't decode to a HashIdPreimage
    const result = parseAuthEntryPreimage("aGVsbG8gd29ybGQ="); // "hello world"
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });

  it("returns the same XDR when re-serialized", () => {
    const preimageXdr = buildTestPreimage();
    const result = parseAuthEntryPreimage(preimageXdr);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.toXDR("base64")).toBe(preimageXdr);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateAuthEntryNetwork
// ─────────────────────────────────────────────────────────────────────────────

describe("validateAuthEntryNetwork", () => {
  it("returns valid when preimage networkId matches the wallet network", () => {
    const preimageXdr = buildTestPreimage(Networks.TESTNET);
    const preimage = xdr.HashIdPreimage.fromXDR(preimageXdr, "base64");
    const result = validateAuthEntryNetwork(preimage, Networks.TESTNET);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toBeInstanceOf(xdr.SorobanAuthorizedInvocation);
    }
  });

  it("returns network mismatch error when preimage is for mainnet but wallet is on testnet", () => {
    const preimageXdr = buildTestPreimage(Networks.PUBLIC);
    const preimage = xdr.HashIdPreimage.fromXDR(preimageXdr, "base64");
    const result = validateAuthEntryNetwork(preimage, Networks.TESTNET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(
        ValidationErrorKeys.AUTH_ENTRY_NETWORK_MISMATCH,
      );
    }
  });

  it("returns network mismatch error when preimage is for testnet but wallet is on mainnet", () => {
    const preimageXdr = buildTestPreimage(Networks.TESTNET);
    const preimage = xdr.HashIdPreimage.fromXDR(preimageXdr, "base64");
    const result = validateAuthEntryNetwork(preimage, Networks.PUBLIC);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(
        ValidationErrorKeys.AUTH_ENTRY_NETWORK_MISMATCH,
      );
    }
  });

  it("returns valid for mainnet preimage with mainnet passphrase", () => {
    const preimageXdr = buildTestPreimage(Networks.PUBLIC);
    const preimage = xdr.HashIdPreimage.fromXDR(preimageXdr, "base64");
    const result = validateAuthEntryNetwork(preimage, Networks.PUBLIC);
    expect(result.valid).toBe(true);
  });

  it("returns invalid auth entry error when preimage.sorobanAuthorization() throws", () => {
    // Simulate a preimage of a non-soroban envelope type by mocking the method to throw
    const nonSorobanPreimage = {
      sorobanAuthorization: () => {
        throw new Error("Not a soroban preimage type");
      },
    } as unknown as xdr.HashIdPreimage;

    const result = validateAuthEntryNetwork(
      nonSorobanPreimage,
      Networks.TESTNET,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateSignAuthEntry (combined)
// ─────────────────────────────────────────────────────────────────────────────

describe("validateSignAuthEntry", () => {
  it("returns valid preimage for a correct testnet entry", () => {
    const preimageXdr = buildTestPreimage(Networks.TESTNET);
    const result = validateSignAuthEntry(preimageXdr, Networks.TESTNET);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toBeInstanceOf(xdr.HashIdPreimage);
    }
  });

  it("returns error when entryXdr is null", () => {
    const result = validateSignAuthEntry(null, Networks.TESTNET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });

  it("returns error when entryXdr is empty string", () => {
    const result = validateSignAuthEntry("", Networks.TESTNET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });

  it("returns error when entryXdr is not valid base64 XDR", () => {
    const result = validateSignAuthEntry("not-valid-xdr!!!", Networks.TESTNET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });

  it("returns network mismatch error when preimage is for mainnet but wallet is on testnet", () => {
    const preimageXdr = buildTestPreimage(Networks.PUBLIC);
    const result = validateSignAuthEntry(preimageXdr, Networks.TESTNET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(
        ValidationErrorKeys.AUTH_ENTRY_NETWORK_MISMATCH,
      );
    }
  });

  it("returns network mismatch error when preimage is for testnet but wallet is on mainnet", () => {
    const preimageXdr = buildTestPreimage(Networks.TESTNET);
    const result = validateSignAuthEntry(preimageXdr, Networks.PUBLIC);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(
        ValidationErrorKeys.AUTH_ENTRY_NETWORK_MISMATCH,
      );
    }
  });

  it("returns valid preimage for valid mainnet entry", () => {
    const preimageXdr = buildTestPreimage(Networks.PUBLIC);
    const result = validateSignAuthEntry(preimageXdr, Networks.PUBLIC);
    expect(result.valid).toBe(true);
  });

  it("returns the same XDR preimage when re-serialized", () => {
    const preimageXdr = buildTestPreimage(Networks.TESTNET);
    const result = validateSignAuthEntry(preimageXdr, Networks.TESTNET);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.toXDR("base64")).toBe(preimageXdr);
    }
  });
});
