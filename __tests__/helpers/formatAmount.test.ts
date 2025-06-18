import BigNumber from "bignumber.js";
import {
  formatAssetAmount,
  formatFiatAmount,
  formatPercentageAmount,
} from "helpers/formatAmount";

describe("formatAmount helpers", () => {
  describe("formatAssetAmount", () => {
    it("should format number values correctly", () => {
      expect(formatAssetAmount(1000)).toBe("1,000");
      expect(formatAssetAmount(1234.56)).toBe("1,234.56");
      expect(formatAssetAmount(0.12345)).toBe("0.12345");
    });

    it("should format string values correctly", () => {
      expect(formatAssetAmount("1000")).toBe("1,000");
      expect(formatAssetAmount("1234.56")).toBe("1,234.56");
      expect(formatAssetAmount("0.12345")).toBe("0.12345");
    });

    it("should format BigNumber values correctly", () => {
      expect(formatAssetAmount(new BigNumber(1000))).toBe("1,000");
      expect(formatAssetAmount(new BigNumber("1234.56"))).toBe("1,234.56");
      expect(formatAssetAmount(new BigNumber("0.12345"))).toBe("0.12345");
    });

    it("should include the asset code when provided", () => {
      expect(formatAssetAmount(1000, "XLM")).toBe("1,000 XLM");
      expect(formatAssetAmount("1234.56", "USDC")).toBe("1,234.56 USDC");
      expect(formatAssetAmount(new BigNumber("0.12345"), "BTC")).toBe(
        "0.12345 BTC",
      );
    });

    it("should handle very small numbers", () => {
      expect(formatAssetAmount(0.000001)).toBe("0.000001");
      expect(formatAssetAmount("0.000001")).toBe("0.000001");
      expect(formatAssetAmount(new BigNumber("0.0000012345"))).toBe(
        "0.0000012345",
      );
    });

    it("should handle very large numbers", () => {
      expect(formatAssetAmount(1000000000)).toBe("1,000,000,000");
      expect(formatAssetAmount("1000000000.12")).toBe("1,000,000,000.12");
      expect(formatAssetAmount(new BigNumber("1000000000.123456"))).toBe(
        "1,000,000,000.123456",
      );
    });

    it("should handle zero values", () => {
      expect(formatAssetAmount(0)).toBe("0");
      expect(formatAssetAmount("0")).toBe("0");
      expect(formatAssetAmount(new BigNumber(0))).toBe("0");
    });

    it("should handle negative values", () => {
      expect(formatAssetAmount(-1000)).toBe("-1,000");
      expect(formatAssetAmount("-1234.56")).toBe("-1,234.56");
      expect(formatAssetAmount(new BigNumber("-0.12345"))).toBe("-0.12345");
    });

    it("should handle objects with toString method", () => {
      const obj = { toString: () => "1234.56" };
      expect(formatAssetAmount(obj)).toBe("1,234.56");
    });

    it("should preserve trailing zeros in decimal part like extension", () => {
      expect(formatAssetAmount("1000.0001000")).toBe("1,000.0001000");
      expect(formatAssetAmount("0.0000039")).toBe("0.0000039");
      expect(formatAssetAmount("123.4500")).toBe("123.4500");
    });
  });

  describe("formatFiatAmount", () => {
    it("should format number values as USD currency", () => {
      expect(formatFiatAmount(1000)).toBe("$1,000.00");
      expect(formatFiatAmount(1234.56)).toBe("$1,234.56");
      expect(formatFiatAmount(0.12345)).toBe("$0.12");
    });

    it("should format string values as USD currency", () => {
      expect(formatFiatAmount("1000")).toBe("$1,000.00");
      expect(formatFiatAmount("1234.56")).toBe("$1,234.56");
      expect(formatFiatAmount("0.12345")).toBe("$0.12");
    });

    it("should format BigNumber values as USD currency", () => {
      expect(formatFiatAmount(new BigNumber(1000))).toBe("$1,000.00");
      expect(formatFiatAmount(new BigNumber("1234.56"))).toBe("$1,234.56");
      expect(formatFiatAmount(new BigNumber("0.12345"))).toBe("$0.12");
    });

    it("should handle very small numbers", () => {
      expect(formatFiatAmount(0.001)).toBe("$0.00");
      expect(formatFiatAmount("0.001")).toBe("$0.00");
      expect(formatFiatAmount(new BigNumber("0.0000012345"))).toBe("$0.00");
    });

    it("should handle very large numbers", () => {
      expect(formatFiatAmount(1000000000)).toBe("$1,000,000,000.00");
      expect(formatFiatAmount("1000000000.12")).toBe("$1,000,000,000.12");
      expect(formatFiatAmount(new BigNumber("1000000000.123456"))).toBe(
        "$1,000,000,000.12",
      );
    });

    it("should handle zero values", () => {
      expect(formatFiatAmount(0)).toBe("$0.00");
      expect(formatFiatAmount("0")).toBe("$0.00");
      expect(formatFiatAmount(new BigNumber(0))).toBe("$0.00");
    });

    it("should handle negative values", () => {
      expect(formatFiatAmount(-1000)).toBe("-$1,000.00");
      expect(formatFiatAmount("-1234.56")).toBe("-$1,234.56");
      expect(formatFiatAmount(new BigNumber("-0.12345"))).toBe("-$0.12");
    });

    it("should handle objects with toString method", () => {
      const obj = { toString: () => "1234.56" };
      expect(formatFiatAmount(obj)).toBe("$1,234.56");
    });
  });

  describe("formatPercentageAmount", () => {
    it("should format positive number values with plus sign", () => {
      expect(formatPercentageAmount(0.1)).toBe("+0.10%");
      expect(formatPercentageAmount(1.23)).toBe("+1.23%");
      expect(formatPercentageAmount(10)).toBe("+10.00%");
    });

    it("should format negative number values with minus sign", () => {
      expect(formatPercentageAmount(-0.1)).toBe("-0.10%");
      expect(formatPercentageAmount(-1.23)).toBe("-1.23%");
      expect(formatPercentageAmount(-10)).toBe("-10.00%");
    });

    it("should format string values", () => {
      expect(formatPercentageAmount("0.1")).toBe("+0.10%");
      expect(formatPercentageAmount("-1.23")).toBe("-1.23%");
    });

    it("should format BigNumber values", () => {
      expect(formatPercentageAmount(new BigNumber(0.1))).toBe("+0.10%");
      expect(formatPercentageAmount(new BigNumber(-1.23))).toBe("-1.23%");
    });

    it("should handle very small numbers", () => {
      expect(formatPercentageAmount(0.001)).toBe("+0.00%");
      expect(formatPercentageAmount(-0.0001)).toBe("-0.00%");
    });

    it("should handle very large numbers", () => {
      expect(formatPercentageAmount(1234.5678)).toBe("+1234.57%");
      expect(formatPercentageAmount(-1234.5678)).toBe("-1234.57%");
    });

    it("should handle zero value", () => {
      expect(formatPercentageAmount(0)).toBe("0.00%");
      expect(formatPercentageAmount("0")).toBe("0.00%");
      expect(formatPercentageAmount(new BigNumber(0))).toBe("0.00%");
    });

    it("should handle undefined input", () => {
      expect(formatPercentageAmount()).toBe("--");
      expect(formatPercentageAmount(null)).toBe("--");
      expect(formatPercentageAmount(undefined)).toBe("--");
    });

    it("should handle objects with toString method", () => {
      const obj = { toString: () => "1.23" };
      expect(formatPercentageAmount(obj)).toBe("+1.23%");

      const negObj = { toString: () => "-1.23" };
      expect(formatPercentageAmount(negObj)).toBe("-1.23%");
    });
  });
});
