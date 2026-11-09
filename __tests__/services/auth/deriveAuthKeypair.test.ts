import { Keypair, xdr } from "@stellar/stellar-sdk";
import { createHmac } from "crypto";
import {
  ACCOUNT_SOURCE_VECTORS,
  AUTH_KEYPAIR_VECTORS,
  SOURCE_IDENTITY_VECTOR,
} from "services/auth/authKeypairVectors";
import {
  AUTH_SALT,
  deriveAuthKeypair,
  deriveAuthSeed,
  deriveSourceIdentity,
} from "services/auth/deriveAuthKeypair";

const pubHex = (keypair: Keypair): string =>
  xdr.encodeBytes(keypair.rawPublicKey(), "hex");

const accountRows = ACCOUNT_SOURCE_VECTORS.flatMap(({ mnemonic, accounts }) =>
  accounts.map((account) => ({ mnemonic, ...account })),
);

describe("deriveAuthKeypair", () => {
  it("uses the versioned salt", () => {
    expect(AUTH_SALT).toBe("freighter-auth-v1");
  });

  it.each(AUTH_KEYPAIR_VECTORS)(
    "matches vector %#",
    async ({ mnemonic, authSeedHex, userId }) => {
      expect((await deriveAuthSeed(mnemonic)).toString("hex")).toBe(
        authSeedHex,
      );
      expect((await deriveAuthKeypair(mnemonic)).userId).toBe(userId);
    },
  );

  it("is deterministic", async () => {
    const m = AUTH_KEYPAIR_VECTORS[0].mnemonic;
    const call1 = await deriveAuthKeypair(m);
    const call2 = await deriveAuthKeypair(m);
    expect(call1.userId).toBe(call2.userId);
    expect(call1.keypair.publicKey()).toBe(call2.keypair.publicKey());
  });

  it("emits lowercase 64-char hex", async () => {
    expect(
      (await deriveAuthKeypair(AUTH_KEYPAIR_VECTORS[0].mnemonic)).userId,
    ).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is independent from the wallet account-0 key", async () => {
    const m = AUTH_KEYPAIR_VECTORS[0].mnemonic;
    // Verified wallet account-0 public key hex for this mnemonic
    const walletAccountZeroHex =
      "7691d85048acc4ed085d9061ce0948bbdf7de6a92b790aaf241d31b7dcaa4238";
    expect((await deriveAuthKeypair(m)).userId).not.toBe(walletAccountZeroHex);
  });

  it("rejects on an invalid mnemonic", async () => {
    await expect(deriveAuthKeypair("not a valid mnemonic")).rejects.toThrow(
      /invalid mnemonic/i,
    );
  });
});

describe("deriveSourceIdentity", () => {
  const fixedSeed = () => Buffer.from(SOURCE_IDENTITY_VECTOR.seed32Hex, "hex");

  it("derives the committed sourceId for the fixed 32-byte seed", async () => {
    const { sourceId, keypair } = await deriveSourceIdentity(fixedSeed());
    expect(sourceId).toBe(SOURCE_IDENTITY_VECTOR.sourceId);
    expect(sourceId).toMatch(/^[0-9a-f]{64}$/);
    expect(pubHex(keypair)).toBe(sourceId);
  });

  it("is deterministic for the same seed", async () => {
    const a = await deriveSourceIdentity(fixedSeed());
    const b = await deriveSourceIdentity(fixedSeed());
    expect(a.sourceId).toBe(b.sourceId);
    expect(pubHex(a.keypair)).toBe(pubHex(b.keypair));
  });

  it("accepts a plain Uint8Array seed, not only a Buffer", async () => {
    const seed = new Uint8Array(fixedSeed());
    expect((await deriveSourceIdentity(seed)).sourceId).toBe(
      SOURCE_IDENTITY_VECTOR.sourceId,
    );
  });

  // A 64-byte input is the dangerous one: HMAC would accept it and the result
  // would be a phrase id, silently conflating the two source kinds.
  it.each([31, 33, 64])(
    "rejects a %d-byte seed instead of producing an id",
    async (length) => {
      await expect(
        deriveSourceIdentity(new Uint8Array(length).fill(1)),
      ).rejects.toThrow(/32 bytes/);
    },
  );

  // Pins the construction independently of the module's private helper: same
  // salt as the phrase derivation, HMAC-SHA256, keyed on the 32-byte seed.
  it("is pub(HMAC-SHA256(seed32, AUTH_SALT))", async () => {
    const seed = fixedSeed();
    const mac = createHmac("sha256", seed).update(AUTH_SALT).digest();
    const expected = pubHex(Keypair.fromRawEd25519Seed(mac));
    expect((await deriveSourceIdentity(seed)).sourceId).toBe(expected);
  });
});

// The phrase-path == exported-secret equality lives in
// identityContinuity.test.ts, next to the continuity guard.
describe("deriveSourceIdentity (account vectors)", () => {
  it.each(accountRows)(
    "differs from the phrase userId for $mnemonic index $index",
    async ({ mnemonic, sourceId }) => {
      const { userId } = await deriveAuthKeypair(mnemonic);
      expect(sourceId).not.toBe(userId);
    },
  );

  // An id equal to the account's public key would let the identity table
  // reveal G addresses.
  it.each(accountRows)(
    "differs from the account's own public key for $mnemonic index $index",
    ({ secret, sourceId }) => {
      expect(sourceId).not.toBe(pubHex(Keypair.fromSecret(secret)));
    },
  );

  it.each(ACCOUNT_SOURCE_VECTORS)(
    "account ids for one phrase are pairwise distinct ($mnemonic)",
    ({ accounts }) => {
      const ids = accounts.map(({ sourceId }) => sourceId);
      expect(new Set(ids).size).toBe(ids.length);
    },
  );

  it("account ids across phrases are distinct from each other and from every phrase userId", () => {
    const ids = [
      ...accountRows.map(({ sourceId }) => sourceId),
      ...AUTH_KEYPAIR_VECTORS.map(({ userId }) => userId),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
