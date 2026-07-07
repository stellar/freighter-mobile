import * as authDuck from "ducks/auth";
import { AUTH_KEYPAIR_VECTORS } from "services/auth/authKeypairVectors";
import {
  getAuthKeypair,
  clearAuthKeypairCache,
} from "services/auth/getAuthKeypair";

jest.mock("ducks/auth", () => ({ getActiveMnemonicPhrase: jest.fn() }));
const mockMnemonic = authDuck.getActiveMnemonicPhrase as jest.Mock;
const M = AUTH_KEYPAIR_VECTORS[0];

describe("getAuthKeypair", () => {
  beforeEach(() => {
    clearAuthKeypairCache();
    jest.clearAllMocks();
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

  it("returns null when locked (no mnemonic)", async () => {
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
