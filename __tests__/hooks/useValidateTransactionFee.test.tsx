import { renderHook } from "@testing-library/react-hooks";
import BigNumber from "bignumber.js";
import { MIN_TRANSACTION_FEE } from "config/constants";
import { useValidateTransactionFee } from "hooks/useValidateTransactionFee";

// Mock the OS locale detection for consistent test behavior
jest.mock("helpers/getOsLanguage", () => ({
  __esModule: true,
  default: () => "en", // Mock default export (getOSLanguage)
  getOSLocale: () => "en-US", // Mock named export (getOSLocale)
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string, params?: { min?: string }) => {
    const translations: Record<string, string> = {
      "transactionSettings.errors.fee.required": "Fee is required",
      "transactionSettings.errors.fee.invalid": "Invalid fee value",
      "transactionSettings.errors.fee.tooLow": `Fee must be at least ${params?.min}`,
    };
    return translations[key] || key;
  },
}));

describe("useValidateTransactionFee", () => {
  it("should return required error when fee is empty", () => {
    const { result } = renderHook(() => useValidateTransactionFee(""));
    expect(result.current.error).toBe("Fee is required");
  });

  it("should return invalid error for non-numeric input", () => {
    const { result } = renderHook(() => useValidateTransactionFee("abc"));
    expect(result.current.error).toBe("Invalid fee value");
  });

  it("should return tooLow error for fee less than minimum", () => {
    const invalidFee = new BigNumber(MIN_TRANSACTION_FEE).minus(1).toString();
    const { result } = renderHook(() => useValidateTransactionFee(invalidFee));
    expect(result.current.error).toBe(
      "Fee must be at least 0.00001", // Formatted for en-US locale
    );
  });

  it("should return null error for fee equal to minimum", () => {
    const validFee = String(MIN_TRANSACTION_FEE);
    const { result } = renderHook(() => useValidateTransactionFee(validFee));
    expect(result.current.error).toBeNull();
  });

  it("should return null error for fee greater than minimum", () => {
    const validFee = new BigNumber(MIN_TRANSACTION_FEE).plus(100).toString();
    const { result } = renderHook(() => useValidateTransactionFee(validFee));
    expect(result.current.error).toBeNull();
  });

  it("should update error state when fee changes", () => {
    const { result, rerender } = renderHook(
      ({ fee }) => useValidateTransactionFee(fee),
      { initialProps: { fee: "" } },
    );

    expect(result.current.error).toBe("Fee is required");

    rerender({ fee: "abc" });
    expect(result.current.error).toBe("Invalid fee value");

    const invalidFee = new BigNumber(MIN_TRANSACTION_FEE).minus(1).toString();
    rerender({ fee: invalidFee });
    expect(result.current.error).toBe(
      "Fee must be at least 0.00001", // Formatted for en-US locale
    );

    rerender({ fee: String(MIN_TRANSACTION_FEE) });
    expect(result.current.error).toBeNull();
  });
});
