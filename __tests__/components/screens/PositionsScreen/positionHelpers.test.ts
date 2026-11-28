import {
  formatGainBadge,
  formatPositionGain,
  formatPositionTokens,
  getGainTone,
} from "components/screens/PositionsScreen/helpers/positionFigures";
import {
  getSupplyRowIdentity,
  toDisplayTokens,
  toPositionTokenRows,
} from "components/screens/PositionsScreen/helpers/positionRows";
import {
  getGainPercent,
  getPoolPositionSummary,
  getPositionSummary,
} from "components/screens/PositionsScreen/helpers/positionSummaries";
import { BlendPoolPosition, BlendSupplyPosition } from "config/blendTypes";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";

const networkDetails = mapNetworkToNetworkDetails(NETWORKS.PUBLIC);
const POOL_ID = "CBAKAZUEJBAFA2DCGBRS2WKJT3FNIMJBHTFL76AY7XMAVEINQNNIQWAO";
const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const USDC_SAC = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const NATIVE_SAC = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
// A Soroban-only token: no classic asset behind it.
const FOO_CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const supplyRow = (
  overrides: Partial<BlendSupplyPosition> = {},
): BlendSupplyPosition => ({
  assetId: USDC_SAC,
  symbol: "USDC",
  name: `USDC:${USDC_ISSUER}`,
  decimals: 7,
  totalTokens: "5001223000",
  usdValue: 500.12,
  apy: 0.1694,
  emissionsApr: 0.02,
  interestEarned: "1234000",
  interestEarnedUsd: 0.12,
  priceUsd: 1,
  ...overrides,
});

const poolPosition = (
  overrides: Partial<BlendPoolPosition> = {},
): BlendPoolPosition => ({
  protocol: "blend",
  poolId: POOL_ID,
  name: "Fixed v2.1",
  netUsd: 800.12,
  suppliedUsd: 800.12,
  netApy: 0.1132,
  supply: [supplyRow()],
  ...overrides,
});

describe("getSupplyRowIdentity", () => {
  it("names native XLM, which the backend reports with no symbol or name", () => {
    expect(
      getSupplyRowIdentity(
        supplyRow({
          assetId: NATIVE_SAC,
          symbol: null,
          name: null,
          decimals: null,
        }),
        networkDetails,
      ),
    ).toEqual({ code: "XLM", issuer: undefined, decimals: 7, isNative: true });
  });

  it("takes a classic token's issuer from its canonical name", () => {
    expect(getSupplyRowIdentity(supplyRow(), networkDetails)).toEqual({
      code: "USDC",
      issuer: USDC_ISSUER,
      decimals: 7,
      isNative: false,
    });
  });

  it("scales a SAC with no reported decimals by 7, as every SAC is", () => {
    expect(
      getSupplyRowIdentity(supplyRow({ decimals: null }), networkDetails)
        .decimals,
    ).toBe(7);
  });

  it("gives a Soroban-only token its own contract as issuer", () => {
    const identity = getSupplyRowIdentity(
      supplyRow({
        assetId: FOO_CONTRACT,
        symbol: "FOO",
        name: "Foo Token",
        decimals: 18,
      }),
      networkDetails,
    );
    expect(identity.code).toBe("FOO");
    expect(identity.issuer).toBe(FOO_CONTRACT);
    expect(identity.decimals).toBe(18);
  });

  it("leaves a Soroban-only token's scale unknown when the backend omits it", () => {
    expect(
      getSupplyRowIdentity(
        supplyRow({
          assetId: FOO_CONTRACT,
          symbol: "FOO",
          name: "Foo Token",
          decimals: null,
        }),
        networkDetails,
      ).decimals,
    ).toBeNull();
  });

  it("reads an unnamed token as its contract's first characters", () => {
    expect(
      getSupplyRowIdentity(
        supplyRow({ assetId: FOO_CONTRACT, symbol: null, name: null }),
        networkDetails,
      ).code,
    ).toBe("CDLZ…");
  });
});

describe("toDisplayTokens", () => {
  it("scales a raw amount by the token's decimals", () => {
    expect(toDisplayTokens("5001223000", 7)).toBe("500.1223");
  });

  it("is unknown when the decimals are", () => {
    expect(toDisplayTokens("5001223000", null)).toBeNull();
  });
});

describe("toPositionTokenRows", () => {
  it("lists each supplied token with its amount, value and supply rate", () => {
    const [row] = toPositionTokenRows({
      position: poolPosition(),
      networkDetails,
    });
    expect(row).toMatchObject({
      poolId: POOL_ID,
      assetId: USDC_SAC,
      code: "USDC",
      issuer: USDC_ISSUER,
      suppliedTokens: "500.1223",
      suppliedUsd: 500.12,
      // Interest only: emissions are left out, as everywhere in Earn.
      apy: 0.1694,
    });
  });

  it("lists nothing for a pool whose detail is unknown", () => {
    expect(
      toPositionTokenRows({
        position: poolPosition({ supply: null }),
        networkDetails,
      }),
    ).toEqual([]);
  });
});

describe("getGainPercent", () => {
  it("measures interest against principal, not the current total", () => {
    // Put in 1,252.57 and now holds 1,284.32: 2.53% of what was committed.
    expect(getGainPercent(1284.32, 31.75)).toBeCloseTo(31.75 / 1252.57, 10);
  });

  it("is unknown when either figure is", () => {
    expect(getGainPercent(null, 1)).toBeNull();
    expect(getGainPercent(1, null)).toBeNull();
  });

  it("is unknown, not infinite, when nothing but interest is left", () => {
    expect(getGainPercent(1, 1)).toBeNull();
  });
});

describe("getPoolPositionSummary", () => {
  it("totals the pool's interest across its tokens", () => {
    const summary = getPoolPositionSummary(
      poolPosition({
        suppliedUsd: 800.12,
        supply: [
          supplyRow({ interestEarnedUsd: 20 }),
          supplyRow({ assetId: NATIVE_SAC, interestEarnedUsd: 11.75 }),
        ],
      }),
    );
    expect(summary.totalUsd).toBe(800.12);
    expect(summary.interestUsd).toBeCloseTo(31.75, 10);
    expect(summary.gainPercent).toBeCloseTo(31.75 / 768.37, 10);
    expect(summary.apy).toBe(0.1132);
  });

  it("makes the interest unknown when any token's is", () => {
    expect(
      getPoolPositionSummary(
        poolPosition({
          supply: [
            supplyRow({ interestEarnedUsd: 20 }),
            supplyRow({ interestEarnedUsd: null }),
          ],
        }),
      ).interestUsd,
    ).toBeNull();
  });

  it("keeps the interest unknown for a pool with no detail, and zero for one with none", () => {
    expect(
      getPoolPositionSummary(poolPosition({ supply: null })).interestUsd,
    ).toBeNull();
    expect(
      getPoolPositionSummary(poolPosition({ supply: [] })).interestUsd,
    ).toBe(0);
  });

  it("totals the supplied side, falling back to the net figure", () => {
    expect(
      getPoolPositionSummary(poolPosition({ suppliedUsd: 1000, netUsd: 600 }))
        .totalUsd,
    ).toBe(1000);
    expect(
      getPoolPositionSummary(poolPosition({ suppliedUsd: null, netUsd: 600 }))
        .totalUsd,
    ).toBe(600);
  });
});

describe("getPositionSummary", () => {
  const summaryFor = (row: BlendSupplyPosition) =>
    getPositionSummary({
      position: poolPosition({ supply: [row] }),
      focusedAssetId: row.assetId,
      networkDetails,
    });

  it("reports deposits as principal: the balance less its interest", () => {
    const { deposits, earnings } = summaryFor(supplyRow());
    // 500.1223 USDC held, 0.1234 of it interest.
    expect(deposits).toMatchObject({ tokens: "499.9989", usd: 500 });
    expect(earnings).toMatchObject({ tokens: "0.1234", usd: 0.12 });
  });

  it("projects earnings on the whole balance, interest included", () => {
    const { estYearlyUsd, estMonthlyUsd } = summaryFor(supplyRow());
    // 500.12 × 16.94%.
    expect(estYearlyUsd).toBe("84.72");
    expect(estMonthlyUsd).toBe("7.06");
  });

  it("reads no principal when the lifetime interest exceeds the balance", () => {
    const { deposits } = summaryFor(
      supplyRow({ interestEarned: "6000000000", interestEarnedUsd: 600 }),
    );
    expect(deposits).toMatchObject({ tokens: "0", usd: null });
  });

  it("keeps the deposit's value unknown when the interest's is", () => {
    expect(
      summaryFor(supplyRow({ interestEarnedUsd: null })).deposits?.usd,
    ).toBeNull();
  });

  it("has nothing to show for a token the pool doesn't hold", () => {
    const summary = getPositionSummary({
      position: poolPosition(),
      focusedAssetId: NATIVE_SAC,
      networkDetails,
    });
    expect(summary.deposits).toBeNull();
    expect(summary.currentBalanceUsd).toBeNull();
    expect(summary.estYearlyUsd).toBeNull();
  });
});

describe("position figures", () => {
  it("writes a gain with its share of principal", () => {
    expect(formatPositionGain(31.75, 0.0254)).toBe("+$31.75 (2.54%)");
  });

  it("writes a loss with a minus", () => {
    expect(formatPositionGain(-1, -0.01)).toBe("-$1.00 (1.00%)");
  });

  it("keeps the amount alone when the share is unknown", () => {
    expect(formatPositionGain(31.75, null)).toBe("+$31.75");
  });

  it("has no gain to write when the interest is unknown", () => {
    expect(formatPositionGain(null, 0.02)).toBeNull();
  });

  it("writes a zero gain as a gain", () => {
    expect(formatPositionGain(0, 0)).toBe("+$0.00 (0.00%)");
    expect(getGainTone(0)).toBe("gain");
  });

  it("greys a loss and an unknown figure", () => {
    expect(getGainTone(-0.5)).toBe("loss");
    expect(getGainTone(null)).toBe("unknown");
    expect(getGainTone(0.1)).toBe("gain");
  });

  it("writes the card's badge", () => {
    expect(formatGainBadge(0.0254)).toBe("+2.54%");
    expect(formatGainBadge(-0.01)).toBe("-1.00%");
    expect(formatGainBadge(null)).toBeNull();
  });

  it("writes a token amount with its code, or -- when unknown", () => {
    expect(formatPositionTokens("500.1223", "USDC")).toBe("500.1223 USDC");
    expect(formatPositionTokens(null, "FOO")).toBe("--");
  });
});
