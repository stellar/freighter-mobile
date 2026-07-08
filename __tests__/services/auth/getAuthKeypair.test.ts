import { AUTH_STATUS } from "config/types";
import * as authDuck from "ducks/auth";
import { AUTH_KEYPAIR_VECTORS } from "services/auth/authKeypairVectors";
import {
  getAuthKeypair,
  clearAuthKeypairCache,
} from "services/auth/getAuthKeypair";

// Mock ducks/auth: expose both getActiveMnemonicPhrase and useAuthenticationStore
// with a controllable getState so we can drive the auth-status gate directly.
let mockAuthStatus: string = AUTH_STATUS.AUTHENTICATED;

jest.mock("ducks/auth", () => ({
  getActiveMnemonicPhrase: jest.fn(),
  useAuthenticationStore: {
    getState: jest.fn(() => ({ authStatus: mockAuthStatus })),
  },
}));

const mockMnemonic = authDuck.getActiveMnemonicPhrase as jest.Mock;
const mockGetState = authDuck.useAuthenticationStore.getState as jest.Mock;
const M = AUTH_KEYPAIR_VECTORS[0];

describe("getAuthKeypair", () => {
  beforeEach(() => {
    clearAuthKeypairCache();
    jest.clearAllMocks();
    // Default: fully authenticated, so the status gate passes.
    mockAuthStatus = AUTH_STATUS.AUTHENTICATED;
    mockGetState.mockImplementation(() => ({ authStatus: mockAuthStatus }));
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
    // getActiveMnemonicPhrase deliberately allows LOCKED, so without the
    // auth-status gate it would still yield a keypair — this test proves it
    // no longer does.
    mockAuthStatus = AUTH_STATUS.LOCKED;
    mockGetState.mockImplementation(() => ({ authStatus: mockAuthStatus }));
    mockMnemonic.mockResolvedValue(M.mnemonic); // would succeed if gate absent

    expect(await getAuthKeypair()).toBeNull();
    // The mnemonic accessor must NOT have been called — gate fires first.
    expect(mockMnemonic).not.toHaveBeenCalled();
  });

  it("returns null when HASH_KEY_EXPIRED", async () => {
    mockAuthStatus = AUTH_STATUS.HASH_KEY_EXPIRED;
    mockGetState.mockImplementation(() => ({ authStatus: mockAuthStatus }));
    mockMnemonic.mockResolvedValue(M.mnemonic);

    expect(await getAuthKeypair()).toBeNull();
    expect(mockMnemonic).not.toHaveBeenCalled();
  });

  it("returns null when NOT_AUTHENTICATED", async () => {
    mockAuthStatus = AUTH_STATUS.NOT_AUTHENTICATED;
    mockGetState.mockImplementation(() => ({ authStatus: mockAuthStatus }));
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
    mockAuthStatus = AUTH_STATUS.LOCKED;
    mockGetState.mockImplementation(() => ({ authStatus: mockAuthStatus }));

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
});
