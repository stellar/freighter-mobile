/* eslint-disable @fnando/consistent-import/consistent-import */
import { renderHook } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
import { useSwapCtaState } from "components/screens/SwapScreen/hooks/useSwapCtaState";
import { SwapPathResult } from "ducks/swap";

jest.mock("hooks/useAppTranslation", () => {
  const stableTranslation = { t: (key: string) => key };
  return {
    __esModule: true,
    default: () => stableTranslation,
  };
});

type HookProps = Parameters<typeof useSwapCtaState>[0];

const quoteFor = (sourceAmount: string): SwapPathResult => ({
  sourceAmount,
  destinationAmount: "50.0000000",
  destinationAmountMin: "49.7500000",
  path: [],
  conversionRate: "0.5000000",
});

const baseProps: HookProps = {
  sourceBalance: { tokenCode: "XLM" } as never,
  destinationTokenDescriptor: { tokenCode: "USDC" } as never,
  sourceAmount: "100",
  spendableAmount: new BigNumber("1000"),
  isLoadingPath: false,
  isBuilding: false,
  pathResult: quoteFor("100"),
  pathError: null,
  amountError: null,
};

const ctaKind = (props: Partial<HookProps>) =>
  renderHook(() => useSwapCtaState({ ...baseProps, ...props })).result.current
    .ctaState.kind;

describe("useSwapCtaState", () => {
  it("offers Review once the quote is for the amount entered", () => {
    expect(ctaKind({})).toBe("review");
  });

  it("treats the quote's own precision as the same amount", () => {
    expect(ctaKind({ pathResult: quoteFor("100.0000000") })).toBe("review");
  });

  // Path-finding waits for typing to pause, so for a moment the quote is
  // still the previous amount's.
  it("keeps loading while the quote is still for the previous amount", () => {
    expect(ctaKind({ sourceAmount: "1000", pathResult: quoteFor("100") })).toBe(
      "loading",
    );
  });

  it("still asks for an amount when path-finding failed", () => {
    expect(
      ctaKind({
        sourceAmount: "1000",
        pathResult: quoteFor("100"),
        pathError: "No path found",
      }),
    ).toBe("enter");
  });
});
