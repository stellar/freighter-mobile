import {
  BlendCatalogPool,
  BlendCatalogReserve,
  BlendPoolPosition,
  BlendSupplyPosition,
} from "config/blendTypes";

/** Mainnet's Fixed v2.1 pool: the one Earn offers on PUBLIC. */
export const POOL_ID =
  "CBAKAZUEJBAFA2DCGBRS2WKJT3FNIMJBHTFL76AY7XMAVEINQNNIQWAO";
export const OTHER_POOL_ID =
  "CDVQVKOY2YSXS2IC7KN6MNASSHPAO7UN2UR2ON4OI2SKMFJNVAMDX6DP";
export const USDC_ISSUER =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
/** Mainnet USDC's Stellar Asset Contract. */
export const USDC_SAC =
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
/** Mainnet's native XLM contract. */
export const NATIVE_SAC =
  "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
/** A Soroban-only token: no classic asset behind it. */
export const FOO_CONTRACT =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

/** 500.1223 USDC supplied, 0.1234 of it interest. */
export const supplyRow = (
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

export const poolPosition = (
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

export const catalogReserve = (
  overrides: Partial<BlendCatalogReserve> = {},
): BlendCatalogReserve => ({
  assetId: USDC_SAC,
  symbol: "USDC",
  name: `USDC:${USDC_ISSUER}`,
  decimals: 7,
  enabled: true,
  utilization: 0.8,
  supplyApy: 0.1694,
  borrowApy: 0.2,
  emissionsSupplyApr: 0.02,
  suppliedUsd: 1000000,
  borrowedUsd: 800000,
  priceUsd: 1,
  ...overrides,
});

export const catalogPool = (
  overrides: Partial<BlendCatalogPool> = {},
): BlendCatalogPool => ({
  id: POOL_ID,
  name: "Fixed v2.1",
  status: "ACTIVE",
  suppliedUsd: 1000000,
  borrowedUsd: 800000,
  interestApy: 0.1,
  netApy: 0.1,
  backstopUsd: 50000,
  reserves: [catalogReserve()],
  ...overrides,
});
