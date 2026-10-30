import {
  BASE_CONTRACT,
  G_ACCOUNT,
  M_ACCOUNT_ID_1234,
  MUXED_CONTRACT_ID_0,
  MUXED_CONTRACT_ID_1234,
  MUXED_CONTRACT_ID_U64_MAX,
  U64_MAX,
} from "__tests__/support/muxedContractFixtures";
import {
  buildMuxedContract,
  getMuxedContractBaseId,
  getMuxedContractMuxId,
  isContractDestination,
  isMuxedContract,
} from "helpers/muxedContract";

/**
 * These run against the real `@stellar/stellar-sdk` on purpose: the fixtures
 * are SDK-computed strkeys, and what is under test (strkey validation, the
 * uint64 range) is SDK behavior that a mock would only restate. Of the
 * malformed `W…` vectors, one is rejected for its base32 padding bit and one
 * for a real checksum mismatch; see the comments beside them.
 */
describe("isMuxedContract", () => {
  it("accepts W addresses", () => {
    [
      MUXED_CONTRACT_ID_0,
      MUXED_CONTRACT_ID_1234,
      MUXED_CONTRACT_ID_U64_MAX,
    ].forEach((w) => expect(isMuxedContract(w)).toBe(true));
  });

  it("rejects everything else", () => {
    [
      BASE_CONTRACT,
      G_ACCOUNT,
      M_ACCOUNT_ID_1234,
      "",
      ` ${MUXED_CONTRACT_ID_0}`,
      MUXED_CONTRACT_ID_0.toLowerCase(),
      // Last character C -> D sets the single base32 padding bit, so the
      // decoder rejects it before any checksum comparison happens.
      `${MUXED_CONTRACT_ID_0.slice(0, -1)}D`,
      // Second-to-last character W -> X flips a bit inside the stored
      // checksum, so the address decodes cleanly and then fails the checksum
      // comparison. This is the vector that pins checksum verification.
      `${MUXED_CONTRACT_ID_0.slice(0, -2)}X${MUXED_CONTRACT_ID_0.slice(-1)}`,
    ].forEach((a) => expect(isMuxedContract(a)).toBe(false));
  });
});

describe("isContractDestination", () => {
  it("is true for C and W only", () => {
    expect(isContractDestination(BASE_CONTRACT)).toBe(true);
    expect(isContractDestination(MUXED_CONTRACT_ID_0)).toBe(true);
    expect(isContractDestination(G_ACCOUNT)).toBe(false);
    expect(isContractDestination(M_ACCOUNT_ID_1234)).toBe(false);
  });
});

describe("W ↔ C + id", () => {
  it("splits W into base C and decimal id", () => {
    expect(getMuxedContractBaseId(MUXED_CONTRACT_ID_1234)).toBe(BASE_CONTRACT);
    expect(getMuxedContractMuxId(MUXED_CONTRACT_ID_0)).toBe("0");
    expect(getMuxedContractMuxId(MUXED_CONTRACT_ID_1234)).toBe("1234");
    expect(getMuxedContractMuxId(MUXED_CONTRACT_ID_U64_MAX)).toBe(U64_MAX);
  });

  it("builds W from C + id", () => {
    expect(buildMuxedContract(BASE_CONTRACT, "0")).toBe(MUXED_CONTRACT_ID_0);
    expect(buildMuxedContract(BASE_CONTRACT, "1234")).toBe(
      MUXED_CONTRACT_ID_1234,
    );
    expect(buildMuxedContract(BASE_CONTRACT, U64_MAX)).toBe(
      MUXED_CONTRACT_ID_U64_MAX,
    );
  });

  it("throws on invalid input", () => {
    ["18446744073709551616", "-1", "0x10", " 16 ", "", "abc"].forEach((id) =>
      expect(() => buildMuxedContract(BASE_CONTRACT, id)).toThrow(),
    );
    expect(() => buildMuxedContract(G_ACCOUNT, "1")).toThrow();
    expect(() => getMuxedContractBaseId(BASE_CONTRACT)).toThrow(
      "Not a muxed contract address",
    );
    expect(() => getMuxedContractMuxId(M_ACCOUNT_ID_1234)).toThrow(
      "Not a muxed contract address",
    );
  });
});
