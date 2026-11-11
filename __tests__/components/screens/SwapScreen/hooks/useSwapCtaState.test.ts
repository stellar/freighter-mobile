import { renderHook } from "@testing-library/react-hooks";
import BigNumber from "bignumber.js";
import { useSwapCtaState } from "components/screens/SwapScreen/hooks/useSwapCtaState";
import { TokenTypeWithCustomToken } from "config/types";

jest.mock("hooks/useAppTranslation", () => () => ({ t: (k: string) => k }));

const props = (quoteKey: string, currentQuoteKey: string | null) => ({
  sourceBalance: { tokenCode: "XLM" } as never,
  destinationTokenDescriptor: {
    id: "USDC:GA5Z",
    tokenCode: "USDC",
    issuer: "GA5Z",
    decimals: 7,
    tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    requiresTrustline: false,
  },
  sourceAmount: "10",
  spendableAmount: new BigNumber("100"),
  isLoadingPath: false,
  isBuilding: false,
  pathResult: {
    sourceAmount: "10",
    destinationAmount: "2",
    path: [],
    conversionRate: "0.2",
    quoteKey,
  },
  pathError: null,
  amountError: null,
  currentQuoteKey,
});

describe("useSwapCtaState — quote freshness", () => {
  it("offers review when the quote answers the current inputs", () => {
    const { result } = renderHook(() => useSwapCtaState(props("k1", "k1")));

    expect(result.current.ctaState.kind).toBe("review");
  });

  it("holds review (loading) while the quote answers older inputs", () => {
    const { result } = renderHook(() => useSwapCtaState(props("k1", "k2")));

    expect(result.current.ctaState.kind).toBe("loading");
  });
});
