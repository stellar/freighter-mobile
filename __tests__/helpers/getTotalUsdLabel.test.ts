import { BigNumber } from "bignumber.js";
import { getTotalUsdLabel } from "helpers/balances";
import { NO_FIAT_VALUE } from "helpers/formatAmount";

/**
 * Mirrors the extension's `getTotalUsdLabel` suite so both clients are pinned
 * to the same rule for "$0.00" vs "--".
 */
const label = (overrides: Partial<Parameters<typeof getTotalUsdLabel>[0]>) =>
  getTotalUsdLabel({
    hasError: false,
    hasPriceFeed: true,
    isFunded: true,
    hasPrices: true,
    totalUsd: new BigNumber("1149.239"),
    ...overrides,
  });

describe("getTotalUsdLabel", () => {
  // NOTE: the extension's suite expects "$1,149.23" for this input — its
  // roundUsdValue truncates the third decimal where mobile's formatFiatAmount
  // rounds it. That's pre-existing formatting, not part of the "$0.00" vs "--"
  // rule this helper ports, so mobile's behavior is pinned as-is.
  it("formats the total when it can be determined", () => {
    expect(label({})).toBe("$1,149.24");
  });

  // Zero is a fact here, not a stand-in for a total that went missing.
  it("returns zero where the network prices no tokens", () => {
    expect(label({ hasPriceFeed: false })).toBe("$0.00");
  });

  it("returns zero for an unfunded account", () => {
    expect(label({ isFunded: false })).toBe("$0.00");
  });

  // Zero would claim the account is empty when its balances are unknown.
  it("returns the placeholder when account data failed", () => {
    expect(label({ hasError: true })).toBe(NO_FIAT_VALUE);
  });

  it("returns the placeholder when a funded account prices nothing", () => {
    expect(label({ hasPrices: false })).toBe(NO_FIAT_VALUE);
  });

  // A real zero on a priced network still reads as a total, not a gap.
  it("keeps a genuine zero total distinct from the placeholder", () => {
    expect(label({ totalUsd: new BigNumber(0) })).toBe("$0.00");
  });

  // An error outranks every other input: nothing else is trustworthy once the
  // balances themselves failed to load.
  it("prefers the placeholder over zero when an unfunded fetch also failed", () => {
    expect(label({ hasError: true, isFunded: false })).toBe(NO_FIAT_VALUE);
  });

  // No feed means no prices to miss, so the zero must survive hasPrices=false.
  it("returns zero on a feedless network even with nothing priced", () => {
    expect(label({ hasPriceFeed: false, hasPrices: false })).toBe("$0.00");
  });

  it("treats a missing total as zero once a price feed reported in", () => {
    expect(label({ totalUsd: undefined })).toBe("$0.00");
  });
});
