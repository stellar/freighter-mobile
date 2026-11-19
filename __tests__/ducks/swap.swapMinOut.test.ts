import { swapMinOut } from "ducks/swap";

describe("swapMinOut", () => {
  it.each([
    ["1.0000001", 1, "0.9900000"],
    ["100", 7, "93.0000000"],
    ["2.5", 0.5, "2.4875000"],
    ["17.5450814", 2, "17.1941797"],
    ["5", 0, "5.0000000"],
  ])("%s at %s%% slippage is %s, rounded down", (toAmount, slippage, want) => {
    expect(swapMinOut(toAmount, slippage)).toBe(want);
  });

  it.each([
    ["1.000000000000000001", 1, 18, "0.990000000000000000"],
    ["17.55", 2, 2, "17.19"],
    ["3", 50, 0, "1"],
  ])(
    "%s at %s%% slippage is rounded down to the token's %s decimals: %s",
    (toAmount, slippage, decimals, want) => {
      expect(swapMinOut(toAmount, slippage, decimals)).toBe(want);
    },
  );
});
