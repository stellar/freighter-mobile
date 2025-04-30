import { act, renderHook } from "@testing-library/react-hooks";
import { BigNumber } from "bignumber.js";
import { AssetTypeWithCustomToken, PricedBalance } from "config/types";
import { formatNumericInput } from "helpers/numericInput";
import { useTokenFiatConverter } from "hooks/useTokenFiatConverter";

jest.mock("helpers/numericInput", () => ({
  formatNumericInput: jest.fn((prev, key) => {
    // Simple mock implementation to simulate formatting behavior
    if (key === "") {
      if (prev === "0.00") return "0.00";
      return "0.00";
    }

    if (key === "5") return "5.00";
    if (key === "7") return "7.00";
    return `${prev.split(".")[0]}${key}.00`;
  }),
}));

const createMockPricedBalance = (
  total: number,
  price: number,
): PricedBalance => ({
  total: new BigNumber(total),

  currentPrice: new BigNumber(price),
  percentagePriceChange24h: new BigNumber(0),

  tokenCode: "TEST",
  fiatCode: "USD",
  fiatTotal: new BigNumber(total * price),
  displayName: "Test Token",

  token: {
    type: AssetTypeWithCustomToken.CREDIT_ALPHANUM4,
    code: "TEST",
    issuer: {
      key: "TEST_ISSUER",
    },
  },
  available: new BigNumber(total),
  limit: new BigNumber(1000),
  buyingLiabilities: "0",
  sellingLiabilities: "0",
});

describe("useTokenFiatConverter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    (formatNumericInput as jest.Mock).mockClear();
  });

  it("should initialize with default values", () => {
    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: undefined }),
    );

    expect(result.current.tokenValue).toBe("0.00");
    expect(result.current.fiatValue).toBe("0.00");
    expect(result.current.showDollarValue).toBe(false);
  });

  it("should handle selected balance with price", () => {
    const mockBalance = createMockPricedBalance(100, 2);

    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: mockBalance }),
    );

    expect(result.current.tokenValue).toBe("0.00");
    expect(result.current.fiatValue).toBe("0.00");

    act(() => {
      result.current.setTokenValue("50.00");
    });

    expect(result.current.fiatValue).toBe("100.00");
  });

  it("should convert between token and fiat values bidirectionally", () => {
    const mockBalance = createMockPricedBalance(100, 2);

    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: mockBalance }),
    );

    act(() => {
      result.current.setTokenValue("25.00");
    });
    expect(result.current.fiatValue).toBe("50.00");

    act(() => {
      result.current.setShowDollarValue(true);
    });
    act(() => {
      result.current.setFiatValue("100.00");
    });

    expect(result.current.tokenValue).toBe("50.00");
  });

  it("should handle zero price correctly", () => {
    const mockBalance = createMockPricedBalance(100, 0);

    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: mockBalance }),
    );

    act(() => {
      result.current.setTokenValue("50.00");
    });

    expect(result.current.fiatValue).toBe("0.00");

    act(() => {
      result.current.setShowDollarValue(true);
    });

    act(() => {
      result.current.setFiatValue("100.00");
    });

    expect(result.current.tokenValue).toBe("0.00");
  });

  it("should handle numeric input correctly", () => {
    const mockBalance = createMockPricedBalance(100, 2);

    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: mockBalance }),
    );

    (formatNumericInput as jest.Mock).mockImplementationOnce(() => "5.00");
    act(() => {
      result.current.handleValueChange("5");
    });

    expect(formatNumericInput).toHaveBeenCalled();

    const tokenInputCall = (formatNumericInput as jest.Mock).mock.calls.pop();
    expect(tokenInputCall[1]).toBe("5");

    act(() => {
      result.current.setShowDollarValue(true);
    });

    (formatNumericInput as jest.Mock).mockImplementationOnce(() => "7.00");
    act(() => {
      result.current.handleValueChange("7");
    });

    const fiatInputCall = (formatNumericInput as jest.Mock).mock.calls.pop();
    expect(fiatInputCall[1]).toBe("7"); // Second parameter should be "7"
  });

  it("should handle deletion correctly", () => {
    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: undefined }),
    );

    (formatNumericInput as jest.Mock).mockImplementationOnce(() => "0.00");
    act(() => {
      result.current.handleValueChange("");
    });

    const tokenDeleteCall = (formatNumericInput as jest.Mock).mock.calls.pop();
    expect(tokenDeleteCall[1]).toBe("");

    act(() => {
      result.current.setShowDollarValue(true);
    });

    (formatNumericInput as jest.Mock).mockImplementationOnce(() => "0.00");
    act(() => {
      result.current.handleValueChange("");
    });

    const fiatDeleteCall = (formatNumericInput as jest.Mock).mock.calls.pop();
    expect(fiatDeleteCall[1]).toBe("");
  });

  it("should calculate percentages correctly", () => {
    const mockBalance = createMockPricedBalance(100, 2);

    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: mockBalance }),
    );

    act(() => {
      result.current.handlePercentagePress(25);
    });

    expect(result.current.tokenValue).toBe("25.00");
    expect(result.current.fiatValue).toBe("50.00");

    act(() => {
      result.current.handlePercentagePress(50);
    });

    expect(result.current.tokenValue).toBe("50.00");
    expect(result.current.fiatValue).toBe("100.00");

    act(() => {
      result.current.handlePercentagePress(75);
    });

    expect(result.current.tokenValue).toBe("75.00");
    expect(result.current.fiatValue).toBe("150.00");

    act(() => {
      result.current.handlePercentagePress(100);
    });

    expect(result.current.tokenValue).toBe("100.00");
    expect(result.current.fiatValue).toBe("200.00");
  });

  it("should calculate percentages correctly in fiat display mode", () => {
    const mockBalance = createMockPricedBalance(100, 2);

    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: mockBalance }),
    );

    act(() => {
      result.current.setShowDollarValue(true);
    });

    act(() => {
      result.current.handlePercentagePress(25);
    });

    expect(result.current.tokenValue).toBe("25.00");
    expect(result.current.fiatValue).toBe("50.00");

    act(() => {
      result.current.handlePercentagePress(100);
    });

    expect(result.current.tokenValue).toBe("100.00");
    expect(result.current.fiatValue).toBe("200.00");
  });

  it("should not update values when percentage is clicked without selected balance", () => {
    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: undefined }),
    );

    expect(result.current.tokenValue).toBe("0.00");
    expect(result.current.fiatValue).toBe("0.00");

    act(() => {
      result.current.handlePercentagePress(50);
    });

    expect(result.current.tokenValue).toBe("0.00");
    expect(result.current.fiatValue).toBe("0.00");
  });

  it("should toggle between token and fiat display modes", () => {
    const mockBalance = createMockPricedBalance(100, 2);

    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: mockBalance }),
    );

    expect(result.current.showDollarValue).toBe(false);

    act(() => {
      result.current.setTokenValue("50.00");
    });

    act(() => {
      result.current.setShowDollarValue(true);
    });

    expect(result.current.showDollarValue).toBe(true);

    act(() => {
      result.current.setFiatValue("200.00");
    });

    act(() => {
      result.current.setShowDollarValue(false);
    });

    expect(result.current.showDollarValue).toBe(false);
  });

  it("should handle very large numbers correctly", () => {
    const mockBalance = createMockPricedBalance(10000000, 2);

    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: mockBalance }),
    );

    act(() => {
      result.current.setTokenValue("1000000.00");
    });

    expect(result.current.fiatValue).toBe("2000000.00");

    act(() => {
      result.current.setShowDollarValue(true);
    });

    act(() => {
      result.current.setFiatValue("5000000.00");
    });

    expect(result.current.tokenValue).toBe("2500000.00");
  });
});
