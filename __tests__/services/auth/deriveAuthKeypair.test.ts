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
    ({ mnemonic, authSeedHex, userId }) => {
      expect(deriveAuthSeed(mnemonic).toString("hex")).toBe(authSeedHex);
      expect(deriveAuthKeypair(mnemonic).userId).toBe(userId);
    },
  );

  it("is deterministic", () => {
    const m = AUTH_KEYPAIR_VECTORS[0].mnemonic;
    const call1 = deriveAuthKeypair(m);
    const call2 = deriveAuthKeypair(m);
    expect(call1.userId).toBe(call2.userId);
    expect(call1.publicKey).toBe(call2.publicKey);
  });

  it("emits lowercase 64-char hex", () => {
    expect(deriveAuthKeypair(AUTH_KEYPAIR_VECTORS[0].mnemonic).userId).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  it("is independent from the wallet account-0 key", () => {
    const m = AUTH_KEYPAIR_VECTORS[0].mnemonic;
    // Verified wallet account-0 public key hex for this mnemonic
    const walletAccountZeroHex =
      "7691d85048acc4ed085d9061ce0948bbdf7de6a92b790aaf241d31b7dcaa4238";
    expect(deriveAuthKeypair(m).userId).not.toBe(walletAccountZeroHex);
  });

  it("throws on an invalid mnemonic", () => {
    expect(() => deriveAuthKeypair("not a valid mnemonic")).toThrow(
      /invalid mnemonic/i,
    );
  });
});
