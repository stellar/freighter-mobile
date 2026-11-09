/**
 * Stellar SDK Compatibility Tests
 *
 * Pins the SDK behaviour freighter-mobile relies on, so an SDK upgrade that
 * changes it fails here before it reaches a device. The blocks follow the
 * releases that brought each behaviour in: the core APIs checked since the
 * SDK 15 upgrade (Protocol 26), CAP-71 credentials (Protocol 27, SDK 16), the
 * Horizon submission errors of the SDK 16+ HTTP client, and Protocol 30
 * (SDK 17.4).
 * Uses real SDK calls; only the global `fetch` is stubbed, for the Horizon
 * submission tests.
 */
import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  BadResponseError,
  FeeBumpTransaction,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
  TransactionFailedError,
  hash,
  walkInvocationTree,
  xdr,
} from "@stellar/stellar-sdk";
import {
  BASE_CONTRACT,
  MUXED_CONTRACT_ID_0,
  MUXED_CONTRACT_ID_1234,
} from "__tests__/support/muxedContractFixtures";
import { getAuthEntryBoundAddress } from "helpers/soroban";
import { isHorizonError } from "services/stellar";

describe("Stellar SDK compatibility", () => {
  const networkPassphrase = Networks.TESTNET;
  const keypair = Keypair.random();
  const account = new Account(keypair.publicKey(), "100");

  describe("Transaction XDR roundtrip", () => {
    it("builds, serializes, and deserializes a payment transaction", () => {
      const destination = Keypair.random().publicKey();
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination,
            asset: Asset.native(),
            amount: "10",
          }),
        )
        .setTimeout(30)
        .build();

      const xdrString = tx.toXdr();
      const restored = TransactionBuilder.fromXdr(
        xdrString,
        networkPassphrase,
      ) as Transaction;

      expect(restored.operations.length).toBe(1);
      expect(restored.operations[0].type).toBe("payment");
      expect(restored.source).toBe(keypair.publicKey());
    });

    it("roundtrips a fee bump transaction", () => {
      const innerTx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: "5",
          }),
        )
        .setTimeout(30)
        .build();

      innerTx.sign(keypair);

      const feeBump = TransactionBuilder.buildFeeBumpTransaction(
        keypair,
        (parseInt(BASE_FEE, 10) * 2).toString(),
        innerTx,
        networkPassphrase,
      );

      const xdrString = feeBump.toXdr();
      const restored = TransactionBuilder.fromXdr(xdrString, networkPassphrase);

      expect(restored).toBeInstanceOf(FeeBumpTransaction);
    });
  });

  describe("Transaction signing", () => {
    it("signs a transaction and produces a valid signature", () => {
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: "1",
          }),
        )
        .setTimeout(30)
        .build();

      expect(tx.signatures.length).toBe(0);
      tx.sign(keypair);
      expect(tx.signatures.length).toBe(1);

      // v17: DecoratedSignature.signature is an xdr.Signature wrapper — unwrap
      // to bytes before checking the length.
      const sigBytes = tx.signatures[0].signature.toBytes();
      expect(sigBytes.length).toBe(64);
    });
  });

  describe("Asset.contractId", () => {
    it("returns a contract ID for native asset", () => {
      const contractId = Asset.native().contractId(networkPassphrase);
      expect(contractId).toBeTruthy();
      expect(StrKey.isValidContract(contractId)).toBe(true);
    });

    it("returns a contract ID for custom asset", () => {
      const issuer = Keypair.random().publicKey();
      const asset = new Asset("USD", issuer);
      const contractId = asset.contractId(networkPassphrase);
      expect(contractId).toBeTruthy();
      expect(StrKey.isValidContract(contractId)).toBe(true);
    });

    it("returns consistent contract IDs across calls", () => {
      const issuer = Keypair.random().publicKey();
      const asset = new Asset("EUR", issuer);
      const id1 = asset.contractId(networkPassphrase);
      const id2 = asset.contractId(networkPassphrase);
      expect(id1).toBe(id2);
    });
  });

  describe("StrKey validation", () => {
    it("validates Ed25519 public keys", () => {
      expect(StrKey.isValidEd25519PublicKey(keypair.publicKey())).toBe(true);
      expect(StrKey.isValidEd25519PublicKey("GINVALID")).toBe(false);
    });

    it("validates Ed25519 secret seeds", () => {
      expect(StrKey.isValidEd25519SecretSeed(keypair.secret())).toBe(true);
      expect(StrKey.isValidEd25519SecretSeed("SINVALID")).toBe(false);
    });

    it("validates Muxed account addresses", () => {
      expect(StrKey.isValidMed25519PublicKey(keypair.publicKey())).toBe(false);
    });

    it("validates contract IDs", () => {
      const contractId = Asset.native().contractId(networkPassphrase);
      expect(StrKey.isValidContract(contractId)).toBe(true);
      expect(StrKey.isValidContract("CINVALID")).toBe(false);
    });
  });

  describe("hash function", () => {
    it("returns 32 bytes for network passphrase", () => {
      const result = hash(Buffer.from(networkPassphrase));
      // v17: byte-returning APIs hand back a plain Uint8Array, not a Buffer.
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });

    it("produces consistent output", () => {
      const input = Buffer.from("test-input");
      const hash1 = hash(input);
      const hash2 = hash(input);
      expect(xdr.encodeBytes(hash1, "hex")).toBe(xdr.encodeBytes(hash2, "hex"));
    });
  });

  describe("Address utility", () => {
    it("creates Address from public key string", () => {
      const addr = Address.fromString(keypair.publicKey());
      expect(addr.toString()).toBe(keypair.publicKey());
    });

    it("roundtrips through ScAddress", () => {
      const addr = Address.fromString(keypair.publicKey());
      const scAddr = addr.toScAddress();
      const restored = Address.fromScAddress(scAddr);
      expect(restored.toString()).toBe(keypair.publicKey());
    });
  });

  describe("Protocol 30 (CAP-84, CAP-87, CAP-88)", () => {
    it("validates and round-trips the SEP-23 W vector through StrKey", () => {
      expect(StrKey.isValidMuxedContract(MUXED_CONTRACT_ID_0)).toBe(true);
      expect(StrKey.isValidMuxedContract(BASE_CONTRACT)).toBe(false);
      const raw = StrKey.decodeMuxedContract(MUXED_CONTRACT_ID_0);
      expect(raw.length).toBe(40);
      expect(StrKey.encodeContract(Buffer.from(raw.subarray(0, 32)))).toBe(
        BASE_CONTRACT,
      );
      expect(StrKey.encodeMuxedContract(raw)).toBe(MUXED_CONTRACT_ID_0);
    });

    it("round-trips new Address(W) through ScAddress arm 5, its XDR bytes and ScVal", () => {
      const sc = new Address(MUXED_CONTRACT_ID_1234).toScAddress();
      expect(sc.type).toBe("scAddressTypeMuxedContract");
      expect(xdr.ScAddressType.fromName(sc.type).value).toBe(5);
      expect(
        Address.fromScAddress(
          xdr.ScAddress.fromXDR(sc.toXDR("base64"), "base64"),
        ).toString(),
      ).toBe(MUXED_CONTRACT_ID_1234);
      expect(
        Address.fromScVal(
          new Address(MUXED_CONTRACT_ID_1234).toScVal(),
        ).toString(),
      ).toBe(MUXED_CONTRACT_ID_1234);
      expect(
        Address.muxedContract(
          StrKey.decodeMuxedContract(MUXED_CONTRACT_ID_1234),
        ).toString(),
      ).toBe(MUXED_CONTRACT_ID_1234);
    });

    it("exposes the CAP-87 ML-DSA cost types as 86–94", () => {
      const names = [
        "mlDsa44DecodeVerifyingKey",
        "mlDsa65DecodeVerifyingKey",
        "mlDsa87DecodeVerifyingKey",
        "mlDsa44DecodeSignature",
        "mlDsa65DecodeSignature",
        "mlDsa87DecodeSignature",
        "verifyMlDsa44Sig",
        "verifyMlDsa65Sig",
        "verifyMlDsa87Sig",
      ] as const;
      names.forEach((name, i) =>
        expect(xdr.ContractCostType[name].value).toBe(86 + i),
      );
    });

    it("exposes the CAP-88 millisecond StellarValue arms", () => {
      expect(xdr.StellarValueType.stellarValueSignedMs.value).toBe(3);
      expect(xdr.StellarValueType.stellarValueEmptyTxSetMs.value).toBe(4);
    });
  });

  describe("walkInvocationTree export", () => {
    it("is exported and is a function", () => {
      expect(typeof walkInvocationTree).toBe("function");
    });
  });

  describe("XDR type construction", () => {
    it("constructs and reads an ScVal i128", () => {
      const scVal = xdr.ScVal.scvI128(
        new xdr.Int128Parts({
          lo: BigInt("1000000"),
          hi: BigInt("0"),
        }),
      );
      expect(scVal.type).toBe("scvI128");
      const parts = xdr.expectUnionVariant(scVal, "scvI128").i128;
      expect(parts.lo.toString()).toBe("1000000");
      expect(parts.hi.toString()).toBe("0");
    });

    it("constructs an ScAddress for an account", () => {
      const scAddr = xdr.ScAddress.scAddressTypeAccount(
        xdr.PublicKey.publicKeyTypeEd25519(
          StrKey.decodeEd25519PublicKey(keypair.publicKey()),
        ),
      );
      expect(scAddr.type).toBe("scAddressTypeAccount");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CAP-71 / Protocol 27 — ADDRESS_V2 credentials
  // ───────────────────────────────────────────────────────────────────────────

  describe("CAP-71 ADDRESS_V2 credentials (Protocol 27)", () => {
    it("rootInvocation() works on an auth entry with ADDRESS_V2 credentials (transaction review path)", () => {
      const invocation = new xdr.SorobanAuthorizedInvocation({
        function:
          xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: new Address(
                "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
              ).toScAddress(),
              functionName: "transfer",
              args: [],
            }),
          ),
        subInvocations: [],
      });

      const credentials = xdr.SorobanCredentials.sorobanCredentialsAddressV2(
        new xdr.SorobanAddressCredentials({
          address: new Address(keypair.publicKey()).toScAddress(),
          nonce: BigInt(1),
          signatureExpirationLedger: 999999,
          signature: xdr.ScVal.scvVoid(),
        }),
      );

      const entry = new xdr.SorobanAuthorizationEntry({
        credentials,
        rootInvocation: invocation,
      });

      // The signing-review screens only read rootInvocation and never
      // switch on credentials — this locks that assumption for ADDRESS_V2.
      const roundtripped = xdr.SorobanAuthorizationEntry.fromXdr(
        entry.toXdr("base64"),
        "base64",
      );
      const root = roundtripped.rootInvocation;
      expect(root).toBeInstanceOf(xdr.SorobanAuthorizedInvocation);
      expect(
        xdr
          .expectUnionVariant(
            root.function,
            "sorobanAuthorizedFunctionTypeContractFn",
          )
          .contractFn.functionName.toString(),
      ).toBe("transfer");

      // walkInvocationTree (used by getInvocationDetails) traverses it fine
      const visited: string[] = [];
      walkInvocationTree(root, (node) => {
        visited.push(node.function.type);
        return true;
      });
      expect(visited.length).toBe(1);

      // The transaction-review path surfaces the bound address per entry.
      expect(getAuthEntryBoundAddress(roundtripped)).toBe(keypair.publicKey());
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Horizon submission errors — the SDK 16+ HTTP client
  // ───────────────────────────────────────────────────────────────────────────

  describe("Horizon submission errors (SDK 16+ HTTP client)", () => {
    // SDK 16 replaced axios with fetch, and 16.1.0 / 17.0.0 made
    // submitTransaction reject with SDK error types (TransactionFailedError,
    // BadResponseError) that keep the HTTP client's error as `cause`. The app
    // still reads the response through `isHorizonError`: `response.status`
    // for the 504 retry (services/stellar.ts) and the log-severity split, and
    // `response.data.extras.result_codes` for rejections the user can fix
    // (ducks/transactionBuilder.ts, hooks/useManageTokens.ts). The app's own
    // tests build those errors by hand, so these drive the real
    // Horizon.Server against a stubbed fetch.
    const HORIZON_URL = "https://horizon-testnet.stellar.org";
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, "fetch");
    let fetchMock: jest.Mock;

    /** Stubs fetch so every request gets `status` with `body` as JSON. */
    const answerWith = (status: number, body: unknown) => {
      fetchMock = jest.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/problem+json" },
          }),
        ),
      );
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: fetchMock,
      });
    };

    /**
     * Builds and signs a payment like the app's sends. Its memo makes the
     * SDK skip the memo-required account lookup, so the submit is the only
     * request.
     */
    const buildSignedPayment = (): Transaction => {
      const tx = new TransactionBuilder(
        new Account(keypair.publicKey(), "100"),
        { fee: BASE_FEE, networkPassphrase },
      )
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: "1",
          }),
        )
        .addMemo(Memo.text("compat"))
        .setTimeout(30)
        .build();
      tx.sign(keypair);
      return tx;
    };

    /**
     * Submits through the real SDK, as `services/stellar.ts` does, and
     * returns what the submit rejects with.
     */
    const submitError = async (): Promise<unknown> => {
      const server = new Horizon.Server(HORIZON_URL);
      try {
        await server.submitTransaction(buildSignedPayment());
      } catch (error) {
        return error;
      }
      throw new Error("submitTransaction resolved; expected a rejection");
    };

    afterEach(() => {
      if (originalFetch) {
        Object.defineProperty(globalThis, "fetch", originalFetch);
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
    });

    it("rejects result codes with a TransactionFailedError that keeps the paths the app reads", async () => {
      const resultCodes = {
        transaction: "tx_failed",
        operations: ["op_underfunded"],
      };
      answerWith(400, {
        type: "https://stellar.org/horizon-errors/transaction_failed",
        title: "Transaction Failed",
        status: 400,
        extras: { envelope_xdr: "AAAA", result_codes: resultCodes },
      });

      const error = await submitError();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0][0])).toBe(
        `${HORIZON_URL}/transactions`,
      );
      expect(error).toBeInstanceOf(TransactionFailedError);
      expect(isHorizonError(error)).toBe(true);
      // The fields ducks/transactionBuilder.ts and hooks/useManageTokens.ts
      // read, through the same guard.
      const { response } = error as {
        response: {
          status: number;
          data: { extras: { result_codes: typeof resultCodes } };
        };
      };
      expect(response.status).toBe(400);
      expect(response.data.extras.result_codes).toEqual(resultCodes);
      expect(response.data.extras.result_codes.operations).toEqual([
        "op_underfunded",
      ]);
      expect((error as TransactionFailedError).getResultCodes()).toEqual(
        resultCodes,
      );
    });

    it("keeps a 4xx without result codes a BadResponseError with its status and body", async () => {
      answerWith(429, {
        type: "https://stellar.org/horizon-errors/rate_limit_exceeded",
        title: "Rate Limit Exceeded",
        status: 429,
      });

      const error = await submitError();

      expect(error).toBeInstanceOf(BadResponseError);
      expect(error).not.toBeInstanceOf(TransactionFailedError);
      expect(isHorizonError(error)).toBe(true);
      const { response } = error as {
        response: { status: number; data: { title: string; extras?: unknown } };
      };
      expect(response.status).toBe(429);
      expect(response.data.title).toBe("Rate Limit Exceeded");
      expect(response.data.extras).toBeUndefined();
    });

    it("exposes a 504 status for the app's submit retry", async () => {
      answerWith(504, {
        type: "https://stellar.org/horizon-errors/timeout",
        title: "Timeout",
        status: 504,
      });

      const error = await submitError();

      expect(isHorizonError(error)).toBe(true);
      expect((error as { response: { status: number } }).response.status).toBe(
        504,
      );
    });
  });
});
