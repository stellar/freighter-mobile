import BigNumber from "bignumber.js";
import {
  NotEnoughVariant,
  UNKNOWN_RESOURCE_FEE_FLOOR_XLM,
  formatCompactUsd,
  formatProjection,
  formatRate,
  getEarnCtaState,
  getNotEnoughVariant,
  getPercentageDepositAmount,
  getPoolDescriptionKey,
  getXlmFeeShortfall,
  hasSwappableBalance,
  isInsufficientBalanceFailure,
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

describe("getXlmFeeShortfall", () => {
  it("is zero when the deposit leaves more than the resource fee", () => {
    expect(
      getXlmFeeShortfall({
        spendableXlm: "100",
        amount: "50",
        resourceFee: "0.0546395",
      }),
    ).toBe("0");
  });

  it("reports the shortfall when the whole spendable balance is deposited", () => {
    // The full balance is depositable — nothing is held back — so the entire
    // resource fee is missing.
    expect(
      getXlmFeeShortfall({
        spendableXlm: "100",
        amount: "100",
        resourceFee: "0.0546395",
      }),
    ).toBe("0.0546395");
  });

  it("reports only the part of the fee that is not covered", () => {
    expect(
      getXlmFeeShortfall({
        spendableXlm: "100",
        amount: "99.99",
        resourceFee: "0.0546395",
      }),
    ).toBe("0.0446395");
  });

  it("is zero when the remainder exactly covers the fee", () => {
    expect(
      getXlmFeeShortfall({
        spendableXlm: "100",
        amount: "99.9453605",
        resourceFee: "0.0546395",
      }),
    ).toBe("0");
  });

  it("does not lose precision on a large balance", () => {
    expect(
      getXlmFeeShortfall({
        spendableXlm: "1691.6912345",
        amount: "1691.6912345",
        resourceFee: "0.0546395",
      }),
    ).toBe("0.0546395");
  });
});

describe("UNKNOWN_RESOURCE_FEE_FLOOR_XLM", () => {
  it("sits comfortably above the measured Blend submit resource fee", () => {
    // Measured at ~546,395 stroops (0.0546 XLM) against the live mainnet
    // pool. The floor must exceed that to actually catch an unreported fee.
    expect(Number(UNKNOWN_RESOURCE_FEE_FLOOR_XLM)).toBeGreaterThan(0.0546);
  });
});

describe("isInsufficientBalanceFailure", () => {
  it("matches the asset contract's BalanceError", () => {
    expect(
      isInsufficientBalanceFailure(
        "host invocation failed: HostError: Error(Contract, #10)",
      ),
    ).toBe(true);
  });

  it("matches a classic insufficient-balance result code", () => {
    expect(isInsufficientBalanceFailure("tx_insufficient_balance")).toBe(true);
    expect(isInsufficientBalanceFailure("txINSUFFICIENT_BALANCE")).toBe(true);
  });

  it("leaves the pool's own rejections alone", () => {
    // Supply cap, frozen pool, stale oracle — these must keep surfacing their
    // own message rather than being retold as a fee problem.
    expect(
      isInsufficientBalanceFailure("HostError: Error(Contract, #1206)"),
    ).toBe(false);
    expect(isInsufficientBalanceFailure("pool is frozen")).toBe(false);
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

  // Every other `true` case in this file goes through the native() fixture,
  // so a held classic asset never actually exercised the `true` branch of
  // the "is this a classic token" check — a regression that inverted the
  // `issuer in balance.token` guard would have passed the whole suite.
  it("counts a held classic asset other than the target as swappable", () => {
    expect(
      hasSwappableBalance(
        { "AQUA:GISSUER2": classic("AQUA", "GISSUER2", "100") },
        "USDC:GISSUER",
      ),
    ).toBe(true);
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
