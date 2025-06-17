import { renderHook } from "@testing-library/react-native";
import { useSwapButtonState } from "components/screens/SwapScreen/hooks/useSwapButtonState";
import { PricedBalance } from "config/types";
import { SwapPathResult } from "ducks/swap";

// Mock the useAppTranslation hook
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "swapScreen.selectAsset": "Select an asset",
        "common.loading": "Loading...",
        "common.review": "Review",
      };
      return translations[key] || key;
    },
  }),
}));

const mockSwapToTokenBalance = {} as PricedBalance;

const mockPathResult = {
  path: [
    "native",
    "USDC:GDQOE23CFSUMSVQK4Y5JHPPYK73VYCNHZHA7ENKCV37P6SUEO6XQBKPP",
  ],
  destinationAmount: "95.0000000",
  destinationAmountMin: "94.0000000",
  conversionRate: "0.95",
} as SwapPathResult;

describe("useSwapButtonState", () => {
  const defaultParams = {
    swapToTokenBalance: undefined,
    isLoadingPath: false,
    isBuilding: false,
    amountError: null,
    pathError: null,
    swapAmount: "10",
    pathResult: null,
  };

  it("should return 'Select an asset' when no token is selected", () => {
    const { result } = renderHook(() =>
      useSwapButtonState({
        ...defaultParams,
        swapToTokenBalance: undefined,
      }),
    );

    expect(result.current.buttonText).toBe("Select an asset");
    expect(result.current.isDisabled).toBe(false);
    expect(result.current.action).toBe("selectAsset");
  });

  it("should return 'Loading...' when path is being loaded", () => {
    const { result } = renderHook(() =>
      useSwapButtonState({
        ...defaultParams,
        swapToTokenBalance: mockSwapToTokenBalance,
        isLoadingPath: true,
      }),
    );

    expect(result.current.isDisabled).toBe(true);
    expect(result.current.action).toBe("review");
  });

  it("should return 'Review' when token is selected and conditions are met", () => {
    const { result } = renderHook(() =>
      useSwapButtonState({
        ...defaultParams,
        swapToTokenBalance: mockSwapToTokenBalance,
        swapAmount: "10",
        pathResult: mockPathResult,
      }),
    );

    expect(result.current.buttonText).toBe("Review");
    expect(result.current.isDisabled).toBe(false);
    expect(result.current.action).toBe("review");
  });

  it("should be disabled when there is an amount error", () => {
    const { result } = renderHook(() =>
      useSwapButtonState({
        ...defaultParams,
        swapToTokenBalance: mockSwapToTokenBalance,
        amountError: "Insufficient balance",
        swapAmount: "10",
        pathResult: mockPathResult,
      }),
    );

    expect(result.current.buttonText).toBe("Review");
    expect(result.current.isDisabled).toBe(true);
    expect(result.current.action).toBe("review");
  });

  it("should be disabled when there is a path error", () => {
    const { result } = renderHook(() =>
      useSwapButtonState({
        ...defaultParams,
        swapToTokenBalance: mockSwapToTokenBalance,
        pathError: "No swap path found",
        swapAmount: "10",
      }),
    );

    expect(result.current.buttonText).toBe("Review");
    expect(result.current.isDisabled).toBe(true);
    expect(result.current.action).toBe("review");
  });

  it("should be disabled when swap amount is zero", () => {
    const { result } = renderHook(() =>
      useSwapButtonState({
        ...defaultParams,
        swapToTokenBalance: mockSwapToTokenBalance,
        swapAmount: "0",
        pathResult: mockPathResult,
      }),
    );

    expect(result.current.buttonText).toBe("Review");
    expect(result.current.isDisabled).toBe(true);
    expect(result.current.action).toBe("review");
  });

  it("should be disabled when transaction is building", () => {
    const { result } = renderHook(() =>
      useSwapButtonState({
        ...defaultParams,
        swapToTokenBalance: mockSwapToTokenBalance,
        isBuilding: true,
        swapAmount: "10",
        pathResult: mockPathResult,
      }),
    );

    expect(result.current.buttonText).toBe("Review");
    expect(result.current.isDisabled).toBe(true);
    expect(result.current.action).toBe("review");
  });

  it("should be disabled when no path result is available", () => {
    const { result } = renderHook(() =>
      useSwapButtonState({
        ...defaultParams,
        swapToTokenBalance: mockSwapToTokenBalance,
        swapAmount: "10",
        pathResult: null,
      }),
    );

    expect(result.current.buttonText).toBe("Review");
    expect(result.current.isDisabled).toBe(true);
    expect(result.current.action).toBe("review");
  });
});
