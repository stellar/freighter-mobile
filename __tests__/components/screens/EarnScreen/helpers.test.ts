import BigNumber from "bignumber.js";
import {
  NotEnoughVariant,
  clampXlmDepositAmount,
  formatCompactUsd,
  formatProjection,
  formatRate,
  getEarnCtaState,
  getMaxDepositAmount,
  getNotEnoughVariant,
  getPercentageDepositAmount,
  getPoolDescriptionKey,
  hasSwappableBalance,
  isOnrampableAsset,
  needsXlmForFee,
  projectEarnings,
} from "components/screens/EarnScreen/helpers";
import { NETWORKS } from "config/constants";

describe("getEarnCtaState", () => {
  it("reports insufficient before anything else when there is nothing to spend", () => {
    expect(
      getEarnCtaState({
        availableBalanceIsZero: true,
        amountIsZero: true,
        isAmountTooHigh: false,
      }),
    ).toEqual({ disabled: true, labelKey: "insufficient" });
  });

  it("asks for an amount once a balance exists", () => {
    expect(
      getEarnCtaState({
        availableBalanceIsZero: false,
        amountIsZero: true,
        isAmountTooHigh: false,
      }),
    ).toEqual({ disabled: true, labelKey: "enter" });
  });

  it("reports insufficient for an over-large amount", () => {
    expect(
      getEarnCtaState({
        availableBalanceIsZero: false,
        amountIsZero: false,
        isAmountTooHigh: true,
      }),
    ).toEqual({ disabled: true, labelKey: "insufficient" });
  });

  it("enables review for a valid amount", () => {
    expect(
      getEarnCtaState({
        availableBalanceIsZero: false,
        amountIsZero: false,
        isAmountTooHigh: false,
      }),
    ).toEqual({ disabled: false, labelKey: "review" });
  });

  it("prefers the enter-amount prompt when a zero amount is also flagged too high", () => {
    // The only case that can distinguish guard order: amountIsZero and
    // isAmountTooHigh are the one pair that yield different labels, so this
    // is the sole test that proves which guard actually wins.
    expect(
      getEarnCtaState({
        availableBalanceIsZero: false,
        amountIsZero: true,
        isAmountTooHigh: true,
      }),
    ).toEqual({ disabled: true, labelKey: "enter" });
  });
});

describe("needsXlmForFee", () => {
  it("is true when spendable XLM is below the fee", () => {
    expect(needsXlmForFee({ spendableXlm: "0.01", fee: "0.06" })).toBe(true);
  });

  it("is false when spendable XLM covers the fee exactly", () => {
    expect(needsXlmForFee({ spendableXlm: "0.06", fee: "0.06" })).toBe(false);
  });
});

describe("getMaxDepositAmount", () => {
  it("holds back a fee buffer for XLM", () => {
    // A Blend submit's resource fee dwarfs the inclusion fee already netted out
    // by calculateSpendableAmount, so Max must reserve more.
    expect(getMaxDepositAmount({ availableBalance: "100", isXlm: true })).toBe(
      "99.5",
    );
  });

  it("never returns a negative amount", () => {
    expect(getMaxDepositAmount({ availableBalance: "0.1", isXlm: true })).toBe(
      "0",
    );
  });

  it("leaves non-XLM balances untouched — their fee comes from a separate balance", () => {
    expect(getMaxDepositAmount({ availableBalance: "100", isXlm: false })).toBe(
      "100",
    );
  });
});

describe("clampXlmDepositAmount", () => {
  it("reduces the entered amount to fit once the real resource fee is known", () => {
    expect(
      clampXlmDepositAmount({
        enteredAmount: "99.5",
        spendableXlm: "99.5",
        resourceFeeXlm: "0.0546",
        decimals: 7,
        isXlm: true,
      }),
    ).toBe("99.4454");
  });

  it("leaves an amount that already fits untouched", () => {
    expect(
      clampXlmDepositAmount({
        enteredAmount: "50",
        spendableXlm: "99.5",
        resourceFeeXlm: "0.0546",
        decimals: 7,
        isXlm: true,
      }),
    ).toBe("50");
  });

  it("never returns negative — floors at zero when the fee exceeds spendable", () => {
    expect(
      clampXlmDepositAmount({
        enteredAmount: "1",
        spendableXlm: "0.02",
        resourceFeeXlm: "0.0546",
        decimals: 7,
        isXlm: true,
      }),
    ).toBe("0");
  });

  it("rounds DOWN at the asset's decimals rather than up or to nearest", () => {
    // 10 - 0.0546000004 = 9.9453999996 -> floors to 9.945399 at 6 decimals,
    // never 9.9454 (which would round up and no longer strictly fit).
    expect(
      clampXlmDepositAmount({
        enteredAmount: "10",
        spendableXlm: "10",
        resourceFeeXlm: "0.0546000004",
        decimals: 6,
        isXlm: true,
      }),
    ).toBe("9.945399");
  });

  it("is idempotent: re-running on its own output is a no-op", () => {
    const params = {
      enteredAmount: "99.5",
      spendableXlm: "99.5",
      resourceFeeXlm: "0.0546",
      decimals: 7,
      isXlm: true,
    };
    const clamped = clampXlmDepositAmount(params);
    expect(clampXlmDepositAmount({ ...params, enteredAmount: clamped })).toBe(
      clamped,
    );
  });

  it("does not apply to a non-XLM deposit — its fee comes from a separate balance", () => {
    expect(
      clampXlmDepositAmount({
        enteredAmount: "1000",
        spendableXlm: "1",
        resourceFeeXlm: "0.0546",
        decimals: 7,
        isXlm: false,
      }),
    ).toBe("1000");
  });

  it("does not apply when the resource fee is unknown (null) rather than treating it as zero", () => {
    expect(
      clampXlmDepositAmount({
        enteredAmount: "99.5",
        spendableXlm: "50",
        resourceFeeXlm: null,
        decimals: 7,
        isXlm: true,
      }),
    ).toBe("99.5");
  });
});

describe("getPercentageDepositAmount", () => {
  it("treats the input as whole percents, not a multiplier", () => {
    expect(
      getPercentageDepositAmount({
        maxDepositable: "100",
        pct: 25,
        decimals: 7,
      }),
    ).toBe("25");
  });

  it("rounds down so Max never exceeds the spendable amount", () => {
    expect(
      getPercentageDepositAmount({
        maxDepositable: "10.9999999999",
        pct: 100,
        decimals: 2,
      }),
    ).toBe("10.99");
  });
});

describe("projectEarnings", () => {
  it("uses simple interest and derives monthly as a twelfth of yearly", () => {
    expect(projectEarnings({ depositUsd: "1200", apy: 0.1 })).toEqual({
      yearly: "120.00",
      monthly: "10.00",
    });
  });

  it("returns nulls when the rate is unavailable", () => {
    expect(projectEarnings({ depositUsd: "1200", apy: null })).toEqual({
      yearly: null,
      monthly: null,
    });
  });

  it("returns nulls when the asset is unpriced", () => {
    expect(projectEarnings({ depositUsd: null, apy: 0.1 })).toEqual({
      yearly: null,
      monthly: null,
    });
  });

  it("renders an unknown projection as --", () => {
    expect(formatProjection(null)).toBe("--");
    expect(formatProjection("120.00")).toBe("$120.00");
  });
});

describe("formatCompactUsd", () => {
  it("compacts pool-scale figures", () => {
    expect(formatCompactUsd(50050000)).toBe("$50.05M");
    expect(formatCompactUsd(2500)).toBe("$2.50K");
    expect(formatCompactUsd(1.5e9)).toBe("$1.50B");
  });

  it("distinguishes unavailable from zero", () => {
    expect(formatCompactUsd(null)).toBe("--");
    expect(formatCompactUsd(0)).toBe("$0.00");
  });
});

describe("formatRate", () => {
  it("renders a decimal fraction as a percentage", () => {
    expect(formatRate(0.1694)).toBe("16.94%");
  });

  it("distinguishes unavailable from zero", () => {
    expect(formatRate(null)).toBe("--");
    expect(formatRate(0)).toBe("0.00%");
  });
});

describe("getPoolDescriptionKey", () => {
  it("keys prose by pool id, because the copy makes pool-specific claims", () => {
    expect(
      getPoolDescriptionKey(
        "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD",
      ),
    ).toBe("earnPoolDetails.descriptions.fixedPool");
  });

  it("renders nothing rather than something wrong for an unknown pool", () => {
    expect(getPoolDescriptionKey("CUNKNOWN")).toBeNull();
  });
});

describe("isOnrampableAsset", () => {
  const mainnet = { network: NETWORKS.PUBLIC } as never;
  const testnet = { network: NETWORKS.TESTNET } as never;

  it("allows only Coinbase-listed assets", () => {
    expect(isOnrampableAsset("XLM", mainnet)).toBe(true);
    expect(isOnrampableAsset("USDC", mainnet)).toBe(true);
    // EURC is not Coinbase-listed; offering Buy would open a dead-end page.
    expect(isOnrampableAsset("EURC", mainnet)).toBe(false);
  });

  it("is mainnet-only, since testnet assets are worthless", () => {
    expect(isOnrampableAsset("XLM", testnet)).toBe(false);
  });
});

describe("hasSwappableBalance", () => {
  const classic = (code: string, issuer: string, total: string) =>
    ({
      total: new BigNumber(total),
      token: { code, issuer: { key: issuer } },
    }) as never;

  // Real NativeToken always carries `type: "native"` (config/types.ts) — the
  // native() mock includes it so this fixture matches production shape, per
  // the type-based discriminant used by hasSwappableBalance (see helper file
  // for why a code-based check is unsafe).
  const native = (total: string) =>
    ({
      total: new BigNumber(total),
      token: { type: "native", code: "XLM" },
    }) as never;

  it("counts native XLM, the most common swap source", () => {
    expect(hasSwappableBalance({ XLM: native("10") }, "USDC:GISSUER")).toBe(
      true,
    );
  });

  it("excludes the target asset itself so dust does not look swappable", () => {
    expect(
      hasSwappableBalance(
        { "USDC:GISSUER": classic("USDC", "GISSUER", "0.001") },
        "USDC:GISSUER",
      ),
    ).toBe(false);
  });

  it("excludes zero balances", () => {
    expect(hasSwappableBalance({ XLM: native("0") }, "USDC:GISSUER")).toBe(
      false,
    );
  });

  it("excludes Soroban-only tokens, which Swap cannot path-payment", () => {
    const soroban = {
      total: new BigNumber("5"),
      contractId: "CABC",
      token: { code: "ABC", issuer: { key: "CABC" } },
    } as never;
    expect(hasSwappableBalance({ "ABC:CABC": soroban }, "USDC:GISSUER")).toBe(
      false,
    );
  });
});

describe("getNotEnoughVariant", () => {
  it("offers buy and swap when both are possible", () => {
    expect(getNotEnoughVariant({ isOnrampable: true, isSwappable: true })).toBe(
      NotEnoughVariant.BUY_SWAP_OR_TRANSFER,
    );
  });

  it("offers buy alone", () => {
    expect(
      getNotEnoughVariant({ isOnrampable: true, isSwappable: false }),
    ).toBe(NotEnoughVariant.BUY_OR_TRANSFER);
  });

  it("offers swap alone", () => {
    expect(
      getNotEnoughVariant({ isOnrampable: false, isSwappable: true }),
    ).toBe(NotEnoughVariant.SWAP_OR_TRANSFER);
  });

  it("falls back to transfer, which always works", () => {
    // Not in the designs but reachable: an empty account on a non-onrampable
    // asset. A sheet with no actions would be worse.
    expect(
      getNotEnoughVariant({ isOnrampable: false, isSwappable: false }),
    ).toBe(NotEnoughVariant.TRANSFER_ONLY);
  });
});
