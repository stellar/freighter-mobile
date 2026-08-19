import BigNumber from "bignumber.js";
import {
  buildEarnTokenRows,
  headlineApy,
} from "components/screens/EarnScreen/hooks/useEarnTokens";
import { NETWORKS } from "config/constants";

const POOL_ID = "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD";
const USDC_SAC = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";

describe("headlineApy", () => {
  it("adds emissions to the supply rate", () => {
    expect(headlineApy(0.05, 0.02)).toBeCloseTo(0.07);
  });

  it("is unknown when the supply rate is unavailable", () => {
    // No fresh oracle price means the whole rate is unknown.
    expect(headlineApy(null, 0.02)).toBeNull();
  });

  it("treats unpriceable emissions as zero rather than blanking a known rate", () => {
    expect(headlineApy(0.05, null)).toBeCloseTo(0.05);
  });
});

describe("buildEarnTokenRows", () => {
  const networkDetails = { network: NETWORKS.PUBLIC } as never;

  const option = (overrides = {}) => ({
    assetId: USDC_SAC,
    symbol: "USDC",
    name: null,
    decimals: 7,
    pools: [
      {
        id: POOL_ID,
        name: "Fixed",
        supplyApy: 0.05,
        emissionsSupplyApr: null,
        suppliedUsd: 0,
      },
    ],
    ...overrides,
  });

  it("puts a held asset in held and a zero-balance asset in supported", () => {
    const balances = {
      "USDC:GISSUER": {
        total: new BigNumber("50"),
        token: { code: "USDC", issuer: { key: "GISSUER" } },
      },
    } as never;

    const { held, supported } = buildEarnTokenRows({
      options: [option()],
      poolId: POOL_ID,
      balances,
      networkDetails,
      findBalance: () => balances["USDC:GISSUER"],
    });

    expect(held).toHaveLength(1);
    expect(held[0].total).toBe("50");
    expect(supported).toHaveLength(0);
  });

  it("skips assets the allowlisted pool does not offer", () => {
    const { held, supported } = buildEarnTokenRows({
      options: [option({ pools: [] })],
      poolId: POOL_ID,
      balances: {} as never,
      networkDetails,
      findBalance: () => undefined,
    });

    expect(held).toHaveLength(0);
    expect(supported).toHaveLength(0);
  });

  it("falls back through symbol, then balance code, then a truncated id", () => {
    // The live catalog returns symbol AND name null for native XLM, so symbol
    // cannot be the only source of the display code.
    const { supported } = buildEarnTokenRows({
      options: [option({ symbol: null, name: null })],
      poolId: POOL_ID,
      balances: {} as never,
      networkDetails,
      findBalance: () => undefined,
    });

    expect(supported[0].code).toBe(`${USDC_SAC.slice(0, 4)}…`);
  });

  it("defaults decimals when the catalog omits them", () => {
    const { supported } = buildEarnTokenRows({
      options: [option({ decimals: null })],
      poolId: POOL_ID,
      balances: {} as never,
      networkDetails,
      findBalance: () => undefined,
    });

    expect(supported[0].decimals).toBe(7);
  });

  it("flags the reserve whose contract address is the network's native SAC", () => {
    // getBalanceByContractId's native trap applies here too: native must be
    // recognised by contract-address comparison, never by `code === "XLM"`.
    // Live TESTNET catalog data confirms native XLM's assetId equals the
    // derived native SAC (verified separately against getNativeContractDetails).
    const nativeAssetId =
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

    const { supported } = buildEarnTokenRows({
      options: [
        option({
          assetId: nativeAssetId,
          symbol: null,
          name: null,
        }),
      ],
      poolId: POOL_ID,
      balances: {} as never,
      networkDetails: { network: NETWORKS.TESTNET } as never,
      findBalance: () => undefined,
    });

    expect(supported[0].isNative).toBe(true);
  });

  it("does not flag a non-native reserve as native", () => {
    const { supported } = buildEarnTokenRows({
      options: [option()],
      poolId: POOL_ID,
      balances: {} as never,
      networkDetails,
      findBalance: () => undefined,
    });

    expect(supported[0].isNative).toBe(false);
  });
});
