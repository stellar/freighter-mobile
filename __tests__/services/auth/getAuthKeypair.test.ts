import { xdr } from "@stellar/stellar-sdk";
import * as authDuck from "ducks/auth";
import { clearAuthKeypairCache } from "services/auth/authKeypairCache";
import { AUTH_KEYPAIR_VECTORS } from "services/auth/authKeypairVectors";
import { getAuthKeypair } from "services/auth/getAuthKeypair";

// Mock ducks/auth: expose both getActiveMnemonicPhrase and isSessionAuthValid
// so we can drive the auth-status gate directly.
jest.mock("ducks/auth", () => ({
  getActiveMnemonicPhrase: jest.fn(),
  isSessionAuthValid: jest.fn(),
}));

const mockMnemonic = authDuck.getActiveMnemonicPhrase as jest.Mock;
const mockIsSessionAuthValid = authDuck.isSessionAuthValid as jest.Mock;
const M = AUTH_KEYPAIR_VECTORS[0];

describe("getAuthKeypair", () => {
  beforeEach(() => {
    clearAuthKeypairCache();
    jest.clearAllMocks();
    // Default: session is fully valid.
    mockIsSessionAuthValid.mockResolvedValue(true);
  });

  it("derives and memoizes (accessor called once for repeated calls)", async () => {
    mockMnemonic.mockResolvedValue(M.mnemonic);
    const a = await getAuthKeypair();
    const b = await getAuthKeypair();
    expect(a).not.toBeNull();
    expect(xdr.encodeBytes(a!.rawPublicKey(), "hex")).toBe(M.userId);
    expect(b).toBe(a); // same cached instance
    expect(mockMnemonic).toHaveBeenCalledTimes(1);
  });

  it("returns null when the session is invalid, before touching the mnemonic accessor", async () => {
    // isSessionAuthValid folds LOCKED / HASH_KEY_EXPIRED / NOT_AUTHENTICATED
    // into one boolean (the state→boolean mapping is covered in the duck tests).
    // The gate must fire before getActiveMnemonicPhrase is ever reached.
    mockIsSessionAuthValid.mockResolvedValue(false);
    mockMnemonic.mockResolvedValue(M.mnemonic); // would succeed if gate absent

    expect(await getAuthKeypair()).toBeNull();
    expect(mockMnemonic).not.toHaveBeenCalled();
  });

  it("warm cache is NOT returned after transitioning to LOCKED", async () => {
    // Populate cache while AUTHENTICATED.
    mockMnemonic.mockResolvedValue(M.mnemonic);
    const a = await getAuthKeypair();
    expect(a).not.toBeNull();

    // Transition to LOCKED — warm cache must be bypassed.
    mockIsSessionAuthValid.mockResolvedValue(false);

    expect(await getAuthKeypair()).toBeNull();
  });

  it("returns null when AUTHENTICATED but no mnemonic available", async () => {
    mockMnemonic.mockResolvedValue(null);
    expect(await getAuthKeypair()).toBeNull();
  });

  it("re-derives after cache clear, and on mnemonic change", async () => {
    mockMnemonic.mockResolvedValue(M.mnemonic);
    const a = await getAuthKeypair();
    clearAuthKeypairCache();
    mockMnemonic.mockResolvedValue(AUTH_KEYPAIR_VECTORS[1].mnemonic);
    const c = await getAuthKeypair();
    expect(xdr.encodeBytes(c!.rawPublicKey(), "hex")).toBe(
      AUTH_KEYPAIR_VECTORS[1].userId,
    );
    expect(c).not.toBe(a);
  });

  it("warm cache is NOT returned when hash key expired (session validity check fires even with warm cache)", async () => {
    // Populate cache while session is valid.
    mockIsSessionAuthValid.mockResolvedValue(true);
    mockMnemonic.mockResolvedValue(M.mnemonic);
    const a = await getAuthKeypair();
    expect(a).not.toBeNull();

    // Simulate hash key expiry: isSessionAuthValid returns false even though
    // authStatus is AUTHENTICATED in the store (the stale-authStatus window).
    mockIsSessionAuthValid.mockResolvedValue(false);

    expect(await getAuthKeypair()).toBeNull();
    // Mnemonic must not have been called on the second invocation.
    expect(mockMnemonic).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent first-derivations (accessor called once under a stampede)", async () => {
    mockMnemonic.mockResolvedValue(M.mnemonic);
    // Several callers race before the first derivation resolves (the
    // balances/prices/history burst on unlock).
    const [a, b, c] = await Promise.all([
      getAuthKeypair(),
      getAuthKeypair(),
      getAuthKeypair(),
    ]);
    expect(a).not.toBeNull();
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(mockMnemonic).toHaveBeenCalledTimes(1);
  });
});
