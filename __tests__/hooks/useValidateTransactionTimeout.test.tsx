import { renderHook } from "@testing-library/react-hooks";
import { MIN_TRANSACTION_TIMEOUT } from "config/constants";
import { useValidateTransactionTimeout } from "hooks/useValidateTransactionTimeout";

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "transactionTimeoutScreen.errors.required": "Timeout is required",
      "transactionTimeoutScreen.errors.invalid": "Invalid timeout value",
      "transactionTimeoutScreen.errors.greaterThanZero":
        "Timeout must be greater than zero",
    };
    return translations[key] || key;
  },
}));

describe("useValidateTransactionTimeout", () => {
  it("should return required error when timeout is empty", () => {
    const { result } = renderHook(() => useValidateTransactionTimeout(""));
    expect(result.current.error).toBe("Timeout is required");
  });

  it("should return invalid error for non-numeric input", () => {
    const { result } = renderHook(() => useValidateTransactionTimeout("abc"));
    expect(result.current.error).toBe("Invalid timeout value");
  });

  it("should return greaterThanZero error for timeout less than minimum", () => {
    const invalidTimeout = String(MIN_TRANSACTION_TIMEOUT - 1);
    const { result } = renderHook(() =>
      useValidateTransactionTimeout(invalidTimeout),
    );
    expect(result.current.error).toBe("Timeout must be greater than zero");
  });

  it("should return null error for timeout equal to minimum", () => {
    const validTimeout = String(MIN_TRANSACTION_TIMEOUT);
    const { result } = renderHook(() =>
      useValidateTransactionTimeout(validTimeout),
    );
    expect(result.current.error).toBeNull();
  });

  it("should return null error for timeout greater than minimum", () => {
    const validTimeout = String(MIN_TRANSACTION_TIMEOUT + 100);
    const { result } = renderHook(() =>
      useValidateTransactionTimeout(validTimeout),
    );
    expect(result.current.error).toBeNull();
  });

  it("should update error state when timeout changes", () => {
    const { result, rerender } = renderHook(
      ({ timeout }) => useValidateTransactionTimeout(timeout),
      { initialProps: { timeout: "" } },
    );

    expect(result.current.error).toBe("Timeout is required");

    rerender({ timeout: "abc" });
    expect(result.current.error).toBe("Invalid timeout value");

    rerender({ timeout: String(MIN_TRANSACTION_TIMEOUT - 1) });
    expect(result.current.error).toBe("Timeout must be greater than zero");

    rerender({ timeout: String(MIN_TRANSACTION_TIMEOUT) });
    expect(result.current.error).toBeNull();
  });
});
