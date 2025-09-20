import BigNumber from "bignumber.js";
import {
  formatTokenAmount,
  formatFiatAmount,
  formatPercentageAmount,
  formatNumberForLocale,
  formatBigNumberForLocale,
  getLocaleDecimalSeparator,
  parseLocaleNumber,
  parseLocaleNumberToBigNumber,
} from "helpers/formatAmount";

// Mock the OS locale detection for consistent test behavior
jest.mock("helpers/getOsLanguage", () => ({
  __esModule: true,
  default: () => "en", // Mock default export (getOSLanguage)
  getOSLocale: () => "en-US", // Mock named export (getOSLocale)
}));

describe("formatAmount helpers", () => {
  describe("formatTokenAmount", () => {
    it("should format number values correctly", () => {
      expect(formatTokenAmount(1000)).toBe("1,000.00");
      expect(formatTokenAmount(1234.56)).toBe("1,234.56");
      expect(formatTokenAmount(0.12345)).toBe("0.12345");
    });

    it("should format string values correctly", () => {
      expect(formatTokenAmount("1000")).toBe("1,000.00");
      expect(formatTokenAmount("1234.56")).toBe("1,234.56");
      expect(formatTokenAmount("0.12345")).toBe("0.12345");
    });

    it("should format BigNumber values correctly", () => {
      expect(formatTokenAmount(new BigNumber(1000))).toBe("1,000.00");
      expect(formatTokenAmount(new BigNumber("1234.56"))).toBe("1,234.56");
      expect(formatTokenAmount(new BigNumber("0.12345"))).toBe("0.12345");
    });

    it("should include the token code when provided", () => {
      expect(formatTokenAmount(1000, "XLM")).toBe("1,000.00 XLM");
      expect(formatTokenAmount("1234.56", "USDC")).toBe("1,234.56 USDC");
      expect(formatTokenAmount(new BigNumber("0.12345"), "BTC")).toBe(
        "0.12345 BTC",
      );
    });

    it("should handle very small numbers", () => {
      expect(formatTokenAmount(0.000001)).toBe("0.000001");
      expect(formatTokenAmount("0.000001")).toBe("0.000001");
      expect(formatTokenAmount(new BigNumber("0.0000012345"))).toBe(
        "0.0000012345",
      );
    });

    it("should handle very large numbers", () => {
      expect(formatTokenAmount(1000000000)).toBe("1,000,000,000.00");
      expect(formatTokenAmount("1000000000.12")).toBe("1,000,000,000.12");
      expect(formatTokenAmount(new BigNumber("1000000000.123456"))).toBe(
        "1,000,000,000.123456",
      );
    });

    it("should handle zero values", () => {
      expect(formatTokenAmount(0)).toBe("0.00");
      expect(formatTokenAmount("0")).toBe("0.00");
      expect(formatTokenAmount(new BigNumber(0))).toBe("0.00");
    });

    it("should handle negative values", () => {
      expect(formatTokenAmount(-1000)).toBe("-1,000.00");
      expect(formatTokenAmount("-1234.56")).toBe("-1,234.56");
      expect(formatTokenAmount(new BigNumber("-0.12345"))).toBe("-0.12345");
    });

    it("should handle objects with toString method", () => {
      const obj = { toString: () => "1234.56" };
      expect(formatTokenAmount(obj)).toBe("1,234.56");
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

    it("should use device locale for formatting (mocked as en-US in tests)", () => {
      // These tests use the mocked device locale (en-US)
      expect(formatPercentageAmount(1.23)).toBe("+1.23%");
      expect(formatPercentageAmount(-1.23)).toBe("-1.23%");
      expect(formatPercentageAmount(0)).toBe("0.00%");
      expect(formatPercentageAmount(1234.5678)).toBe("+1234.57%");
      expect(formatPercentageAmount(-1234.5678)).toBe("-1234.57%");
    });

    it("should format with locale-aware decimal separators for US locale", () => {
      expect(formatPercentageAmount(1.23, "en-US")).toBe("+1.23%");
      expect(formatPercentageAmount(-1.23, "en-US")).toBe("-1.23%");
      expect(formatPercentageAmount(0, "en-US")).toBe("0.00%");
    });

    it("should format with locale-aware decimal separators for German locale", () => {
      expect(formatPercentageAmount(1.23, "de-DE")).toBe("+1,23%");
      expect(formatPercentageAmount(-1.23, "de-DE")).toBe("-1,23%");
      expect(formatPercentageAmount(0, "de-DE")).toBe("0,00%");
    });

    it("should format with locale-aware decimal separators for Portuguese Brazil locale", () => {
      expect(formatPercentageAmount(1.23, "pt-BR")).toBe("+1,23%");
      expect(formatPercentageAmount(-1.23, "pt-BR")).toBe("-1,23%");
      expect(formatPercentageAmount(0, "pt-BR")).toBe("0,00%");
    });

    it("should format with locale-aware decimal separators for French locale", () => {
      expect(formatPercentageAmount(1.23, "fr-FR")).toBe("+1,23%");
      expect(formatPercentageAmount(-1.23, "fr-FR")).toBe("-1,23%");
      expect(formatPercentageAmount(0, "fr-FR")).toBe("0,00%");
    });

    it("should maintain precision with locale formatting", () => {
      expect(formatPercentageAmount(1234.5678, "en-US")).toBe("+1234.57%");
      expect(formatPercentageAmount(1234.5678, "de-DE")).toBe("+1234,57%");
      expect(formatPercentageAmount(-1234.5678, "pt-BR")).toBe("-1234,57%");
    });

    it("should work with pt-BR locale formatting capability", () => {
      // Test formatPercentageAmount directly with pt-BR locale
      expect(formatPercentageAmount(1.23, "pt-BR")).toBe("+1,23%");
      expect(formatPercentageAmount(-1.23, "pt-BR")).toBe("-1,23%");
      expect(formatPercentageAmount(0, "pt-BR")).toBe("0,00%");
      expect(formatPercentageAmount(0.1, "pt-BR")).toBe("+0,10%");

      // Verify getLocaleDecimalSeparator for context
      expect(getLocaleDecimalSeparator("pt-BR")).toBe(",");
    });
  });

  describe("formatNumberForLocale", () => {
    it("should format constants with US locale (dot decimal separator)", () => {
      expect(formatNumberForLocale("0.00001", "en-US")).toBe("0.00001");
      expect(formatNumberForLocale("0.5", "en-US")).toBe("0.5");
      expect(formatNumberForLocale("100", "en-US")).toBe("100");
    });

    it("should format constants with pt-BR locale (comma decimal separator)", () => {
      expect(formatNumberForLocale("0.00001", "pt-BR")).toBe("0,00001");
      expect(formatNumberForLocale("0.5", "pt-BR")).toBe("0,5");
      expect(formatNumberForLocale("100", "pt-BR")).toBe("100");
    });

    it("should handle invalid input gracefully", () => {
      expect(formatNumberForLocale("not-a-number", "en-US")).toBe(
        "not-a-number",
      );
      expect(formatNumberForLocale("", "en-US")).toBe("");
    });

    it("should use device locale when none specified", () => {
      // Since we mock en-US as default, this should use dot
      expect(formatNumberForLocale("0.00001")).toBe("0.00001");
    });
  });

  describe("getLocaleDecimalSeparator", () => {
    it("should return dot for US locale", () => {
      expect(getLocaleDecimalSeparator("en-US")).toBe(".");
    });

    it("should return comma for pt-BR locale", () => {
      expect(getLocaleDecimalSeparator("pt-BR")).toBe(",");
    });

    it("should return comma for de-DE locale", () => {
      expect(getLocaleDecimalSeparator("de-DE")).toBe(",");
    });
  });

  describe("parseLocaleNumber", () => {
    it("should parse US format (dot decimal)", () => {
      expect(parseLocaleNumber("1,234.56", "en-US")).toBe(1234.56);
      expect(parseLocaleNumber("0.00001", "en-US")).toBe(0.00001);
    });

    it("should parse pt-BR format (comma decimal)", () => {
      expect(parseLocaleNumber("1.234,56", "pt-BR")).toBe(1234.56);
      expect(parseLocaleNumber("0,00001", "pt-BR")).toBe(0.00001);
    });

    it("should handle empty input", () => {
      expect(parseLocaleNumber("", "en-US")).toBe(0);
      expect(parseLocaleNumber("", "pt-BR")).toBe(0);
    });

    it("should handle malformed input gracefully", () => {
      expect(parseLocaleNumber("1.234.567,89,extra", "pt-BR")).toBe(1234567.89);
    });

    it("should handle BigNumber input", () => {
      const bigNum = new BigNumber("123.45");
      const result = parseLocaleNumber(bigNum);
      expect(result).toBe(123.45);
    });

    it("should handle BigNumber with high precision", () => {
      const bigNum = new BigNumber("123.456789012345");
      const result = parseLocaleNumber(bigNum);
      expect(result).toBe(123.456789012345);
    });
  });

  describe("formatBigNumberForLocale", () => {
    it("should format BigNumber with default options", () => {
      const bigNum = new BigNumber("1234.56789");
      const resultUS = formatBigNumberForLocale(bigNum, { locale: "en-US" });
      const resultPT = formatBigNumberForLocale(bigNum, { locale: "pt-BR" });
      expect(resultUS).toBe("1234.56789");
      expect(resultPT).toBe("1234,56789");
    });

    it("should format BigNumber with decimal places", () => {
      const bigNum = new BigNumber("1234.56789");
      const result = formatBigNumberForLocale(bigNum, {
        locale: "pt-BR",
        decimalPlaces: 2,
      });

      expect(result).toBe("1234,57"); // Should round to 2 decimal places
    });

    it("should preserve high precision", () => {
      const bigNum = new BigNumber("0.000000000123456789");
      const result = formatBigNumberForLocale(bigNum, { locale: "en-US" });
      expect(result).toBe("0.000000000123456789");
    });
  });

  describe("parseLocaleNumberToBigNumber", () => {
    it("should parse US format to BigNumber", () => {
      const result = parseLocaleNumberToBigNumber("1234.56", "en-US");
      expect(result.toString()).toBe("1234.56");
      expect(result instanceof BigNumber).toBe(true);
    });

    it("should parse pt-BR format to BigNumber", () => {
      const result = parseLocaleNumberToBigNumber("1234,56", "pt-BR");
      expect(result.toString()).toBe("1234.56");
      expect(result instanceof BigNumber).toBe(true);
    });

    it("should handle BigNumber input", () => {
      const input = new BigNumber("1234.56");
      const result = parseLocaleNumberToBigNumber(input);
      expect(result).toBe(input); // Should return the same instance
    });

    it("should handle empty input", () => {
      const result = parseLocaleNumberToBigNumber("");
      expect(result.toString()).toBe("0");
    });

    it("should preserve high precision", () => {
      const result = parseLocaleNumberToBigNumber(
        "0.000000000123456789",
        "en-US",
      );
      expect(result.toString()).toBe("1.23456789e-10"); // BigNumber converts very small numbers to scientific notation
      // Verify the actual numeric value is correct
      expect(result.toNumber()).toBe(0.000000000123456789);
    });
  });

  describe("Cross-locale formatting", () => {
    it("should format the same value differently across locales", () => {
      const amount = 1234.56;

      expect(formatTokenAmount(amount, "XLM", "en-US")).toBe("1,234.56 XLM");
      expect(formatTokenAmount(amount, "XLM", "de-DE")).toBe("1.234,56 XLM");
      expect(formatTokenAmount(amount, "XLM", "pt-BR")).toBe("1.234,56 XLM");
    });

    it("should handle transaction fee formatting consistently", () => {
      const feeValue = 0.00001;

      expect(formatTokenAmount(feeValue, "XLM", "en-US")).toBe("0.00001 XLM");
      expect(formatTokenAmount(feeValue, "XLM", "de-DE")).toBe("0,00001 XLM");
      expect(formatTokenAmount(feeValue, "XLM", "pt-BR")).toBe("0,00001 XLM");
    });

    it("should parse input correctly regardless of locale", () => {
      expect(parseLocaleNumber("0.00001", "en-US")).toBe(0.00001);
      expect(parseLocaleNumber("0,00001", "de-DE")).toBe(0.00001);
      expect(parseLocaleNumber("0,00001", "pt-BR")).toBe(0.00001);
    });
  });
});
