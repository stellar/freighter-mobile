import {
  getQuoteExpiredOperationCodes,
  isQuoteExpiredResultCodes,
} from "components/screens/SwapScreen/helpers/quoteErrors";

describe("getQuoteExpiredOperationCodes", () => {
  it("returns the matched quote-expired code", () => {
    expect(
      getQuoteExpiredOperationCodes({ operations: ["op_under_dest_min"] }),
    ).toEqual(["op_under_dest_min"]);
  });

  it("filters out benign codes, keeping only the quote-expired ones", () => {
    expect(
      getQuoteExpiredOperationCodes({
        operations: ["op_success", "op_under_dest_min"],
      }),
    ).toEqual(["op_under_dest_min"]);
  });

  it("returns all matched codes when several are present", () => {
    expect(
      getQuoteExpiredOperationCodes({
        operations: ["op_under_dest_min", "op_too_few_offers"],
      }),
    ).toEqual(["op_under_dest_min", "op_too_few_offers"]);
  });

  it("returns [] for benign / null / undefined / empty", () => {
    expect(
      getQuoteExpiredOperationCodes({ operations: ["op_success"] }),
    ).toEqual([]);
    expect(getQuoteExpiredOperationCodes(null)).toEqual([]);
    expect(getQuoteExpiredOperationCodes(undefined)).toEqual([]);
    expect(getQuoteExpiredOperationCodes({ operations: [] })).toEqual([]);
    expect(getQuoteExpiredOperationCodes({ transaction: "tx_failed" })).toEqual(
      [],
    );
  });
});

describe("isQuoteExpiredResultCodes", () => {
  it("returns true when operations contain op_under_dest_min", () => {
    expect(
      isQuoteExpiredResultCodes({ operations: ["op_under_dest_min"] }),
    ).toBe(true);
  });

  it("returns true when operations contain op_too_few_offers", () => {
    expect(
      isQuoteExpiredResultCodes({ operations: ["op_too_few_offers"] }),
    ).toBe(true);
  });

  it("returns false for a benign operation code", () => {
    expect(isQuoteExpiredResultCodes({ operations: ["op_success"] })).toBe(
      false,
    );
  });

  it("returns false for null", () => {
    expect(isQuoteExpiredResultCodes(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isQuoteExpiredResultCodes(undefined)).toBe(false);
  });

  it("returns false for empty operations", () => {
    expect(isQuoteExpiredResultCodes({ operations: [] })).toBe(false);
  });

  it("returns false when only a transaction-level code is present", () => {
    expect(isQuoteExpiredResultCodes({ transaction: "tx_failed" })).toBe(false);
  });
});
