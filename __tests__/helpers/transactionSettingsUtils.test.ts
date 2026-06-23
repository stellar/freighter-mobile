// Mock react-native-localize
import { enforceSettingInputDecimalSeparator } from "helpers/transactionSettingsUtils";
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
});
