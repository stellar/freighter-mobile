import { act, renderHook } from "@testing-library/react-hooks";
import { BigNumber } from "bignumber.js";
import { DEFAULT_DECIMALS, FIAT_DECIMALS } from "config/constants";
import { TokenTypeWithCustomToken, PricedBalance } from "config/types";
import { useTokenFiatConverter } from "hooks/useTokenFiatConverter";

// Helper to create mock balance data
const createMockPricedBalance = (
  total: number | string,
  price: number | string,
): PricedBalance => ({
  total: new BigNumber(total),
  currentPrice: new BigNumber(price),
  percentagePriceChange24h: new BigNumber(0),
  tokenCode: "TEST",
  fiatCode: "USD",
  fiatTotal: new BigNumber(total).multipliedBy(new BigNumber(price)),
  displayName: "Test Token",
  token: {
    type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
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
  it("should initialize with zero amounts", () => {
    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: undefined }),
    );

    expect(result.current.tokenAmount).toBe("0");
    expect(result.current.fiatAmount).toBe("0.00");
    expect(result.current.showFiatAmount).toBe(false);
  });

  it("should correctly convert token amount to fiat amount", () => {
    const mockBalance = createMockPricedBalance(100, 2.5);
    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: mockBalance }),
    );

    act(() => {
      result.current.setTokenAmount("10");
    });

    expect(result.current.fiatAmount).toBe(
      new BigNumber(25).toFixed(FIAT_DECIMALS),
    );

    expect(result.current.tokenAmount).toBe("10");
  });

  it("should correctly convert fiat amount to token amount when showFiatAmount is true", () => {
    const mockBalance = createMockPricedBalance(100, 2.5);
    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: mockBalance }),
    );

    act(() => {
      result.current.setShowFiatAmount(true);
    });

    act(() => {
      result.current.setFiatAmount("50");
    });

    expect(result.current.tokenAmount).toBe(
      new BigNumber(20).toFixed(DEFAULT_DECIMALS),
    );

    expect(result.current.fiatAmount).toBe("50");
  });

  it("should handle zero token price correctly during conversions", () => {
    const mockBalance = createMockPricedBalance(100, 0);
    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: mockBalance }),
    );

    act(() => {
      result.current.setTokenAmount("10");
    });
    expect(result.current.fiatAmount).toBe(
      new BigNumber(0).toFixed(FIAT_DECIMALS),
    );

    act(() => {
      result.current.setShowFiatAmount(true);
    });
    act(() => {
      result.current.setFiatAmount("50");
    });
    expect(result.current.tokenAmount).toBe(
      new BigNumber(0).toFixed(DEFAULT_DECIMALS),
    );
  });

  it("should toggle display mode without immediately changing the primary value set", () => {
    const mockBalance = createMockPricedBalance(100, 2);
    const { result } = renderHook(() =>
      useTokenFiatConverter({ selectedBalance: mockBalance }),
    );

    act(() => {
      result.current.setTokenAmount("20");
    });
    expect(result.current.tokenAmount).toBe("20");
    expect(result.current.fiatAmount).toBe("40.00");

    act(() => {
      result.current.setShowFiatAmount(true);
    });
    expect(result.current.showFiatAmount).toBe(true);
    expect(result.current.fiatAmount).toBe("40.00");
    expect(result.current.tokenAmount).toBe(
      new BigNumber(20).toFixed(DEFAULT_DECIMALS),
    );

    act(() => {
      result.current.setFiatAmount("100");
    });
    expect(result.current.fiatAmount).toBe("100");
    expect(result.current.tokenAmount).toBe("50.0000000");

    act(() => {
      result.current.setShowFiatAmount(false);
    });
    expect(result.current.showFiatAmount).toBe(false);
    expect(result.current.tokenAmount).toBe("50.0000000");
    expect(result.current.fiatAmount).toBe(
      new BigNumber(100).toFixed(FIAT_DECIMALS),
    );
  });
});

describe("useTokenFiatConverter - Custom Token with 4 Decimals", () => {
  // Helper to create mock SorobanBalance with 4 decimals
  const createMockSorobanBalance = (
    total: number | string,
    price: number | string,
  ): PricedBalance => ({
    total: new BigNumber(total),
    currentPrice: new BigNumber(price),
    percentagePriceChange24h: new BigNumber(0),
    tokenCode: "CUSTOM4",
    fiatCode: "USD",
    fiatTotal: new BigNumber(total).multipliedBy(new BigNumber(price)),
    displayName: "Custom Token 4 Decimals",
    token: {
      type: TokenTypeWithCustomToken.CUSTOM_TOKEN,
      code: "CUSTOM4",
      issuer: {
        key: "CUSTOM4_ISSUER",
      },
    },
    available: new BigNumber(total),
    limit: new BigNumber(1000),
    buyingLiabilities: "0",
    sellingLiabilities: "0",
    contractId: "CUSTOM4_CONTRACT_ID",
    name: "Custom Token",
    symbol: "CUSTOM4",
    decimals: 4,
  });

  it("should limit input to 4 decimal places for custom token", () => {
    const mockBalance = createMockSorobanBalance(10000, 1.5); // 10000 base units = 1.0000 tokens
    const { result } = renderHook(() =>
      useTokenFiatConverter({
        selectedBalance: mockBalance,
        maxDecimals: 4,
      }),
    );

    // Try to input more than 4 decimals
    act(() => {
      result.current.handleDisplayAmountChange("1");
    });
    act(() => {
      result.current.handleDisplayAmountChange(".");
    });
    act(() => {
      result.current.handleDisplayAmountChange("2");
    });
    act(() => {
      result.current.handleDisplayAmountChange("3");
    });
    act(() => {
      result.current.handleDisplayAmountChange("4");
    });
    act(() => {
      result.current.handleDisplayAmountChange("5");
    });
    act(() => {
      result.current.handleDisplayAmountChange("6");
    }); // This should be ignored

    // Should only have 4 decimal places
    expect(result.current.tokenAmountDisplay).toMatch(/1\.2345?$/);
    expect(
      result.current.tokenAmountDisplay.split(".")[1]?.length,
    ).toBeLessThanOrEqual(4);
  });

  it("should format token amount with 4 decimal places", () => {
    const mockBalance = createMockSorobanBalance(10000, 1.5);
    const { result } = renderHook(() =>
      useTokenFiatConverter({
        selectedBalance: mockBalance,
        maxDecimals: 4,
      }),
    );

    act(() => {
      result.current.setTokenAmount("1.2345");
    });

    expect(result.current.tokenAmount).toBe("1.2345");
    expect(result.current.tokenAmountDisplay).toMatch(/1\.2345/);
  });

  it("should convert fiat to token amount with 4 decimal precision", () => {
    const mockBalance = createMockSorobanBalance(10000, 2.0);
    const { result } = renderHook(() =>
      useTokenFiatConverter({
        selectedBalance: mockBalance,
        maxDecimals: 4,
      }),
    );

    act(() => {
      result.current.setShowFiatAmount(true);
    });

    act(() => {
      result.current.setFiatAmount("10.50");
    });

    // 10.50 / 2.0 = 5.25, should be formatted with 4 decimals max
    expect(result.current.tokenAmount).toBe("5.2500");
  });

  it("should handle percentage calculations with 4 decimals correctly", () => {
    const mockBalance = createMockSorobanBalance(100000, 1.0); // 100000 base units = 10.0000 tokens
    const { result } = renderHook(() =>
      useTokenFiatConverter({
        selectedBalance: mockBalance,
        maxDecimals: 4,
      }),
    );

    // Set 50% of 10.0000 tokens = 5.0000
    act(() => {
      result.current.setTokenAmount("5.0000");
    });

    expect(result.current.tokenAmount).toBe("5.0000");
    // Display may show "5" or "5.0000" depending on formatting
    expect(result.current.tokenAmountDisplay).toMatch(/^5(\.0+)?$/);
  });

  it("should prevent entering more than 4 decimal places", () => {
    const mockBalance = createMockSorobanBalance(10000, 1.0);
    const { result } = renderHook(() =>
      useTokenFiatConverter({
        selectedBalance: mockBalance,
        maxDecimals: 4,
      }),
    );

    // Input: 1.23456 (trying to enter 5 decimals)
    act(() => {
      result.current.handleDisplayAmountChange("1");
    });
    act(() => {
      result.current.handleDisplayAmountChange(".");
    });
    "23456".split("").forEach((digit) => {
      act(() => {
        result.current.handleDisplayAmountChange(digit);
      });
    });

    // Should only have 4 decimal places (1.2345)
    const decimalPart = result.current.tokenAmountDisplay.split(".")[1];
    expect(decimalPart?.length).toBeLessThanOrEqual(4);
  });

  it("should correctly handle max amount with 4 decimals", () => {
    const mockBalance = createMockSorobanBalance(123456, 1.0); // 123456 base units = 12.3456 tokens
    const { result } = renderHook(() =>
      useTokenFiatConverter({
        selectedBalance: mockBalance,
        maxDecimals: 4,
      }),
    );

    act(() => {
      result.current.setTokenAmount("12.3456");
    });

    expect(result.current.tokenAmount).toBe("12.3456");
    expect(result.current.fiatAmount).toBe("12.35"); // 12.3456 * 1.0 = 12.35 (rounded to 2 decimals)
  });
});
