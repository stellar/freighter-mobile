/**
 * Which transaction memos fold into a muxed (`M…`) address.
 *
 * These run against the real `@stellar/stellar-sdk` on purpose: the expected
 * `M…` strings are SDK-encoded, and the accepted id format is SDK behavior
 * that a mock would only restate. Only `services/backend` is mocked.
 */
import {
  G_ACCOUNT,
  M_ACCOUNT_ID_1234,
  U64_MAX,
} from "__tests__/support/muxedContractFixtures";
import { determineMuxedDestination } from "helpers/muxedAddress";
import { createMuxedAccount } from "helpers/stellar";

// The muxed helpers import the backend client, which these tests never call.
jest.mock("services/backend");

describe("memo folding into M addresses", () => {
  it.each([
    ["1234", M_ACCOUNT_ID_1234],
    [
      "0",
      "MA4EFTUDCDT7QNG2FXFISAH7W3V42BIYINBGCMPS7ZUFUR6KBWG2QAAAAAAAAAAAAAAEE",
    ],
    [
      U64_MAX,
      "MA4EFTUDCDT7QNG2FXFISAH7W3V42BIYINBGCMPS7ZUFUR6KBWG2R7777777777777Q6I",
    ],
  ])("folds decimal uint64 memo %s into an M address", (memo, expected) => {
    expect(createMuxedAccount(G_ACCOUNT, memo)).toBe(expected);
  });

  it.each(["0x10", " 16 ", ""])(
    "does not fold memo %j (not a canonical decimal id, SDK 17.3+)",
    (memo) => {
      expect(createMuxedAccount(G_ACCOUNT, memo)).toBeNull();
    },
  );

  it.each(["18446744073709551616", "AB12CD"])(
    "does not fold memo %j (not a uint64)",
    (memo) => {
      expect(createMuxedAccount(G_ACCOUNT, memo)).toBeNull();
    },
  );

  it("determineMuxedDestination folds a decimal memo when the contract supports muxed", () => {
    expect(
      determineMuxedDestination({
        recipientAddress: G_ACCOUNT,
        transactionMemo: "1234",
        contractSupportsMuxed: true,
      }),
    ).toBe(M_ACCOUNT_ID_1234);
  });

  it.each(["0x10", "AB12CD"])(
    "determineMuxedDestination keeps the base address for memo %j",
    (memo) => {
      expect(
        determineMuxedDestination({
          recipientAddress: G_ACCOUNT,
          transactionMemo: memo,
          contractSupportsMuxed: true,
        }),
      ).toBe(G_ACCOUNT);
    },
  );
});
