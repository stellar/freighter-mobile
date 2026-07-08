import * as authDuck from "ducks/auth";
import { AUTH_KEYPAIR_VECTORS } from "services/auth/authKeypairVectors";
import {
  getAuthKeypair,
  clearAuthKeypairCache,
} from "services/auth/getAuthKeypair";

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
    expect(a!.rawPublicKey().toString("hex")).toBe(M.userId);
    expect(b).toBe(a); // same cached instance
    expect(mockMnemonic).toHaveBeenCalledTimes(1);
  });

  it("returns null when LOCKED even if getActiveMnemonicPhrase would return a mnemonic (regression guard)", async () => {
    // This is the real LOCKED path: fast-unlock preserved session.
    // getActiveMnemonicPhrase now also returns null when not AUTHENTICATED
    // (Fix 2), but the gate in getAuthKeypair fires first — this test proves
    // the accessor is never reached when LOCKED.
    mockIsSessionAuthValid.mockResolvedValue(false);
    mockMnemonic.mockResolvedValue(M.mnemonic); // would succeed if gate absent

    expect(await getAuthKeypair()).toBeNull();
    // The mnemonic accessor must NOT have been called — gate fires first.
    expect(mockMnemonic).not.toHaveBeenCalled();
  });

  it("returns null when HASH_KEY_EXPIRED", async () => {
    mockIsSessionAuthValid.mockResolvedValue(false);
    mockMnemonic.mockResolvedValue(M.mnemonic);

    expect(await getAuthKeypair()).toBeNull();
    expect(mockMnemonic).not.toHaveBeenCalled();
  });

  it("returns null when NOT_AUTHENTICATED", async () => {
    mockIsSessionAuthValid.mockResolvedValue(false);
    mockMnemonic.mockResolvedValue(M.mnemonic);

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
    expect(c!.rawPublicKey().toString("hex")).toBe(
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
});
