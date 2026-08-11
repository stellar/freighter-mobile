import BigNumber from "bignumber.js";
import { formatTokenAmount } from "helpers/history/v2/formatTokenAmount";

describe("formatTokenAmount", () => {
  it("scales by decimals and trims trailing zeros", () => {
    expect(formatTokenAmount(new BigNumber("404000000"), 7)).toBe("40.4");
  });

  it("returns the integer form when decimals is 0", () => {
    expect(formatTokenAmount(new BigNumber("42"), 0)).toBe("42");
  });

  it("drops the trailing separator for whole amounts", () => {
    expect(formatTokenAmount(new BigNumber("10000000"), 7)).toBe("1");
  });

  it("handles high-decimal SEP-41 scales without precision loss", () => {
    expect(formatTokenAmount(new BigNumber("1000000000000000000"), 18)).toBe(
      "1",
    );
  });
});
