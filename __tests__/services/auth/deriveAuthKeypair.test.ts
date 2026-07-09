import { AUTH_KEYPAIR_VECTORS } from "services/auth/authKeypairVectors";
import {
  AUTH_SALT,
  deriveAuthKeypair,
  deriveAuthSeed,
} from "services/auth/deriveAuthKeypair";

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
