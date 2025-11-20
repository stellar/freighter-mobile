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
    expect(result.current.fiatAmount).toBe("0");
    expect(result.current.fiatAmountDisplay).toBe("0");
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

  describe("Decimal separator handling", () => {
    it("should handle dot as decimal separator in token amount", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      act(() => {
        result.current.handleDisplayAmountChange("1");
      });
      act(() => {
        result.current.handleDisplayAmountChange("0");
      });
      act(() => {
        result.current.handleDisplayAmountChange(".");
      });
      act(() => {
        result.current.handleDisplayAmountChange("5");
      });

      expect(result.current.tokenAmountDisplay).toBe("10.5");
      expect(result.current.tokenAmount).toBe("10.5");
    });
  });

  describe("Mid-typing scenarios", () => {
    it("should preserve typing state when typing '100.' in token amount", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      act(() => {
        result.current.handleDisplayAmountChange("1");
      });
      act(() => {
        result.current.handleDisplayAmountChange("0");
      });
      act(() => {
        result.current.handleDisplayAmountChange("0");
      });
      act(() => {
        result.current.handleDisplayAmountChange(".");
      });

      expect(result.current.tokenAmountDisplay).toBe("100.");
      expect(result.current.tokenAmount).toBe("100");
    });

    it("should handle deletion in fiat amounts by removing only the last character", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      act(() => {
        result.current.setShowFiatAmount(true);
      });

      act(() => {
        result.current.updateFiatDisplay("31.71");
      });

      act(() => {
        result.current.handleDisplayAmountChange("");
      });

      expect(result.current.fiatAmountDisplay).toBe("31.7");
      expect(result.current.fiatAmount).toBe("31.7");

      act(() => {
        result.current.handleDisplayAmountChange("");
      });

      expect(result.current.fiatAmountDisplay).toBe("31.");
      expect(result.current.fiatAmount).toBe("31");

      act(() => {
        result.current.handleDisplayAmountChange("");
      });

      expect(result.current.fiatAmountDisplay).toBe("3");
      expect(result.current.fiatAmount).toBe("3");
    });

    it("should handle deletion after Max button press", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      act(() => {
        result.current.setShowFiatAmount(true);
      });

      act(() => {
        result.current.updateFiatDisplay("31.71");
      });

      act(() => {
        result.current.handleDisplayAmountChange("");
      });

      expect(result.current.fiatAmountDisplay).toBe("31.7");
      expect(result.current.fiatAmount).toBe("31.7");

      act(() => {
        result.current.handleDisplayAmountChange("");
      });

      expect(result.current.fiatAmountDisplay).toBe("31.");
      expect(result.current.fiatAmount).toBe("31");

      act(() => {
        result.current.handleDisplayAmountChange("");
      });

      expect(result.current.fiatAmountDisplay).toBe("3");
      expect(result.current.fiatAmount).toBe("3");
    });

    it("should allow typing double digits in fiat amounts", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      act(() => {
        result.current.setShowFiatAmount(true);
      });

      act(() => {
        result.current.handleDisplayAmountChange("5");
      });

      expect(result.current.fiatAmountDisplay).toBe("5");

      act(() => {
        result.current.handleDisplayAmountChange("5");
      });

      expect(result.current.fiatAmountDisplay).toBe("55");

      act(() => {
        result.current.handleDisplayAmountChange(",");
      });

      expect(result.current.fiatAmountDisplay).toBe("55,");

      act(() => {
        result.current.handleDisplayAmountChange("0");
      });

      expect(result.current.fiatAmountDisplay).toBe("55,0");

      act(() => {
        result.current.handleDisplayAmountChange("0");
      });

      expect(result.current.fiatAmountDisplay).toBe("55,00");
    });

    it("should delete decimal separator and preceding digit when deleting from decimal separator", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      act(() => {
        result.current.setShowFiatAmount(true);
      });

      act(() => {
        result.current.updateFiatDisplay("55,");
      });

      act(() => {
        result.current.handleDisplayAmountChange("");
      });

      expect(result.current.fiatAmountDisplay).toBe("5");
      expect(result.current.fiatAmount).toBe("5");

      act(() => {
        result.current.updateFiatDisplay("55.");
      });

      act(() => {
        result.current.handleDisplayAmountChange("");
      });

      expect(result.current.fiatAmountDisplay).toBe("5");
      expect(result.current.fiatAmount).toBe("5");
    });
  });

  describe("Max spendable validation", () => {
    it("should allow typing amounts exceeding max spendable in token mode", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      act(() => {
        result.current.handleDisplayAmountChange("1");
      });
      act(() => {
        result.current.handleDisplayAmountChange("0");
      });
      act(() => {
        result.current.handleDisplayAmountChange("0");
      });

      expect(result.current.tokenAmountDisplay).toBe("100");
      expect(result.current.tokenAmount).toBe("100");
    });

    it("should allow typing amounts exceeding max spendable in fiat mode", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      act(() => {
        result.current.setShowFiatAmount(true);
      });

      act(() => {
        result.current.handleDisplayAmountChange("2");
      });
      act(() => {
        result.current.handleDisplayAmountChange("0");
      });
      act(() => {
        result.current.handleDisplayAmountChange("0");
      });

      expect(result.current.fiatAmountDisplay).toBe("200");
      expect(result.current.fiatAmount).toBe("200");
    });
  });

  describe("Fiat mode direct input scenarios", () => {
    it("should handle integer input when converting to dollar immediately", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      // Step 1: Convert to dollar immediately
      act(() => {
        result.current.setShowFiatAmount(true);
      });

      // Step 2: Tap an integer amount directly (not using % buttons)
      act(() => {
        result.current.handleDisplayAmountChange("1");
      });
      act(() => {
        result.current.handleDisplayAmountChange("5");
      });
      act(() => {
        result.current.handleDisplayAmountChange("0");
      });

      expect(result.current.fiatAmountDisplay).toBe("150");
      expect(result.current.fiatAmount).toBe("150");
      // Should convert to token amount correctly
      expect(result.current.tokenAmount).toBe("60.0000000");
    });

    it("should handle '0' + '.' + decimal digits input when converting to dollar immediately", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      // Step 1: Convert to dollar immediately
      act(() => {
        result.current.setShowFiatAmount(true);
      });

      // Step 2: Tap "0" + "." + "1234567"
      // Note: Fiat amounts are limited to 2 decimal places (FIAT_DECIMALS)
      act(() => {
        result.current.handleDisplayAmountChange("0");
      });
      act(() => {
        result.current.handleDisplayAmountChange(".");
      });
      act(() => {
        result.current.handleDisplayAmountChange("1");
      });
      act(() => {
        result.current.handleDisplayAmountChange("2");
      });
      // Additional digits beyond 2 decimal places should be ignored
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
      });
      act(() => {
        result.current.handleDisplayAmountChange("7");
      });

      // Should be capped at 2 decimal places
      expect(result.current.fiatAmountDisplay).toBe("0.12");
      expect(result.current.fiatAmount).toBe("0.12");
      // Should convert to token amount correctly (0.12 / 2.5 = 0.048)
      const expectedTokenAmount = new BigNumber("0.12")
        .dividedBy(2.5)
        .toFixed(DEFAULT_DECIMALS);
      expect(result.current.tokenAmount).toBe(expectedTokenAmount);
    });

    it("should handle '.' + decimal digits input when converting to dollar immediately", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      // Step 1: Convert to dollar immediately
      act(() => {
        result.current.setShowFiatAmount(true);
      });

      // Step 2: Tap "." + "1234567" (leading decimal separator)
      // Note: Fiat amounts are limited to 2 decimal places (FIAT_DECIMALS)
      act(() => {
        result.current.handleDisplayAmountChange(".");
      });
      act(() => {
        result.current.handleDisplayAmountChange("1");
      });
      act(() => {
        result.current.handleDisplayAmountChange("2");
      });
      // Additional digits beyond 2 decimal places should be ignored
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
      });
      act(() => {
        result.current.handleDisplayAmountChange("7");
      });

      // Should handle leading decimal separator and be capped at 2 decimal places
      // Display may show as ".12" or "0.12" depending on implementation
      expect(["0.12", ".12"]).toContain(result.current.fiatAmountDisplay);
      // Internal value should be 0.12 (2 decimal places max)
      expect(result.current.fiatAmount).toBe("0.12");
      // Should convert to token amount correctly (0.12 / 2.5 = 0.048)
      const expectedTokenAmount = new BigNumber("0.12")
        .dividedBy(2.5)
        .toFixed(DEFAULT_DECIMALS);
      expect(result.current.tokenAmount).toBe(expectedTokenAmount);
    });
  });

  describe("Mode switching consistency", () => {
    it("should maintain consistency when switching modes multiple times with integer amount in fiat mode", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      // Step 1: Convert to dollar immediately
      act(() => {
        result.current.setShowFiatAmount(true);
      });

      // Step 2: Tap any random integer amount
      act(() => {
        result.current.handleDisplayAmountChange("4");
      });
      act(() => {
        result.current.handleDisplayAmountChange("2");
      });
      act(() => {
        result.current.handleDisplayAmountChange("5");
      });

      const initialFiatAmount = result.current.fiatAmount;
      const initialTokenAmount = result.current.tokenAmount;

      expect(initialFiatAmount).toBe("425");
      expect(initialTokenAmount).toBe("170.0000000"); // 425 / 2.5 = 170

      // Step 3: Switch from dollar to token to dollar to token multiple times
      // First switch: dollar -> token
      act(() => {
        result.current.setShowFiatAmount(false);
      });
      expect(result.current.tokenAmount).toBe("170.0000000");
      expect(result.current.fiatAmount).toBe("425.00"); // Should recalculate from token

      // Second switch: token -> dollar
      act(() => {
        result.current.setShowFiatAmount(true);
      });
      expect(result.current.fiatAmount).toBe("425.00");
      expect(result.current.tokenAmount).toBe("170.0000000");

      // Third switch: dollar -> token
      act(() => {
        result.current.setShowFiatAmount(false);
      });
      expect(result.current.tokenAmount).toBe("170.0000000");
      expect(result.current.fiatAmount).toBe("425.00");

      // Fourth switch: token -> dollar
      act(() => {
        result.current.setShowFiatAmount(true);
      });
      expect(result.current.fiatAmount).toBe("425.00");
      expect(result.current.tokenAmount).toBe("170.0000000");

      // Final values should match initial converted values
      expect(result.current.fiatAmount).toBe("425.00");
      expect(result.current.tokenAmount).toBe("170.0000000");
    });

    it("should maintain consistency when switching modes multiple times with decimal amount in fiat mode", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      // Step 1: Convert to dollar immediately
      act(() => {
        result.current.setShowFiatAmount(true);
      });

      // Step 2: Tap a decimal amount
      act(() => {
        result.current.handleDisplayAmountChange("3");
      });
      act(() => {
        result.current.handleDisplayAmountChange("3");
      });
      act(() => {
        result.current.handleDisplayAmountChange(".");
      });
      act(() => {
        result.current.handleDisplayAmountChange("7");
      });
      act(() => {
        result.current.handleDisplayAmountChange("1");
      });

      const initialFiatAmount = result.current.fiatAmount;
      const initialTokenAmount = result.current.tokenAmount;

      expect(initialFiatAmount).toBe("33.71");
      expect(initialTokenAmount).toBe("13.4840000"); // 33.71 / 2.5 = 13.484

      // Step 3: Switch from dollar to token to dollar to token multiple times
      // First switch: dollar -> token
      act(() => {
        result.current.setShowFiatAmount(false);
      });
      expect(result.current.tokenAmount).toBe("13.4840000");
      expect(result.current.fiatAmount).toBe("33.71");

      // Second switch: token -> dollar
      act(() => {
        result.current.setShowFiatAmount(true);
      });
      expect(result.current.fiatAmount).toBe("33.71");
      expect(result.current.tokenAmount).toBe("13.4840000");

      // Third switch: dollar -> token
      act(() => {
        result.current.setShowFiatAmount(false);
      });
      expect(result.current.tokenAmount).toBe("13.4840000");
      expect(result.current.fiatAmount).toBe("33.71");

      // Fourth switch: token -> dollar
      act(() => {
        result.current.setShowFiatAmount(true);
      });
      expect(result.current.fiatAmount).toBe("33.71");
      expect(result.current.tokenAmount).toBe("13.4840000");

      // Final values should match initial converted values
      expect(result.current.fiatAmount).toBe("33.71");
      expect(result.current.tokenAmount).toBe("13.4840000");
    });

    it("should maintain consistency when switching modes multiple times with integer amount starting in token mode", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      // Step 1: DON'T convert to dollar (stay in token mode)
      expect(result.current.showFiatAmount).toBe(false);

      // Step 2: Tap any random integer amount
      act(() => {
        result.current.handleDisplayAmountChange("7");
      });
      act(() => {
        result.current.handleDisplayAmountChange("5");
      });
      act(() => {
        result.current.handleDisplayAmountChange("0");
      });

      const initialTokenAmount = result.current.tokenAmount;
      const initialFiatAmount = result.current.fiatAmount;

      expect(initialTokenAmount).toBe("750");
      expect(initialFiatAmount).toBe("1875.00"); // 750 * 2.5 = 1875

      // Step 3: Switch from token to dollar to token to dollar multiple times
      // First switch: token -> dollar
      act(() => {
        result.current.setShowFiatAmount(true);
      });
      expect(result.current.fiatAmount).toBe("1875.00");
      expect(result.current.tokenAmount).toBe("750.0000000"); // Should format with decimals

      // Second switch: dollar -> token
      act(() => {
        result.current.setShowFiatAmount(false);
      });
      expect(result.current.tokenAmount).toBe("750.0000000");
      expect(result.current.fiatAmount).toBe("1875.00");

      // Third switch: token -> dollar
      act(() => {
        result.current.setShowFiatAmount(true);
      });
      expect(result.current.fiatAmount).toBe("1875.00");
      expect(result.current.tokenAmount).toBe("750.0000000");

      // Fourth switch: dollar -> token
      act(() => {
        result.current.setShowFiatAmount(false);
      });
      expect(result.current.tokenAmount).toBe("750.0000000");
      expect(result.current.fiatAmount).toBe("1875.00");

      // Final values should match initial converted values
      expect(result.current.tokenAmount).toBe("750.0000000");
      expect(result.current.fiatAmount).toBe("1875.00");
    });

    it("should maintain consistency when switching modes multiple times with decimal amount starting in token mode", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({
          selectedBalance: mockBalance,
        }),
      );

      // Step 1: DON'T convert to dollar (stay in token mode)
      expect(result.current.showFiatAmount).toBe(false);

      // Step 2: Tap a decimal amount
      act(() => {
        result.current.handleDisplayAmountChange("1");
      });
      act(() => {
        result.current.handleDisplayAmountChange("2");
      });
      act(() => {
        result.current.handleDisplayAmountChange(".");
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

      const initialTokenAmount = result.current.tokenAmount;
      const initialFiatAmount = result.current.fiatAmount;

      expect(initialTokenAmount).toBe("12.345");
      expect(initialFiatAmount).toBe("30.86"); // 12.345 * 2.5 = 30.8625, rounded to 30.86

      // Step 3: Switch from token to dollar to token to dollar multiple times
      // First switch: token -> dollar
      act(() => {
        result.current.setShowFiatAmount(true);
      });
      expect(result.current.fiatAmount).toBe("30.86");
      expect(result.current.tokenAmount).toBe("12.3450000"); // Should format with decimals

      // Second switch: dollar -> token
      act(() => {
        result.current.setShowFiatAmount(false);
      });
      expect(result.current.tokenAmount).toBe("12.3450000");
      expect(result.current.fiatAmount).toBe("30.86");

      // Third switch: token -> dollar
      act(() => {
        result.current.setShowFiatAmount(true);
      });
      expect(result.current.fiatAmount).toBe("30.86");
      expect(result.current.tokenAmount).toBe("12.3450000");

      // Fourth switch: dollar -> token
      act(() => {
        result.current.setShowFiatAmount(false);
      });
      expect(result.current.tokenAmount).toBe("12.3450000");
      expect(result.current.fiatAmount).toBe("30.86");

      // Final values should match initial converted values
      expect(result.current.tokenAmount).toBe("12.3450000");
      expect(result.current.fiatAmount).toBe("30.86");
    });
  });

  describe("Fiat display edge cases", () => {
    it("should show '0,00' when raw input is empty after deletion", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({ selectedBalance: mockBalance }),
      );

      act(() => {
        result.current.setShowFiatAmount(true);
      });

      // Type a value and then delete everything
      act(() => {
        result.current.handleDisplayAmountChange("5");
      });
      act(() => {
        result.current.handleDisplayAmountChange("");
      });

      // Should show "0.00" (or "0,00" depending on locale)
      expect(result.current.fiatAmountDisplay).toMatch(/^0[.,]00$/);
    });

    it("should show '0,00' when typing just a comma and then deleting", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({ selectedBalance: mockBalance }),
      );

      act(() => {
        result.current.setShowFiatAmount(true);
      });

      // Type just a comma (starts from "0", so becomes "0,")
      act(() => {
        result.current.handleDisplayAmountChange(",");
      });

      // Should show "0.00" (or "0,00" depending on locale) when "0,"
      expect(result.current.fiatAmountDisplay).toMatch(/^0[.,]00$/);

      // Delete the comma - removes both comma and preceding digit
      act(() => {
        result.current.handleDisplayAmountChange("");
      });

      // Should show "0.00" after deletion (becomes "0")
      expect(result.current.fiatAmountDisplay).toMatch(/^0[.,]00$/);
    });

    it("should show '0,00' when typing comma then zero and then deleting", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({ selectedBalance: mockBalance }),
      );

      act(() => {
        result.current.setShowFiatAmount(true);
      });

      // Type comma then zero (starts from "0", so ",0" becomes "0,0")
      act(() => {
        result.current.handleDisplayAmountChange(",");
      });
      act(() => {
        result.current.handleDisplayAmountChange("0");
      });

      // Should show "0.00" (or "0,00" depending on locale) for "0,0"
      expect(result.current.fiatAmountDisplay).toMatch(/^0[.,]00$/);

      // Delete the zero
      act(() => {
        result.current.handleDisplayAmountChange("");
      });

      // Should show "0.00" (or "0,00" depending on locale) when "0,"
      expect(result.current.fiatAmountDisplay).toMatch(/^0[.,]00$/);
    });

    it("should show '0,00' when typing just a dot and then deleting", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({ selectedBalance: mockBalance }),
      );

      act(() => {
        result.current.setShowFiatAmount(true);
      });

      // Type just a dot (starts from "0", so becomes "0.")
      act(() => {
        result.current.handleDisplayAmountChange(".");
      });

      // Should show "0.00" (or "0,00" depending on locale) when "0."
      expect(result.current.fiatAmountDisplay).toMatch(/^0[.,]00$/);

      // Delete the dot - removes both dot and preceding digit
      act(() => {
        result.current.handleDisplayAmountChange("");
      });

      // Should show "0.00" after deletion (becomes "0")
      expect(result.current.fiatAmountDisplay).toMatch(/^0[.,]00$/);
    });

    it("should preserve valid input like '55,' and not format it to '0,00'", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({ selectedBalance: mockBalance }),
      );

      act(() => {
        result.current.setShowFiatAmount(true);
      });

      // Type "55,"
      act(() => {
        result.current.handleDisplayAmountChange("5");
      });
      act(() => {
        result.current.handleDisplayAmountChange("5");
      });
      act(() => {
        result.current.handleDisplayAmountChange(",");
      });

      // Should preserve "55," (or "55." depending on locale) - not format to "0,00"
      expect(result.current.fiatAmountDisplay).toMatch(/^55[.,]$/);
    });

    it("should show '0,00' when deleting from a single digit value", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({ selectedBalance: mockBalance }),
      );

      act(() => {
        result.current.setShowFiatAmount(true);
      });

      // Type "5"
      act(() => {
        result.current.handleDisplayAmountChange("5");
      });

      expect(result.current.fiatAmountDisplay).toBe("5");

      // Delete "5"
      act(() => {
        result.current.handleDisplayAmountChange("");
      });

      // Should show "0.00" (or "0,00" depending on locale) when empty
      expect(result.current.fiatAmountDisplay).toMatch(/^0[.,]00$/);
    });

    it("should show '0,00' when deleting from comma leaves empty string", () => {
      const mockBalance = createMockPricedBalance(100, 2.5);
      const { result } = renderHook(() =>
        useTokenFiatConverter({ selectedBalance: mockBalance }),
      );

      act(() => {
        result.current.setShowFiatAmount(true);
      });

      // Type "5,"
      act(() => {
        result.current.handleDisplayAmountChange("5");
      });
      act(() => {
        result.current.handleDisplayAmountChange(",");
      });

      expect(result.current.fiatAmountDisplay).toMatch(/^5[.,]$/);

      // Delete the comma - should remove both comma and preceding digit
      act(() => {
        result.current.handleDisplayAmountChange("");
      });

      // Should show "0.00" (or "0,00" depending on locale) when empty
      expect(result.current.fiatAmountDisplay).toMatch(/^0[.,]00$/);
    });
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
        tokenDecimals: 4,
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
        tokenDecimals: 4,
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
        tokenDecimals: 4,
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
        tokenDecimals: 4,
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
        tokenDecimals: 4,
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
        tokenDecimals: 4,
      }),
    );

    act(() => {
      result.current.setTokenAmount("12.3456");
    });

    expect(result.current.tokenAmount).toBe("12.3456");
    expect(result.current.fiatAmount).toBe("12.35"); // 12.3456 * 1.0 = 12.35 (rounded to 2 decimals)
  });
});
