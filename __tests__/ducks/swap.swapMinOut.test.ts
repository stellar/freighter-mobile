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
});
