import { formatNumericInput } from "helpers/numericInput";

describe("formatNumericInput", () => {
  it("should format numeric input correctly", () => {
    expect(formatNumericInput("0.00", "1")).toBe("0.01");
    expect(formatNumericInput("0.01", "2")).toBe("0.12");
    expect(formatNumericInput("0.12", "3")).toBe("1.23");
    expect(formatNumericInput("1.23", "4")).toBe("12.34");
    expect(formatNumericInput("12.34", "5")).toBe("123.45");
  });

  it("should handle leading zeros correctly", () => {
    expect(formatNumericInput("0.00", "0")).toBe("0.00");
    expect(formatNumericInput("0.00", "1")).toBe("0.01");
    expect(formatNumericInput("0.01", "0")).toBe("0.10");
  });

  it("should handle deletion correctly", () => {
    expect(formatNumericInput("0.00", "")).toBe("0.00");
    expect(formatNumericInput("0.01", "")).toBe("0.00");
    // Deleting from other states
    expect(formatNumericInput("0.01", "")).toBe("0.00");
    expect(formatNumericInput("0.10", "")).toBe("0.01");
    expect(formatNumericInput("1.00", "")).toBe("0.10");
    expect(formatNumericInput("10.00", "")).toBe("1.00");
    expect(formatNumericInput("123.45", "")).toBe("12.34");
  });

  it("should maintain proper decimal point placement", () => {
    expect(formatNumericInput("0.00", "1")).toBe("0.01");
    expect(formatNumericInput("0.01", "2")).toBe("0.12");
    expect(formatNumericInput("0.12", "3")).toBe("1.23");

    // After deletion
    expect(formatNumericInput("1.23", "")).toBe("0.12");
    expect(formatNumericInput("0.12", "")).toBe("0.01");
  });

  it("should handle special cases correctly", () => {
    expect(formatNumericInput("0.00", "0")).toBe("0.00");

    expect(formatNumericInput("000", "1")).toBe("0.01");

    expect(formatNumericInput("0.00", "5")).toBe("0.05");

    expect(formatNumericInput("7.89", "0")).toBe("78.90");
  });

  it("should handle large numbers correctly", () => {
    expect(formatNumericInput("9999.99", "9")).toBe("99999.99");
    expect(formatNumericInput("12345.67", "8")).toBe("123456.78");
  });

  it("should always maintain two decimal places", () => {
    expect(formatNumericInput("0.00", "1")).toBe("0.01");
    expect(formatNumericInput("123.45", "6")).toBe("1234.56");
    expect(formatNumericInput("1234.56", "")).toBe("123.45");
  });
});
