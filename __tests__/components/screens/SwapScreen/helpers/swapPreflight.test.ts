import BigNumber from "bignumber.js";
import { shouldShowXlmReservePreflight } from "components/screens/SwapScreen/helpers/swapPreflight";
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
