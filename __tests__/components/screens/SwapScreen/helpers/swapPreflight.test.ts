import BigNumber from "bignumber.js";
import {
  getSwapSpendableAmount,
  isSwapQuotePending,
  shouldShowSwapQuoteUnavailable,
  shouldShowXlmReservePreflight,
} from "components/screens/SwapScreen/helpers/swapPreflight";
import { calculateSpendableAmount } from "helpers/balances";

// Isolate the preflight's branch logic from the spendable math.
jest.mock("helpers/balances", () => ({
  calculateSpendableAmount: jest.fn(),
}));

const mockCalc = calculateSpendableAmount as jest.Mock;

// A native XLM balance so the preflight's `find(native)` resolves; the mocked
// calculateSpendableAmount controls the returned spendable regardless of shape.
const xlmBalance = { id: "XLM", token: { type: "native" } } as never;

const baseArgs = {
  balanceItems: [xlmBalance],
  subentryCount: 1,
  swapFee: "0.001",
};

describe("shouldShowXlmReservePreflight", () => {
  beforeEach(() => mockCalc.mockReset());

  it("returns false (and skips the spendable calc) when the destination isn't new", () => {
    expect(
      shouldShowXlmReservePreflight({
        ...baseArgs,
        sourceTokenId: "USDC:GISSUER",
        destinationRequiresTrustline: false,
      }),
    ).toBe(false);
    expect(mockCalc).not.toHaveBeenCalled();
  });

  describe("XLM source", () => {
    it("shows the sheet when the initial spendable is below BASE_RESERVE", () => {
      mockCalc.mockReturnValue(new BigNumber("0.4"));
      expect(
        shouldShowXlmReservePreflight({
          ...baseArgs,
          sourceTokenId: "XLM",
          destinationRequiresTrustline: true,
        }),
      ).toBe(true);
    });

    it("does not show the sheet when the initial spendable covers BASE_RESERVE", () => {
      mockCalc.mockReturnValue(new BigNumber("0.6"));
      expect(
        shouldShowXlmReservePreflight({
          ...baseArgs,
          sourceTokenId: "XLM",
          destinationRequiresTrustline: true,
        }),
      ).toBe(false);
    });
  });

  describe("non-XLM source", () => {
    it("does not double-count the fee: spendable just above BASE_RESERVE → no sheet", () => {
      // calculateSpendableAmount already nets the full transaction fee, so
      // 0.5001 spendable clears the 0.5 reserve. (The old code subtracted an
      // extra swapFee here and would have returned true.)
      mockCalc.mockReturnValue(new BigNumber("0.5001"));
      expect(
        shouldShowXlmReservePreflight({
          ...baseArgs,
          sourceTokenId: "USDC:GISSUER",
          destinationRequiresTrustline: true,
        }),
      ).toBe(false);
    });

    it("shows the sheet when spendable is at/under BASE_RESERVE", () => {
      mockCalc.mockReturnValue(new BigNumber("0.5"));
      expect(
        shouldShowXlmReservePreflight({
          ...baseArgs,
          sourceTokenId: "USDC:GISSUER",
          destinationRequiresTrustline: true,
        }),
      ).toBe(true);
    });
  });
});

describe("getSwapSpendableAmount", () => {
  beforeEach(() => mockCalc.mockReset());

  const usdcBalance = { id: "USDC:GISSUER", token: { code: "USDC" } } as never;

  it("leaves out the reserve a new trustline locks when XLM is swapped into it", () => {
    mockCalc.mockReturnValue(new BigNumber("10"));
    expect(
      getSwapSpendableAmount({
        sourceBalance: xlmBalance,
        subentryCount: 1,
        transactionFee: "0.002",
        destinationRequiresTrustline: true,
      }).toFixed(),
    ).toBe("9.5");
    expect(mockCalc).toHaveBeenCalledWith({
      balance: xlmBalance,
      subentryCount: 1,
      transactionFee: "0.002",
    });
  });

  it("deducts nothing below the reserve, leaving the shortfall to the pre-flight", () => {
    mockCalc.mockReturnValue(new BigNumber("0.4"));
    expect(
      getSwapSpendableAmount({
        sourceBalance: xlmBalance,
        subentryCount: 1,
        transactionFee: "0.002",
        destinationRequiresTrustline: true,
      }).toFixed(),
    ).toBe("0.4");
  });

  it("deducts nothing when the destination already has a trustline", () => {
    mockCalc.mockReturnValue(new BigNumber("10"));
    expect(
      getSwapSpendableAmount({
        sourceBalance: xlmBalance,
        subentryCount: 1,
        transactionFee: "0.001",
        destinationRequiresTrustline: false,
      }).toFixed(),
    ).toBe("10");
  });

  it("deducts nothing from a non-XLM source, whose reserve comes from XLM", () => {
    mockCalc.mockReturnValue(new BigNumber("25"));
    expect(
      getSwapSpendableAmount({
        sourceBalance: usdcBalance,
        subentryCount: 1,
        transactionFee: "0.002",
        destinationRequiresTrustline: true,
      }).toFixed(),
    ).toBe("25");
  });

  // A Soroban balance is held in the token's smallest unit.
  it("reads a Soroban balance in whole tokens", () => {
    mockCalc.mockReturnValue(new BigNumber("12345"));
    const sorobanBalance = {
      id: "CTOKEN",
      contractId: "CTOKEN",
      decimals: 3,
      token: { code: "TKN" },
    } as never;
    expect(
      getSwapSpendableAmount({
        sourceBalance: sorobanBalance,
        subentryCount: 1,
        transactionFee: "0.002",
        destinationRequiresTrustline: false,
      }).toFixed(),
    ).toBe("12.345");
  });
});

describe("isSwapQuotePending", () => {
  const base = {
    currentQuoteKey: "k2",
    sourceAmount: "5",
    amountError: null,
    isQuoteCurrent: false,
    pathErrorQuoteKey: null,
  };

  it("waits for the quote for the current inputs", () => {
    expect(isSwapQuotePending(base)).toBe(true);
  });

  it("settles once that quote arrives or fails", () => {
    expect(isSwapQuotePending({ ...base, isQuoteCurrent: true })).toBe(false);
    expect(isSwapQuotePending({ ...base, pathErrorQuoteKey: "k2" })).toBe(
      false,
    );
  });

  // An amount error stops the request, so it would never settle.
  it("doesn't wait behind an amount error", () => {
    expect(
      isSwapQuotePending({ ...base, amountError: "Insufficient balance" }),
    ).toBe(false);
  });
});

describe("shouldShowSwapQuoteUnavailable", () => {
  const base = {
    isLoadingPath: false,
    currentQuoteKey: "k2",
    pathErrorQuoteKey: "k2",
    isInsufficient: false,
    amountError: null,
    sourceAmount: "5",
    hasPathErrorReason: true,
  };

  it("explains a failed quote for the current inputs", () => {
    expect(shouldShowSwapQuoteUnavailable(base)).toBe(true);
  });

  it("not for an older quote's failure, or while a new one loads", () => {
    expect(
      shouldShowSwapQuoteUnavailable({ ...base, pathErrorQuoteKey: "k1" }),
    ).toBe(false);
    expect(
      shouldShowSwapQuoteUnavailable({ ...base, isLoadingPath: true }),
    ).toBe(false);
  });

  it("not when the amount itself is the problem", () => {
    expect(
      shouldShowSwapQuoteUnavailable({ ...base, isInsufficient: true }),
    ).toBe(false);
  });
});
