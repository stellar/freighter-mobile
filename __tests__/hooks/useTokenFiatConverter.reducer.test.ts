import { BigNumber } from "bignumber.js";
import { DEFAULT_DECIMALS } from "config/constants";
import {
  normalizeZeroDisplay,
  recalculateTokenAmountFromFiat,
  recalculateFiatAmountFromToken,
  normalizeInternalAmount,
  areNumericValuesEqual,
} from "hooks/useTokenFiatConverter/reducer";
import * as ReactNativeLocalize from "react-native-localize";

describe("useTokenFiatConverter reducer helper functions", () => {
  describe("normalizeZeroDisplay", () => {
    // These are formatted values (from calculations) that should be normalized to "0"
    it.each([
      ["0", "."], // Works with any separator
    ])("should normalize '%s' to '0'", (input, separator) => {
      jest
        .spyOn(ReactNativeLocalize, "getNumberFormatSettings")
        .mockReturnValue({
          decimalSeparator: separator,
        } as ReactNativeLocalize.NumberFormatSettings);

      const result = normalizeZeroDisplay(input);
      expect(result).toBe("0");
    });

    // These are active decimal inputs that should be preserved
    it.each([
      ["0,0", ","],
      ["0.0", "."],
      ["0,00", ","],
      ["0.00", "."],
      ["0,01", ","],
      ["0.01", "."],
      ["0,1", ","],
      ["0.1", "."],
    ])("should preserve active decimal input '%s'", (input, separator) => {
      jest
        .spyOn(ReactNativeLocalize, "getNumberFormatSettings")
        .mockReturnValue({
          decimalSeparator: separator,
        } as ReactNativeLocalize.NumberFormatSettings);

      const result = normalizeZeroDisplay(input);
      expect(result).toBe(input);
    });

    it.each([
      ["0,", ","],
      ["0.", "."],
      [".", "."],
      [",", ","],
    ])("should preserve partial decimal input '%s'", (input, separator) => {
      jest
        .spyOn(ReactNativeLocalize, "getNumberFormatSettings")
        .mockReturnValue({
          decimalSeparator: separator,
        } as ReactNativeLocalize.NumberFormatSettings);

      const result = normalizeZeroDisplay(input);
      expect(result).toBe(input);
    });

    it.each([["1.23"], ["0.01"], ["10"]])(
      "should not normalize non-zero value '%s'",
      (input) => {
        const result = normalizeZeroDisplay(input);
        expect(result).toBe(input);
      },
    );
  });

  describe("recalculateTokenAmountFromFiat", () => {
    const tokenPrice = new BigNumber(2.5);
    const tokenDecimals = DEFAULT_DECIMALS;

    it("should calculate token amount from fiat amount correctly", () => {
      const result = recalculateTokenAmountFromFiat(
        "10",
        tokenPrice,
        tokenDecimals,
      );
      expect(result).toBe("4.0000000"); // 10 / 2.5 = 4
    });

    it("should handle decimal fiat amounts", () => {
      const result = recalculateTokenAmountFromFiat(
        "2.5",
        tokenPrice,
        tokenDecimals,
      );
      expect(result).toBe("1.0000000"); // 2.5 / 2.5 = 1
    });

    it("should handle custom token decimals", () => {
      const customDecimals = 4;
      const result = recalculateTokenAmountFromFiat(
        "10",
        tokenPrice,
        customDecimals,
      );
      expect(result).toBe("4.0000"); // Should use 4 decimals
    });

    it.each([
      ["0", tokenPrice],
      ["", tokenPrice],
      ["invalid", tokenPrice],
      ["10", new BigNumber(0)],
    ])("should return zero for edge cases", (fiatAmount, price) => {
      const result = recalculateTokenAmountFromFiat(
        fiatAmount,
        price,
        tokenDecimals,
      );
      expect(result).toBe("0.0000000");
    });
  });

  describe("recalculateFiatAmountFromToken", () => {
    const tokenPrice = new BigNumber(2.5);

    it("should calculate fiat amount from token amount correctly", () => {
      const result = recalculateFiatAmountFromToken("4", tokenPrice);
      expect(result).toBe("10.00"); // 4 * 2.5 = 10
    });

    it("should handle decimal token amounts", () => {
      const result = recalculateFiatAmountFromToken("1.5", tokenPrice);
      expect(result).toBe("3.75"); // 1.5 * 2.5 = 3.75
    });

    it("should always return 2 decimal places for fiat", () => {
      const result = recalculateFiatAmountFromToken("1", tokenPrice);
      expect(result).toBe("2.50"); // Should have 2 decimals
    });

    it.each([
      ["0", tokenPrice],
      ["", tokenPrice],
      ["invalid", tokenPrice],
      ["10", new BigNumber(0)],
    ])("should return zero for edge cases", (tokenAmount, price) => {
      const result = recalculateFiatAmountFromToken(tokenAmount, price);
      expect(result).toBe("0.00");
    });
  });

  describe("normalizeInternalAmount", () => {
    it.each([
      ["1,23", "1.23"],
      ["1.23.", "1.23"],
      ["1,23,", "1.23"],
      ["0.", "0"],
      ["0,", "0"],
      ["123", "123"],
      ["1.23", "1.23"],
    ])("should normalize '%s' to '%s'", (input, expected) => {
      const result = normalizeInternalAmount(input);
      expect(result).toBe(expected);
    });
  });

  describe("areNumericValuesEqual", () => {
    it.each([
      ["1.5", "1.5"],
      ["0.50", "0.5"],
      ["1.00", "1"],
      ["0", "0.00"],
      ["", "0"],
      ["0", ""],
    ])("should return true for '%s' and '%s'", (value1, value2) => {
      const result = areNumericValuesEqual(value1, value2);
      expect(result).toBe(true);
    });

    it.each([
      ["1.5", "1.6"],
      ["1", "2"],
    ])(
      "should return false for different values '%s' and '%s'",
      (value1, value2) => {
        const result = areNumericValuesEqual(value1, value2);
        expect(result).toBe(false);
      },
    );
  });
});
