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
