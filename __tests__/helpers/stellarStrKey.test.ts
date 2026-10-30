import {
  BASE_CONTRACT,
  G_ACCOUNT,
  M_ACCOUNT_ID_1234,
  MUXED_CONTRACT_ID_0,
} from "__tests__/support/muxedContractFixtures";
import { scrubStrKeys } from "helpers/stellarStrKey";

describe("scrubStrKeys", () => {
  const S_KEY = "SBKWZZZ3GQOUQYTDYNAXDGN6WXBOFKGTRMD2IOGLJYXUTH4MHWNZFAHK"; // pattern-only; checksum need not be valid

  it.each([
    ["G", G_ACCOUNT],
    ["S", S_KEY],
    ["C", BASE_CONTRACT],
    ["M", M_ACCOUNT_ID_1234],
    ["W", MUXED_CONTRACT_ID_0],
  ])("replaces a %s… key with its prefix sentinel", (prefix, key) => {
    expect(scrubStrKeys(`failed for ${key} on testnet`)).toBe(
      `failed for ${prefix}*** on testnet`,
    );
  });

  it("scrubs every key in a string", () => {
    expect(scrubStrKeys(`${G_ACCOUNT} -> ${MUXED_CONTRACT_ID_0}`)).toBe(
      "G*** -> W***",
    );
  });

  it("leaves a same-length run inside a longer token alone", () => {
    expect(scrubStrKeys(`x${MUXED_CONTRACT_ID_0}x`)).toBe(
      `x${MUXED_CONTRACT_ID_0}x`,
    );
  });

  it("returns undefined for a missing input", () => {
    expect(scrubStrKeys(null)).toBeUndefined();
    expect(scrubStrKeys(undefined)).toBeUndefined();
  });
});
