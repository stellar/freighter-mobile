import { renderHook, act } from "@testing-library/react-hooks";
import { useSwapTransactionSettings } from "components/screens/SwapScreen/hooks/useSwapTransactionSettings";

const mockSaveSwapFee = jest.fn();
let mockSwapFee = "0.00001";
let mockFeeManuallyChanged = false;

jest.mock("hooks/useRightHeader", () => ({
  useRightHeaderButton: jest.fn(),
}));

jest.mock("ducks/swapSettings", () => ({
  useSwapSettingsStore: () => ({
    swapFee: mockSwapFee,
    feeManuallyChanged: mockFeeManuallyChanged,
    saveSwapFee: mockSaveSwapFee,
  }),
}));

describe("useSwapTransactionSettings", () => {
  beforeEach(() => {
    mockSaveSwapFee.mockClear();
    mockSwapFee = "0.00001";
    mockFeeManuallyChanged = false;
  });

  it("settles the op-count-scaled recommended total before presenting", () => {
    const { result } = renderHook(() =>
      useSwapTransactionSettings({
        recommendedFee: "0.001",
        operationCount: 2,
      }),
    );

    act(() => result.current.openSettings());

    // 0.001 per-op × 2 ops = 0.002 total, written before the sheet renders.
    expect(mockSaveSwapFee).toHaveBeenCalledWith("0.002");
  });

  it("does not rescale when the stored fee already matches the scaled total", () => {
    mockSwapFee = "0.002";
    const { result } = renderHook(() =>
      useSwapTransactionSettings({
        recommendedFee: "0.001",
        operationCount: 2,
      }),
    );

    act(() => result.current.openSettings());

    expect(mockSaveSwapFee).not.toHaveBeenCalled();
  });

  it("treats a differently-formatted but equal stored fee as a match", () => {
    // Trailing-zero form of 0.002 — a string compare would rewrite it, a
    // numeric (BigNumber.eq) compare correctly skips.
    mockSwapFee = "0.0020";
    const { result } = renderHook(() =>
      useSwapTransactionSettings({
        recommendedFee: "0.001",
        operationCount: 2,
      }),
    );

    act(() => result.current.openSettings());

    expect(mockSaveSwapFee).not.toHaveBeenCalled();
  });

  it("leaves a one-op swap fee untouched", () => {
    mockSwapFee = "0.001";
    const { result } = renderHook(() =>
      useSwapTransactionSettings({
        recommendedFee: "0.001",
        operationCount: 1,
      }),
    );

    act(() => result.current.openSettings());

    expect(mockSaveSwapFee).not.toHaveBeenCalled();
  });

  it("preserves a manually-set fee", () => {
    mockFeeManuallyChanged = true;
    const { result } = renderHook(() =>
      useSwapTransactionSettings({
        recommendedFee: "0.001",
        operationCount: 2,
      }),
    );

    act(() => result.current.openSettings());

    expect(mockSaveSwapFee).not.toHaveBeenCalled();
  });

  it("does nothing when the recommended fee has not loaded yet", () => {
    const { result } = renderHook(() =>
      useSwapTransactionSettings({ recommendedFee: "", operationCount: 2 }),
    );

    act(() => result.current.openSettings());

    expect(mockSaveSwapFee).not.toHaveBeenCalled();
  });
});
