import { shouldShowMemo } from "components/screens/HistoryScreen/helpers";
import { TransactionType } from "components/screens/HistoryScreen/types";

describe("shouldShowMemo", () => {
  describe("returns true (show memo)", () => {
    it("shows memo for PAYMENT when destination is not muxed", () => {
      expect(shouldShowMemo(TransactionType.PAYMENT, false)).toBe(true);
    });

    it("shows memo for CREATE_ACCOUNT when destination is not muxed", () => {
      expect(shouldShowMemo(TransactionType.CREATE_ACCOUNT, false)).toBe(true);
    });
  });

  describe("returns false (hide memo) for muxed destinations", () => {
    it("hides memo for PAYMENT when destination is muxed", () => {
      expect(shouldShowMemo(TransactionType.PAYMENT, true)).toBe(false);
    });

    it("hides memo for CREATE_ACCOUNT when destination is muxed", () => {
      expect(shouldShowMemo(TransactionType.CREATE_ACCOUNT, true)).toBe(false);
    });
  });

  describe("returns false (hide memo) for non-classic transaction types", () => {
    const nonClassicTypes = [
      TransactionType.SWAP,
      TransactionType.CHANGE_TRUST,
      TransactionType.CONTRACT,
      TransactionType.CONTRACT_MINT,
      TransactionType.CONTRACT_TRANSFER,
      TransactionType.UNKNOWN,
    ];

    it.each(nonClassicTypes)(
      "hides memo for %s (not muxed)",
      (transactionType) => {
        expect(shouldShowMemo(transactionType, false)).toBe(false);
      },
    );

    it.each(nonClassicTypes)("hides memo for %s (muxed)", (transactionType) => {
      expect(shouldShowMemo(transactionType, true)).toBe(false);
    });
  });
});
