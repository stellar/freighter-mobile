import { renderHook } from "@testing-library/react-hooks";
import { MAX_MEMO_BYTES } from "config/constants";
import { useValidateMemo } from "hooks/useValidateMemo";

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string, params?: { max?: string }) => {
    const translations: Record<string, string> = {
      "transactionSettings.errors.memo.tooLong": `Memo too long (max ${params?.max} bytes)`,
      "transactionSettings.errors.memo.invalid": "Invalid memo",
    };
    return translations[key] || key;
  },
}));

const createStringOfBytes = (bytes: number): string => "a".repeat(bytes);

describe("useValidateMemo", () => {
  it("should return null error for empty memo", () => {
    const { result } = renderHook(() => useValidateMemo(""));
    expect(result.current.error).toBeNull();
  });

  it("should return null error for valid memo within byte limit", () => {
    const validMemo = createStringOfBytes(MAX_MEMO_BYTES - 1);
    const { result } = renderHook(() => useValidateMemo(validMemo));
    expect(result.current.error).toBeNull();
  });

  it("should return null error for memo exactly at byte limit", () => {
    const validMemo = createStringOfBytes(MAX_MEMO_BYTES);
    const { result } = renderHook(() => useValidateMemo(validMemo));
    expect(result.current.error).toBeNull();
  });

  it("should return tooLong error for memo exceeding byte limit", () => {
    const invalidMemo = createStringOfBytes(MAX_MEMO_BYTES + 1);
    const { result } = renderHook(() => useValidateMemo(invalidMemo));
    expect(result.current.error).toBe(
      `Memo too long (max ${MAX_MEMO_BYTES} bytes)`,
    );
  });

  it("should update error state when memo changes", () => {
    const { result, rerender } = renderHook(
      ({ memo }) => useValidateMemo(memo),
      { initialProps: { memo: "" } },
    );

    expect(result.current.error).toBeNull();

    const longMemo = createStringOfBytes(MAX_MEMO_BYTES + 1);
    rerender({ memo: longMemo });
    expect(result.current.error).toBe(
      `Memo too long (max ${MAX_MEMO_BYTES} bytes)`,
    );

    const validMemo = "valid memo";
    rerender({ memo: validMemo });
    expect(result.current.error).toBeNull();
  });
});
