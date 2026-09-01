import { Asset as SdkToken, Keypair } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { TESTNET_NETWORK_DETAILS } from "config/constants";
import { Balance } from "config/types";
import { PriceFreshness, PriceSource } from "helpers/confirmationPriceSnapshot";
import {
  AssetKind,
  buildSourceLegUsdProps,
  canonicalIdFromIdentity,
  classifyAssetIdentity,
  computeExecutionSlippagePct,
  computeUsdSlippagePct,
  deriveLegUsd,
  getFailureCategory,
  LegUsdStatus,
  pickReasonCode,
  roundHalfUp2dp,
} from "helpers/usdVolume";

const { networkPassphrase } = TESTNET_NETWORK_DETAILS;

describe("roundHalfUp2dp", () => {
  it("rounds half up at the 2dp boundary", () => {
    expect(roundHalfUp2dp("1.005")).toBe(1.01);
    expect(roundHalfUp2dp("1.004")).toBe(1.0);
    expect(roundHalfUp2dp(1.115)).toBe(1.12);
  });

  it("never floors like a naive Math.floor-based rounder", () => {
    expect(roundHalfUp2dp("0.009")).toBe(0.01);
  });

  it("handles negative values (slippage can be negative)", () => {
    expect(roundHalfUp2dp("-12.345")).toBe(-12.35);
  });
});

describe("deriveLegUsd", () => {
  it("is no_price when no price is held for the asset", () => {
    expect(deriveLegUsd("10", undefined)).toEqual({
      status: LegUsdStatus.NO_PRICE,
    });
    expect(deriveLegUsd("10", null)).toEqual({
      status: LegUsdStatus.NO_PRICE,
    });
  });

  it("is ok and rounds half-up when a price is held", () => {
    const result = deriveLegUsd("10.5", new BigNumber("1.999"));
    if (result.status !== LegUsdStatus.OK) {
      throw new Error(`expected ok, got ${result.status}`);
    }
    expect(result.value).toBe(20.99); // 10.5 * 1.999 = 20.9895 -> half-up -> 20.99
    expect(result.rate).toBe(1.999);
    expect(result.unrounded.toString()).toBe("20.9895");
  });

  it("never emits 0 for a missing price — that's no_price, not a real zero", () => {
    const result = deriveLegUsd("0", undefined);
    expect(result.status).toBe(LegUsdStatus.NO_PRICE);
    expect("value" in result).toBe(false);
  });

  it("emits a real 0.00 for a genuine zero-value transfer when priced", () => {
    const result = deriveLegUsd("0", new BigNumber("1.5"));
    if (result.status !== LegUsdStatus.OK) {
      throw new Error(`expected ok, got ${result.status}`);
    }
    expect(result.value).toBe(0);
  });

  it("is error when the derivation produces a non-finite result", () => {
    expect(deriveLegUsd("not-a-number", new BigNumber("1.5")).status).toBe(
      LegUsdStatus.ERROR,
    );
  });
});

describe("buildSourceLegUsdProps", () => {
  it("carries only the status when unpriced", () => {
    expect(
      buildSourceLegUsdProps(
        { status: LegUsdStatus.NO_PRICE },
        PriceSource.TOKEN_PRICES_V2,
        PriceFreshness.CONFIRMATION_FETCH,
      ),
    ).toEqual({ amount_usd_status: "no_price" });
  });

  it("carries the full amount_usd family when ok", () => {
    const leg = deriveLegUsd("10", new BigNumber("2"));
    expect(
      buildSourceLegUsdProps(
        leg,
        PriceSource.TOKEN_PRICES_V2,
        PriceFreshness.CACHED_DISPLAY,
      ),
    ).toEqual({
      amount_usd_status: "ok",
      amount_usd: 20,
      amount_usd_rate: 2,
      amount_usd_source: "token_prices_v2",
      amount_usd_price_freshness: "cached_display",
    });
  });
});

describe("computeUsdSlippagePct", () => {
  it("is negative when the user received less USD value than they gave up", () => {
    const pct = computeUsdSlippagePct(
      new BigNumber("100"),
      new BigNumber("99"),
    );
    expect(pct).toBe(-1);
  });

  it("rounds only the final percentage, from unrounded inputs", () => {
    const pct = computeUsdSlippagePct(
      new BigNumber("33.333"),
      new BigNumber("33.1"),
    );
    // (33.1 - 33.333) / 33.333 * 100 = -0.699009...
    expect(pct).toBe(-0.7);
  });

  it("is undefined when the source value is zero (no ratio)", () => {
    expect(
      computeUsdSlippagePct(new BigNumber(0), new BigNumber("5")),
    ).toBeUndefined();
  });
});

describe("computeExecutionSlippagePct", () => {
  it("computes settled vs quoted as a percentage", () => {
    expect(computeExecutionSlippagePct("100", "99.5")).toBe(-0.5);
  });

  it("is undefined when no quote amount was captured", () => {
    expect(computeExecutionSlippagePct(undefined, "99.5")).toBeUndefined();
  });

  it("is undefined when the quoted amount is zero", () => {
    expect(computeExecutionSlippagePct("0", "99.5")).toBeUndefined();
  });
});

describe("classifyAssetIdentity", () => {
  it("classifies native XLM with no issuer", () => {
    expect(
      classifyAssetIdentity("XLM", undefined, TESTNET_NETWORK_DETAILS),
    ).toEqual({ code: "XLM", type: "native" });
  });

  it("classifies a plain classic asset (G-issuer)", () => {
    const issuer = Keypair.random().publicKey();
    expect(
      classifyAssetIdentity("USDC", issuer, TESTNET_NETWORK_DETAILS),
    ).toEqual({ code: "USDC", issuer, type: "classic" });
  });

  it("collapses XLM moved via the native SAC to native, not soroban", () => {
    const nativeSac = SdkToken.native().contractId(networkPassphrase);
    expect(
      classifyAssetIdentity("XLM", nativeSac, TESTNET_NETWORK_DETAILS),
    ).toEqual({ code: "XLM", type: "native" });
  });

  const classicBalance = (code: string, issuer: string): Balance =>
    ({
      token: { code, issuer: { key: issuer } },
      total: new BigNumber(0),
      available: new BigNumber(0),
    }) as unknown as Balance;

  it("collapses a classic asset moved via its SAC back to classic, by derivation against a held balance", () => {
    const issuer = Keypair.random().publicKey();
    const sacAddress = new SdkToken("USDC", issuer).contractId(
      networkPassphrase,
    );
    const balances = [classicBalance("USDC", issuer)];

    expect(
      classifyAssetIdentity(
        "USDC",
        sacAddress,
        TESTNET_NETWORK_DETAILS,
        balances,
      ),
    ).toEqual({ code: "USDC", issuer, type: "classic" });
  });

  it("reports a contract with no matching classic balance as Soroban-native", () => {
    const unrelatedIssuer = Keypair.random().publicKey();
    const sacAddress = new SdkToken("SHRIMP", unrelatedIssuer).contractId(
      networkPassphrase,
    );

    expect(
      classifyAssetIdentity("SHRIMP", sacAddress, TESTNET_NETWORK_DETAILS, []),
    ).toEqual({ code: "SHRIMP", issuer: sacAddress, type: "soroban" });
  });

  it("does not collapse a genuine Soroban/SEP-41 balance whose token also carries an issuer", () => {
    // A SEP-41 balance's token.issuer.key IS the contract id (see
    // mapSep41 in mapAccountBalancesV2.ts) — it directly contractId-matches
    // via getBalanceByKey's fallback, but must not be misread as classic
    // just because its token also has an "issuer" field.
    const contractId = new SdkToken(
      "SHRIMP",
      Keypair.random().publicKey(),
    ).contractId(networkPassphrase);
    const balances = [
      {
        token: { code: "SHRIMP", issuer: { key: contractId } },
        contractId,
        total: new BigNumber(0),
        available: new BigNumber(0),
      } as unknown as Balance,
    ];

    expect(
      classifyAssetIdentity(
        "SHRIMP",
        contractId,
        TESTNET_NETWORK_DETAILS,
        balances,
      ),
    ).toEqual({ code: "SHRIMP", issuer: contractId, type: "soroban" });
  });

  it("does not collapse against a held balance with a different code", () => {
    const heldIssuer = Keypair.random().publicKey();
    const otherIssuer = Keypair.random().publicKey();
    const sacAddress = new SdkToken("EUROC", otherIssuer).contractId(
      networkPassphrase,
    );
    const balances = [classicBalance("USDC", heldIssuer)];

    expect(
      classifyAssetIdentity(
        "EUROC",
        sacAddress,
        TESTNET_NETWORK_DETAILS,
        balances,
      ),
    ).toEqual({ code: "EUROC", issuer: sacAddress, type: "soroban" });
  });
});

describe("canonicalIdFromIdentity", () => {
  it("is the bare code for native", () => {
    expect(
      canonicalIdFromIdentity({ code: "XLM", type: AssetKind.NATIVE }),
    ).toBe("XLM");
  });

  it("is CODE:ISSUER for a classic or soroban asset", () => {
    expect(
      canonicalIdFromIdentity({
        code: "USDC",
        issuer: "GABC",
        type: AssetKind.CLASSIC,
      }),
    ).toBe("USDC:GABC");
  });
});

describe("pickReasonCode", () => {
  it("is unknown when there are no result codes at all", () => {
    expect(pickReasonCode(undefined)).toBe("unknown");
    expect(pickReasonCode(null)).toBe("unknown");
  });

  it("picks the transaction code when there are no operation codes", () => {
    expect(pickReasonCode({ transaction: "tx_bad_seq" })).toBe("tx_bad_seq");
  });

  it("picks the first operation code that isn't a changeTrust no-op marker", () => {
    // A swap prepending a changeTrust operation reports one code per
    // operation — index 0 is the changeTrust's own success, not the actual
    // failure.
    expect(
      pickReasonCode({
        transaction: "tx_failed",
        operations: ["op_success", "op_under_dest_min"],
      }),
    ).toBe("op_under_dest_min");
    expect(
      pickReasonCode({
        transaction: "tx_failed",
        operations: ["op_not_attempted", "op_underfunded"],
      }),
    ).toBe("op_underfunded");
  });

  it("falls back to the transaction code when every operation code is a no-op marker", () => {
    expect(
      pickReasonCode({
        transaction: "tx_failed",
        operations: ["op_success", "op_not_attempted"],
      }),
    ).toBe("tx_failed");
  });
});

describe("getFailureCategory", () => {
  it("maps slippage-related op codes (also covers quote-expired-at-submit)", () => {
    expect(getFailureCategory(true, 400, "op_under_dest_min")).toBe("slippage");
    expect(getFailureCategory(true, 400, "op_too_few_offers")).toBe("slippage");
  });

  it("maps balance, trustline, destination, sequence, auth, and fee codes", () => {
    expect(getFailureCategory(true, 400, "op_underfunded")).toBe("balance");
    expect(getFailureCategory(true, 400, "op_no_trust")).toBe("trustline");
    expect(getFailureCategory(true, 400, "op_src_no_trust")).toBe("trustline");
    expect(getFailureCategory(true, 400, "op_src_not_authorized")).toBe(
      "trustline",
    );
    expect(getFailureCategory(true, 400, "op_no_destination")).toBe(
      "destination",
    );
    expect(getFailureCategory(true, 400, "tx_bad_seq")).toBe("sequence");
    expect(getFailureCategory(true, 400, "tx_bad_auth")).toBe("auth");
    expect(getFailureCategory(true, 400, "tx_insufficient_fee")).toBe("fee");
  });

  it("maps an unmapped Horizon code to protocol_other", () => {
    expect(getFailureCategory(true, 400, "tx_failed")).toBe("protocol_other");
  });

  it("maps the 'unknown' sentinel to unknown when Horizon did answer with a verdict", () => {
    expect(getFailureCategory(true, 400, "unknown")).toBe("unknown");
  });

  it("maps to transport when there was no protocol answer at all", () => {
    expect(getFailureCategory(false, null, "unknown")).toBe("transport");
    expect(getFailureCategory(false, 500, "unknown")).toBe("transport");
  });

  it("maps an answer that carries no verdict — 5xx/408/429/403 without result codes — to transport, not unknown", () => {
    expect(getFailureCategory(true, 503, "unknown")).toBe("transport");
    expect(getFailureCategory(true, 504, "unknown")).toBe("transport");
    expect(getFailureCategory(true, 408, "unknown")).toBe("transport");
    expect(getFailureCategory(true, 429, "unknown")).toBe("transport");
    expect(getFailureCategory(true, 403, "unknown")).toBe("transport");
    // A definitive 4xx rejection without result codes stays unknown.
    expect(getFailureCategory(true, 400, "unknown")).toBe("unknown");
  });
});
