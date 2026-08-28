import { Address, hash, Keypair, Networks, xdr } from "@stellar/stellar-sdk";
import {
  normalizeAuthPreimage,
  parseAuthEntryPreimage,
  SIGN_MESSAGE_MAX_BYTES,
  validateAuthEntryAddress,
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

const TEST_SIGNER_ADDRESS =
  "GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3";

// A different wallet account, used for address-mismatch assertions.
const OTHER_WALLET_ADDRESS =
  "GBXFXNDLV4LSWA4VB7YIL5GBD7BVNR22SGBTDKMO2SBZZHDXSKZYCP7L";

const buildTestInvocation = (): xdr.SorobanAuthorizedInvocation =>
  new xdr.SorobanAuthorizedInvocation({
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

/**
 * Builds a valid base64 HashIdPreimage for the given network passphrase.
 */
const buildTestPreimage = (
  network: string = Networks.TESTNET,
  nonce: string = "1234567890",
): string =>
  xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(Buffer.from(network)),
      nonce: BigInt(nonce),
      signatureExpirationLedger: 999999,
      invocation: buildTestInvocation(),
    }),
  ).toXdr("base64");

/**
 * Builds a base64 CAP-71 envelopeTypeSorobanAuthorizationWithAddress preimage,
 * the arm dapps on protocol 27 send for ADDRESS_V2 credentials.
 */
const buildTestWithAddressPreimage = (
  network: string = Networks.TESTNET,
  nonce: string = "1234567890",
  signerAddress: string = TEST_SIGNER_ADDRESS,
): string =>
  xdr.HashIdPreimage.envelopeTypeSorobanAuthorizationWithAddress(
    new xdr.HashIdPreimageSorobanAuthorizationWithAddress({
      networkId: hash(Buffer.from(network)),
      nonce: BigInt(nonce),
      signatureExpirationLedger: 999999,
      address: new Address(signerAddress).toScAddress(),
      invocation: buildTestInvocation(),
    }),
  ).toXdr("base64");

/** Builds a real non-Soroban-authorization preimage (operation ID arm). */
const buildNonSorobanPreimage = (): string =>
  xdr.HashIdPreimage.envelopeTypeOpId(
    new xdr.HashIdPreimageOperationId({
      sourceAccount: Keypair.fromPublicKey(TEST_SIGNER_ADDRESS).xdrAccountId(),
      seqNum: BigInt("1"),
      opNum: 0,
    }),
  ).toXdr("base64");

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

  it("allows a multi-KB JSON payload (limit is 10 KB, not 1 KB)", () => {
    // Regression for stellar/freighter-mobile#957: dApps sign JSON payloads
    // that routinely exceed 1 KB. SEP-53 imposes no size limit.
    expect(SIGN_MESSAGE_MAX_BYTES).toBe(10240);
    const message = JSON.stringify({ data: "a".repeat(4000) });
    const result = validateSignMessageLength(message);
    expect(result.valid).toBe(true);
  });

  it("returns valid for a message exactly at the limit", () => {
    const message = "a".repeat(SIGN_MESSAGE_MAX_BYTES);
    const result = validateSignMessageLength(message);
    expect(result.valid).toBe(true);
  });

  it("returns error for a message exceeding the limit (ASCII)", () => {
    const message = "a".repeat(SIGN_MESSAGE_MAX_BYTES + 1);
    const result = validateSignMessageLength(message);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.MESSAGE_TOO_LONG);
    }
  });

  it("returns error for a message exceeding the limit due to multi-byte UTF-8 chars", () => {
    // Each emoji is 4 bytes in UTF-8, so this is 4 bytes over the limit
    const message = "🚀".repeat(SIGN_MESSAGE_MAX_BYTES / 4 + 1);
    const result = validateSignMessageLength(message);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.MESSAGE_TOO_LONG);
    }
  });

  it("returns valid for multi-byte chars that stay within the limit", () => {
    // Each emoji is 4 bytes in UTF-8 — exactly at the limit
    const message = "🚀".repeat(SIGN_MESSAGE_MAX_BYTES / 4);
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
      expect(result.value.toXdr("base64")).toBe(preimageXdr);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeAuthPreimage
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeAuthPreimage", () => {
  it("normalizes a legacy sorobanAuthorization preimage without an address", () => {
    const preimage = xdr.HashIdPreimage.fromXdr(buildTestPreimage(), "base64");
    const normalized = normalizeAuthPreimage(preimage);
    expect(normalized).not.toBeNull();
    expect(normalized?.address).toBeUndefined();
    // v17: networkId is an xdr.Hash wrapper; compare against a wrapped hash.
    expect(
      normalized?.networkId.equals(
        new xdr.Hash(hash(Buffer.from(Networks.TESTNET))),
      ),
    ).toBe(true);
    expect(normalized?.invocation).toBeInstanceOf(
      xdr.SorobanAuthorizedInvocation,
    );
  });

  it("returns null for a non-Soroban-authorization preimage arm", () => {
    const preimage = xdr.HashIdPreimage.fromXdr(
      buildNonSorobanPreimage(),
      "base64",
    );
    expect(normalizeAuthPreimage(preimage)).toBeNull();
  });

  it("returns null for a malformed preimage object", () => {
    const malformed = {
      sorobanAuthorization: () => {
        throw new Error("Not a soroban preimage type");
      },
    } as unknown as xdr.HashIdPreimage;
    expect(normalizeAuthPreimage(malformed)).toBeNull();
  });

  it("normalizes a CAP-71 sorobanAuthorizationWithAddress preimage and surfaces the address", () => {
    const preimage = xdr.HashIdPreimage.fromXdr(
      buildTestWithAddressPreimage(),
      "base64",
    );
    const normalized = normalizeAuthPreimage(preimage);
    expect(normalized).not.toBeNull();
    expect(normalized?.invocation).toBeInstanceOf(
      xdr.SorobanAuthorizedInvocation,
    );
    expect(normalized?.address).toBeDefined();
    expect(Address.fromScAddress(normalized!.address!).toString()).toBe(
      TEST_SIGNER_ADDRESS,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateAuthEntryNetwork
// ─────────────────────────────────────────────────────────────────────────────

describe("validateAuthEntryNetwork", () => {
  it("returns valid when preimage networkId matches the wallet network", () => {
    const preimageXdr = buildTestPreimage(Networks.TESTNET);
    const preimage = xdr.HashIdPreimage.fromXdr(preimageXdr, "base64");
    const result = validateAuthEntryNetwork(preimage, Networks.TESTNET);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toBeInstanceOf(xdr.SorobanAuthorizedInvocation);
    }
  });

  it("returns network mismatch error when preimage is for mainnet but wallet is on testnet", () => {
    const preimageXdr = buildTestPreimage(Networks.PUBLIC);
    const preimage = xdr.HashIdPreimage.fromXdr(preimageXdr, "base64");
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
    const preimage = xdr.HashIdPreimage.fromXdr(preimageXdr, "base64");
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
    const preimage = xdr.HashIdPreimage.fromXdr(preimageXdr, "base64");
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

  it("returns invalid auth entry error for a non-Soroban-authorization preimage arm", () => {
    const preimage = xdr.HashIdPreimage.fromXdr(
      buildNonSorobanPreimage(),
      "base64",
    );
    const result = validateAuthEntryNetwork(preimage, Networks.TESTNET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });

  it("returns valid when a CAP-71 withAddress preimage networkId matches the wallet network", () => {
    const preimage = xdr.HashIdPreimage.fromXdr(
      buildTestWithAddressPreimage(Networks.TESTNET),
      "base64",
    );
    const result = validateAuthEntryNetwork(preimage, Networks.TESTNET);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toBeInstanceOf(xdr.SorobanAuthorizedInvocation);
    }
  });

  it("returns network mismatch error for a CAP-71 withAddress preimage on the wrong network", () => {
    const preimage = xdr.HashIdPreimage.fromXdr(
      buildTestWithAddressPreimage(Networks.PUBLIC),
      "base64",
    );
    const result = validateAuthEntryNetwork(preimage, Networks.TESTNET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(
        ValidationErrorKeys.AUTH_ENTRY_NETWORK_MISMATCH,
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateSignAuthEntry (combined)
// ─────────────────────────────────────────────────────────────────────────────

describe("validateSignAuthEntry", () => {
  it("returns valid preimage for a correct testnet entry", () => {
    const preimageXdr = buildTestPreimage(Networks.TESTNET);
    const result = validateSignAuthEntry(
      preimageXdr,
      Networks.TESTNET,
      TEST_SIGNER_ADDRESS,
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toBeInstanceOf(xdr.HashIdPreimage);
    }
  });

  it("returns error when entryXdr is null", () => {
    const result = validateSignAuthEntry(
      null,
      Networks.TESTNET,
      TEST_SIGNER_ADDRESS,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });

  it("returns error when entryXdr is empty string", () => {
    const result = validateSignAuthEntry(
      "",
      Networks.TESTNET,
      TEST_SIGNER_ADDRESS,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });

  it("returns error when entryXdr is not valid base64 XDR", () => {
    const result = validateSignAuthEntry(
      "not-valid-xdr!!!",
      Networks.TESTNET,
      TEST_SIGNER_ADDRESS,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });

  it("returns network mismatch error when preimage is for mainnet but wallet is on testnet", () => {
    const preimageXdr = buildTestPreimage(Networks.PUBLIC);
    const result = validateSignAuthEntry(
      preimageXdr,
      Networks.TESTNET,
      TEST_SIGNER_ADDRESS,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(
        ValidationErrorKeys.AUTH_ENTRY_NETWORK_MISMATCH,
      );
    }
  });

  it("returns network mismatch error when preimage is for testnet but wallet is on mainnet", () => {
    const preimageXdr = buildTestPreimage(Networks.TESTNET);
    const result = validateSignAuthEntry(
      preimageXdr,
      Networks.PUBLIC,
      TEST_SIGNER_ADDRESS,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(
        ValidationErrorKeys.AUTH_ENTRY_NETWORK_MISMATCH,
      );
    }
  });

  it("returns valid preimage for valid mainnet entry", () => {
    const preimageXdr = buildTestPreimage(Networks.PUBLIC);
    const result = validateSignAuthEntry(
      preimageXdr,
      Networks.PUBLIC,
      TEST_SIGNER_ADDRESS,
    );
    expect(result.valid).toBe(true);
  });

  it("returns the same XDR preimage when re-serialized", () => {
    const preimageXdr = buildTestPreimage(Networks.TESTNET);
    const result = validateSignAuthEntry(
      preimageXdr,
      Networks.TESTNET,
      TEST_SIGNER_ADDRESS,
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.toXdr("base64")).toBe(preimageXdr);
    }
  });

  it("returns valid preimage for a CAP-71 withAddress entry bound to the wallet", () => {
    const preimageXdr = buildTestWithAddressPreimage(Networks.TESTNET);
    const result = validateSignAuthEntry(
      preimageXdr,
      Networks.TESTNET,
      TEST_SIGNER_ADDRESS,
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.toXdr("base64")).toBe(preimageXdr);
    }
  });

  it("returns address mismatch error for a CAP-71 withAddress entry bound to a different account", () => {
    const preimageXdr = buildTestWithAddressPreimage(Networks.TESTNET);
    const result = validateSignAuthEntry(
      preimageXdr,
      Networks.TESTNET,
      OTHER_WALLET_ADDRESS,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(
        ValidationErrorKeys.AUTH_ENTRY_ADDRESS_MISMATCH,
      );
    }
  });

  it("returns network mismatch error for a CAP-71 withAddress entry on the wrong network", () => {
    const preimageXdr = buildTestWithAddressPreimage(Networks.PUBLIC);
    const result = validateSignAuthEntry(
      preimageXdr,
      Networks.TESTNET,
      TEST_SIGNER_ADDRESS,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(
        ValidationErrorKeys.AUTH_ENTRY_NETWORK_MISMATCH,
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateAuthEntryAddress
// ─────────────────────────────────────────────────────────────────────────────

describe("validateAuthEntryAddress", () => {
  it("passes a legacy preimage through (no bound address to enforce)", () => {
    const preimage = xdr.HashIdPreimage.fromXdr(buildTestPreimage(), "base64");
    const result = validateAuthEntryAddress(preimage, OTHER_WALLET_ADDRESS);
    expect(result.valid).toBe(true);
  });

  it("returns valid when the bound address matches the wallet", () => {
    const preimage = xdr.HashIdPreimage.fromXdr(
      buildTestWithAddressPreimage(Networks.TESTNET, "1", TEST_SIGNER_ADDRESS),
      "base64",
    );
    const result = validateAuthEntryAddress(preimage, TEST_SIGNER_ADDRESS);
    expect(result.valid).toBe(true);
  });

  it("returns address mismatch when the bound account differs from the wallet", () => {
    const preimage = xdr.HashIdPreimage.fromXdr(
      buildTestWithAddressPreimage(Networks.TESTNET, "1", TEST_SIGNER_ADDRESS),
      "base64",
    );
    const result = validateAuthEntryAddress(preimage, OTHER_WALLET_ADDRESS);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(
        ValidationErrorKeys.AUTH_ENTRY_ADDRESS_MISMATCH,
      );
    }
  });

  it("rejects a contract-bound address (delegated auth is not supported — freighter-mobile#894)", () => {
    const preimage = xdr.HashIdPreimage.fromXdr(
      buildTestWithAddressPreimage(
        Networks.TESTNET,
        "1",
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
      ),
      "base64",
    );
    const result = validateAuthEntryAddress(preimage, OTHER_WALLET_ADDRESS);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(
        ValidationErrorKeys.AUTH_ENTRY_ADDRESS_MISMATCH,
      );
    }
  });

  it("returns invalid for a non-Soroban-authorization preimage", () => {
    const preimage = xdr.HashIdPreimage.fromXdr(
      buildNonSorobanPreimage(),
      "base64",
    );
    const result = validateAuthEntryAddress(preimage, TEST_SIGNER_ADDRESS);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe(ValidationErrorKeys.INVALID_AUTH_ENTRY);
    }
  });
});
