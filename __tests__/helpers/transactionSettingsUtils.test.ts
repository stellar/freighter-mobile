// Mock react-native-localize
import { FeePresets, FeePriority } from "config/types";
import {
  enforceSettingInputDecimalSeparator,
  getFeePriority,
} from "helpers/transactionSettingsUtils";
import { getNumberFormatSettings } from "react-native-localize";

jest.mock("react-native-localize", () => ({
  getNumberFormatSettings: jest.fn(),
}));

const mockGetNumberFormatSettings =
  getNumberFormatSettings as jest.MockedFunction<
    typeof getNumberFormatSettings
  >;

describe("transactionSettingsUtils", () => {
  describe("enforceSettingInputDecimalSeparator with US locale (dot decimal)", () => {
    beforeEach(() => {
      mockGetNumberFormatSettings.mockReturnValue({
        decimalSeparator: ".",
        groupingSeparator: ",",
      });
    });

    it("should replace dot with device decimal separator", () => {
      expect(enforceSettingInputDecimalSeparator("123.45")).toBe("123.45");
      expect(enforceSettingInputDecimalSeparator("0.5")).toBe("0.5");
      expect(enforceSettingInputDecimalSeparator("999.99")).toBe("999.99");
    });

    it("should replace comma with device decimal separator", () => {
      expect(enforceSettingInputDecimalSeparator("123,45")).toBe("123.45");
      expect(enforceSettingInputDecimalSeparator("0,5")).toBe("0.5");
      expect(enforceSettingInputDecimalSeparator("999,99")).toBe("999.99");
    });

    it("should handle whole numbers", () => {
      expect(enforceSettingInputDecimalSeparator("123")).toBe("123");
      expect(enforceSettingInputDecimalSeparator("0")).toBe("0");
      expect(enforceSettingInputDecimalSeparator("999")).toBe("999");
    });

    it("should handle decimal numbers", () => {
      expect(enforceSettingInputDecimalSeparator("12.34")).toBe("12.34");
      expect(enforceSettingInputDecimalSeparator("12,34")).toBe("12.34");
      expect(enforceSettingInputDecimalSeparator("0.01")).toBe("0.01");
      expect(enforceSettingInputDecimalSeparator("0,01")).toBe("0.01");
    });

    it("should handle multiple separators by keeping only the last as decimal", () => {
      expect(enforceSettingInputDecimalSeparator("1.000.45")).toBe("1000.45");
      expect(enforceSettingInputDecimalSeparator("1,000.45")).toBe("1000.45");
      expect(enforceSettingInputDecimalSeparator("12.345.678.90")).toBe(
        "12345678.90",
      );
      expect(enforceSettingInputDecimalSeparator("1,000,000.50")).toBe(
        "1000000.50",
      );
    });

    it("should handle edge cases", () => {
      expect(enforceSettingInputDecimalSeparator("")).toBe("");
      expect(enforceSettingInputDecimalSeparator(".")).toBe(".");
      expect(enforceSettingInputDecimalSeparator(",")).toBe(".");
    });
  });

  describe("enforceSettingInputDecimalSeparator with European locale (comma decimal)", () => {
    beforeEach(() => {
      mockGetNumberFormatSettings.mockReturnValue({
        decimalSeparator: ",",
        groupingSeparator: ".",
      });
    });

    it("should replace dot with comma decimal separator", () => {
      expect(enforceSettingInputDecimalSeparator("123.45")).toBe("123,45");
      expect(enforceSettingInputDecimalSeparator("0.5")).toBe("0,5");
      expect(enforceSettingInputDecimalSeparator("999.99")).toBe("999,99");
    });

    it("should keep comma as decimal separator", () => {
      expect(enforceSettingInputDecimalSeparator("123,45")).toBe("123,45");
      expect(enforceSettingInputDecimalSeparator("0,5")).toBe("0,5");
      expect(enforceSettingInputDecimalSeparator("999,99")).toBe("999,99");
    });

    it("should handle whole numbers", () => {
      expect(enforceSettingInputDecimalSeparator("123")).toBe("123");
      expect(enforceSettingInputDecimalSeparator("0")).toBe("0");
      expect(enforceSettingInputDecimalSeparator("999")).toBe("999");
    });

    it("should handle decimal numbers", () => {
      expect(enforceSettingInputDecimalSeparator("12.34")).toBe("12,34");
      expect(enforceSettingInputDecimalSeparator("12,34")).toBe("12,34");
      expect(enforceSettingInputDecimalSeparator("0.01")).toBe("0,01");
      expect(enforceSettingInputDecimalSeparator("0,01")).toBe("0,01");
    });

    it("should handle multiple separators by keeping only the last as decimal", () => {
      expect(enforceSettingInputDecimalSeparator("1.000,45")).toBe("1000,45");
      expect(enforceSettingInputDecimalSeparator("1,000,45")).toBe("1000,45");
      expect(enforceSettingInputDecimalSeparator("12.345.678,90")).toBe(
        "12345678,90",
      );
      expect(enforceSettingInputDecimalSeparator("1.000.000,50")).toBe(
        "1000000,50",
      );
    });

    it("should handle edge cases", () => {
      expect(enforceSettingInputDecimalSeparator("")).toBe("");
      expect(enforceSettingInputDecimalSeparator(".")).toBe(",");
      expect(enforceSettingInputDecimalSeparator(",")).toBe(",");
    });
  });

  describe("getFeePriority", () => {
    const presets: FeePresets = {
      [FeePriority.LOW]: "0.0001",
      [FeePriority.MEDIUM]: "0.001",
      [FeePriority.HIGH]: "0.01",
    };

    it("returns the matching priority for an exact preset match", () => {
      expect(getFeePriority("0.0001", presets)).toBe(FeePriority.LOW);
      expect(getFeePriority("0.001", presets)).toBe(FeePriority.MEDIUM);
      expect(getFeePriority("0.01", presets)).toBe(FeePriority.HIGH);
    });

    it("matches regardless of trailing-zero formatting", () => {
      expect(getFeePriority("0.00010", presets)).toBe(FeePriority.LOW);
      expect(getFeePriority("0.0100", presets)).toBe(FeePriority.HIGH);
    });

    it("returns CUSTOM when the fee does not match any preset", () => {
      expect(getFeePriority("0.005", presets)).toBe(FeePriority.CUSTOM);
      expect(getFeePriority("1", presets)).toBe(FeePriority.CUSTOM);
    });

    it("returns CUSTOM for an empty or invalid fee", () => {
      expect(getFeePriority("", presets)).toBe(FeePriority.CUSTOM);
      expect(getFeePriority("abc", presets)).toBe(FeePriority.CUSTOM);
    });
  });
});
