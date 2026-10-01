import { renderHook } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
import { useSwapCtaState } from "components/screens/SwapScreen/hooks/useSwapCtaState";
import { PricedBalance } from "config/types";
import { SwapInputSide, SwapPathResult } from "ducks/swap";

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => key,
}));

const balance = { id: "USDC:G" } as unknown as PricedBalance;
const destination = {
  id: "XAUM:C",
} as unknown as Parameters<
  typeof useSwapCtaState
>[0]["destinationTokenDescriptor"];
const path = { destinationAmount: "1" } as unknown as SwapPathResult;

const cta = (overrides: Partial<Parameters<typeof useSwapCtaState>[0]> = {}) =>
  renderHook(() =>
    useSwapCtaState({
      sourceBalance: balance,
      destinationTokenDescriptor: destination,
      sourceAmount: "",
      inputSide: SwapInputSide.SOURCE,
      destinationInputAmount: "",
      spendableAmount: new BigNumber(10),
      isLoadingPath: false,
      isBuilding: false,
      pathResult: null,
      pathError: null,
      amountError: null,
      ...overrides,
    }),
  ).result.current;

describe("useSwapCtaState", () => {
  const receive = {
    inputSide: SwapInputSide.DESTINATION,
    destinationInputAmount: "0.5",
  };

  it.each([
    ["asks for an amount while the sell amount is empty", {}, "enter"],
    [
      "loads while the quote is fetched",
      { sourceAmount: "1", isLoadingPath: true },
      "loading",
    ],
    [
      "blocks an amount above what is spendable",
      { sourceAmount: "11" },
      "insufficient",
    ],
    [
      "offers the review once a quote is in",
      { sourceAmount: "1", pathResult: path },
      "review",
    ],
    [
      "asks for an amount while the receive amount is empty",
      { ...receive, destinationInputAmount: "" },
      "enter",
    ],
    [
      "loads while the sell amount is fetched, before it is known",
      { ...receive, isLoadingPath: true },
      "loading",
    ],
    [
      "does not flash 'insufficient' from a stale sell amount while it loads",
      { ...receive, sourceAmount: "50", isLoadingPath: true },
      "loading",
    ],
    [
      "blocks a derived sell amount above what is spendable once it is quoted",
      { ...receive, sourceAmount: "50", pathResult: path },
      "insufficient",
    ],
    [
      "offers the review once the sell amount is quoted",
      { ...receive, sourceAmount: "1", pathResult: path },
      "review",
    ],
  ])("%s", (_title, overrides, kind) => {
    expect(cta(overrides).ctaState.kind).toBe(kind);
  });

  it("asks for a token before anything else", () => {
    expect(cta({ sourceBalance: undefined }).ctaState).toEqual({
      kind: "select",
      missingSide: "source",
    });
    expect(cta({ destinationTokenDescriptor: null }).ctaState).toEqual({
      kind: "select",
      missingSide: "destination",
    });
  });
});
