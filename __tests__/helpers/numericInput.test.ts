import { formatNumericInput } from "helpers/numericInput";

// Mock the OS locale detection for consistent test behavior
jest.mock("helpers/getOsLanguage", () => ({
  __esModule: true,
  default: () => "en", // Mock default export (getOSLanguage)
  getOSLocale: () => "en-US", // Mock named export (getOSLocale)
}));

describe("formatNumericInput", () => {
  it("should handle initial input", () => {
    expect(formatNumericInput("0", "1")).toBe("1");
    expect(formatNumericInput("0", "0")).toBe("0");
  });

  it("should append digits correctly", () => {
    expect(formatNumericInput("1", "2")).toBe("12");
    expect(formatNumericInput("123", "4")).toBe("1234");
  });

  it("should handle decimal point input", () => {
    expect(formatNumericInput("0", ".")).toBe("0.");
    expect(formatNumericInput("123", ".")).toBe("123.");
    expect(formatNumericInput("123.", "4")).toBe("123.4");
    expect(formatNumericInput("123.4", ".")).toBe("123.4");
  });

  it("should handle delete key", () => {
    expect(formatNumericInput("123.45", "")).toBe("123.4");
    expect(formatNumericInput("123.4", "")).toBe("123.");
    expect(formatNumericInput("123.", "")).toBe("123");
    expect(formatNumericInput("123", "")).toBe("12");
    expect(formatNumericInput("1", "")).toBe("0");
    expect(formatNumericInput("0.", "")).toBe("0");
    expect(formatNumericInput("0", "")).toBe("0");
  });

  it("should respect maxDecimals (default 7)", () => {
    expect(formatNumericInput("1.123456", "7")).toBe("1.1234567");
    expect(formatNumericInput("1.1234567", "8")).toBe("1.1234567");
    expect(formatNumericInput("123", ".")).toBe("123.");
    expect(formatNumericInput("123.", "1")).toBe("123.1");
    expect(formatNumericInput("123.1234567", "8")).toBe("123.1234567");
  });

  it("should respect custom maxDecimals", () => {
    const maxDecimals = 2;
    expect(formatNumericInput("1.1", "2", maxDecimals)).toBe("1.12");
    expect(formatNumericInput("1.12", "3", maxDecimals)).toBe("1.12");
    expect(formatNumericInput("123", ".", maxDecimals)).toBe("123.");
    expect(formatNumericInput("123.", "1", maxDecimals)).toBe("123.1");
    expect(formatNumericInput("123.12", "3", maxDecimals)).toBe("123.12");
  });

  it("should handle max length (20)", () => {
    const longInt = "1234567890123456789";
    expect(formatNumericInput(longInt, "0")).toBe("12345678901234567890");
    expect(formatNumericInput("12345678901234567890", "1")).toBe(
      "12345678901234567890",
    ); // Max length reached

    const longDecimal = "1.1234567";
    expect(formatNumericInput(longDecimal, "8", 18)).toBe("1.12345678");
    expect(formatNumericInput("1.12345678901234567", "8", 18)).toBe(
      "1.123456789012345678",
    );
    expect(formatNumericInput("1.123456789012345678", "9", 18)).toBe(
      "1.123456789012345678",
    ); // Max length reached

    expect(formatNumericInput("1234567890123456789.0", "1")).toBe(
      "1234567890123456789.0",
    ); // Max length reached
  });

  it("should return previous value for invalid keys", () => {
    expect(formatNumericInput("123", "a")).toBe("123");
    expect(formatNumericInput("123.45", " ")).toBe("123.45");
    expect(formatNumericInput("0", "!")).toBe("0");
  });
});
