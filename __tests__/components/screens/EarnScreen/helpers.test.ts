import BigNumber from "bignumber.js";
import {
  NotEnoughVariant,
  UNKNOWN_RESOURCE_FEE_FLOOR_XLM,
  formatCompactUsd,
  formatProjection,
  formatRate,
  getEarnCtaState,
  getNotEnoughVariant,
  getDepositDecimals,
  getPercentageDepositAmount,
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

describe("getDepositDecimals", () => {
  it("uses 7 for native XLM and classic assets, whatever the catalog says", () => {
    expect(
      getDepositDecimals({
        token: { type: "native", code: "XLM" },
        total: new BigNumber(1),
      } as never),
    ).toBe(7);
    expect(
      getDepositDecimals({
        token: {
          type: "credit_alphanum4",
          code: "USDC",
          issuer: { key: "GISSUER" },
        },
        total: new BigNumber(1),
      } as never),
    ).toBe(7);
  });

  it("uses a Soroban token's own decimals", () => {
    expect(
      getDepositDecimals({
        contractId: "CTOKEN",
        decimals: 6,
        total: new BigNumber(1),
      } as never),
    ).toBe(6);
  });

  it("refuses to guess without a balance or with unusable decimals", () => {
    expect(getDepositDecimals(undefined)).toBeNull();
    expect(
      getDepositDecimals({
        contractId: "CTOKEN",
        decimals: Number.NaN,
        total: new BigNumber(1),
      } as never),
    ).toBeNull();
    expect(
      getDepositDecimals({
        contractId: "CTOKEN",
        decimals: -1,
        total: new BigNumber(1),
      } as never),
    ).toBeNull();
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
  const classic = (
    code: string,
    issuer: string,
    total: string,
    available?: string,
  ) =>
    ({
      total: new BigNumber(total),
      ...(available === undefined
        ? {}
        : { available: new BigNumber(available) }),
      token: { code, issuer: { key: issuer } },
    }) as never;

  // Real NativeToken always carries `type: "native"` (config/types.ts) — the
  // native() mock includes it so this fixture matches production shape, per
  // the type-based discriminant used by hasSwappableBalance (see helper file
  // for why a code-based check is unsafe). `minimumBalance` is the
  // server-derived reserve; without it the reserve falls back to
  // (2 + subentryCount) × 0.5 = 1 XLM here.
  const native = (total: string, minimumBalance?: string) =>
    ({
      total: new BigNumber(total),
      ...(minimumBalance === undefined
        ? {}
        : { minimumBalance: new BigNumber(minimumBalance) }),
      token: { type: "native", code: "XLM" },
    }) as never;

  const check = (
    balances: Record<string, never>,
    {
      targetIdentifier = "USDC:GISSUER",
      requiresTrustline = false,
    }: { targetIdentifier?: string; requiresTrustline?: boolean } = {},
  ) =>
    hasSwappableBalance({
      balances,
      targetIdentifier,
      subentryCount: 0,
      transactionFee: "0.00001",
      requiresTrustline,
    });

  it("counts native XLM, the most common swap source", () => {
    expect(check({ XLM: native("10") })).toBe(true);
    expect(check({ XLM: native("10") }, { requiresTrustline: true })).toBe(
      true,
    );
  });

  // Every other `true` case in this file goes through the native() fixture,
  // so a held classic asset never actually exercised the `true` branch of
  // the "is this a classic token" check — a regression that inverted the
  // `issuer in balance.token` guard would have passed the whole suite.
  it("counts a held classic asset other than the target as swappable", () => {
    expect(check({ "AQUA:GISSUER2": classic("AQUA", "GISSUER2", "100") })).toBe(
      true,
    );
  });

  it("excludes the target asset itself so dust does not look swappable", () => {
    expect(check({ "USDC:GISSUER": classic("USDC", "GISSUER", "0.001") })).toBe(
      false,
    );
  });

  it("excludes zero balances", () => {
    expect(check({ XLM: native("0") })).toBe(false);
  });

  it("leaves out the XLM the account must keep as its minimum balance", () => {
    expect(check({ XLM: native("1", "1") })).toBe(false);
    expect(check({ XLM: native("1.2", "1") })).toBe(true);
  });

  it("needs XLM headroom for the trustline a new token opens", () => {
    // 0.39999 XLM spendable: enough to swap, not to open a trustline too.
    expect(check({ XLM: native("1.4", "1") })).toBe(true);
    expect(
      check({ XLM: native("1.4", "1") }, { requiresTrustline: true }),
    ).toBe(false);
    expect(
      check({ XLM: native("1.6", "1") }, { requiresTrustline: true }),
    ).toBe(true);
  });

  it("can't swap another token into one that needs a trustline without that XLM", () => {
    const balances = {
      XLM: native("1.2", "1"),
      "AQUA:GISSUER2": classic("AQUA", "GISSUER2", "100"),
    };
    expect(check(balances)).toBe(true);
    expect(check(balances, { requiresTrustline: true })).toBe(false);
  });

  it("counts a classic asset's available amount, not its total", () => {
    expect(
      check({ "AQUA:GISSUER2": classic("AQUA", "GISSUER2", "100", "0") }),
    ).toBe(false);
  });

  it("excludes Soroban-only tokens, which Swap cannot path-payment", () => {
    const soroban = {
      total: new BigNumber("5"),
      contractId: "CABC",
      token: { code: "ABC", issuer: { key: "CABC" } },
    } as never;
    expect(check({ "ABC:CABC": soroban })).toBe(false);
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
    // Reachable once nothing is spendable, e.g. XLM at its minimum balance,
    // on an asset the onramp can't sell. A sheet with no actions would be
    // worse.
    expect(
      getNotEnoughVariant({ isOnrampable: false, isSwappable: false }),
    ).toBe(NotEnoughVariant.TRANSFER_ONLY);
  });
});
