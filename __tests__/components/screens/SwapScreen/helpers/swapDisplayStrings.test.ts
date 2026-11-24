import BigNumber from "bignumber.js";
import { buildSourceBalanceRight } from "components/screens/SwapScreen/helpers/swapDisplayStrings";
import { PricedBalance } from "config/types";

describe("buildSourceBalanceRight", () => {
  it("shows a Soroban source's spendable amount, already in whole tokens, once", () => {
    const sourceBalance = {
      id: "TKN:CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      tokenCode: "TKN",
      decimals: 6,
      total: new BigNumber("100000000"),
    } as unknown as PricedBalance;

    expect(
      buildSourceBalanceRight({
        sourceBalance,
        sourceTokenSymbol: "TKN",
        spendableAmount: new BigNumber("100"),
        availableLabel: "available",
      }),
    ).toBe("100.00 TKN available");
  });
});
