/**
 * Stellar SDK v15 Compatibility Tests
 *
 * Exercises core SDK operations used by freighter-mobile to verify
 * they work correctly after the v14 → v15 upgrade (Protocol 26).
 * Uses real SDK calls (no mocks) to catch XDR or API regressions.
 */

import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  FeeBumpTransaction,
  Keypair,
  Networks,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
  hash,
  walkInvocationTree,
  xdr,
} from "@stellar/stellar-sdk";

describe("Stellar SDK v15 compatibility", () => {
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

      const xdrString = tx.toXDR();
      const restored = TransactionBuilder.fromXDR(
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

      const xdrString = feeBump.toXDR();
      const restored = TransactionBuilder.fromXDR(
        xdrString,
        networkPassphrase,
      );

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

      const sigBytes = tx.signatures[0].signature();
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
    it("returns a 32-byte Buffer for network passphrase", () => {
      const result = hash(Buffer.from(networkPassphrase));
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(32);
    });

    it("produces consistent output", () => {
      const input = Buffer.from("test-input");
      const hash1 = hash(input);
      const hash2 = hash(input);
      expect(hash1.toString("hex")).toBe(hash2.toString("hex"));
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

  describe("walkInvocationTree export", () => {
    it("is exported and is a function", () => {
      expect(typeof walkInvocationTree).toBe("function");
    });
  });

  describe("XDR type construction", () => {
    it("constructs and reads an ScVal i128", () => {
      const scVal = xdr.ScVal.scvI128(
        new xdr.Int128Parts({
          lo: xdr.Uint64.fromString("1000000"),
          hi: xdr.Int64.fromString("0"),
        }),
      );
      expect(scVal.switch().name).toBe("scvI128");
      const parts = scVal.i128();
      expect(parts.lo().toString()).toBe("1000000");
      expect(parts.hi().toString()).toBe("0");
    });

    it("constructs an ScAddress for an account", () => {
      const scAddr = xdr.ScAddress.scAddressTypeAccount(
        xdr.PublicKey.publicKeyTypeEd25519(
          StrKey.decodeEd25519PublicKey(keypair.publicKey()),
        ),
      );
      expect(scAddr.switch().name).toBe("scAddressTypeAccount");
    });
  });
});
