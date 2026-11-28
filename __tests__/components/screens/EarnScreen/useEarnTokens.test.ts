import BigNumber from "bignumber.js";
import { buildEarnTokenRows } from "components/screens/EarnScreen/hooks/useEarnTokens";
import { BLEND_FIXED_POOL_IDS } from "config/blend";
import { NETWORKS } from "config/constants";

const POOL_ID = BLEND_FIXED_POOL_IDS[NETWORKS.PUBLIC]!;
const USDC_SAC = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";

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

  const offer = (overrides = {}) => ({
    id: POOL_ID,
    name: "Fixed",
    supplyApy: 0.05,
    emissionsSupplyApr: null,
    suppliedUsd: 0,
    ...overrides,
  });

  const rateOf = (pool: object) =>
    buildEarnTokenRows({
      options: [option({ pools: [pool] })],
      poolId: POOL_ID,
      balances: {} as never,
      networkDetails,
      findBalance: () => undefined,
    }).supported[0].apy;

  it("rates a token on supply interest alone, leaving emissions out", () => {
    expect(rateOf(offer({ emissionsSupplyApr: 0.02 }))).toBe(0.05);
  });

  it("keeps the rate unknown when the supply rate is unavailable", () => {
    // No fresh oracle price means the rate is unknown, not zero.
    expect(
      rateOf(offer({ supplyApy: null, emissionsSupplyApr: 0.02 })),
    ).toBeNull();
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
    // The held row must carry the real balance through — `EarnTokenRow`
    // relies on it to render the exact icon rather than reconstructing one
    // from catalog data alone.
    expect(held[0].balance).toBe(balances["USDC:GISSUER"]);
    expect(supported).toHaveLength(0);
  });

  it("shows a SEP-41 balance in whole tokens, not its raw integer", () => {
    // A SEP-41 balance carries `decimals` and keeps its total in the token's
    // smallest unit; 100000000 with 7 decimals is 10 tokens.
    const balance = {
      total: new BigNumber("100000000"),
      decimals: 7,
      contractId: USDC_SAC,
      token: { code: "USDC", issuer: { key: USDC_SAC } },
    } as never;

    const { held } = buildEarnTokenRows({
      options: [option()],
      poolId: POOL_ID,
      balances: {} as never,
      networkDetails,
      findBalance: () => balance,
    });

    expect(held[0].total).toBe("10");
  });

  it("leaves `balance` undefined for a zero-balance (supported) row", () => {
    const { supported } = buildEarnTokenRows({
      options: [option()],
      poolId: POOL_ID,
      balances: {} as never,
      networkDetails,
      findBalance: () => undefined,
    });

    expect(supported[0].balance).toBeUndefined();
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

  it("reads the code from the catalog's CODE:ISSUER name before truncating the id", () => {
    const { supported } = buildEarnTokenRows({
      options: [
        option({
          symbol: null,
          name: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        }),
      ],
      poolId: POOL_ID,
      balances: {} as never,
      networkDetails,
      findBalance: () => undefined,
    });

    expect(supported[0].code).toBe("USDC");
  });

  it("falls back to the held balance's own code when the catalog symbol is missing", () => {
    // The middle rung of the fallback chain: `option.symbol` absent but a
    // held balance exists, so its `token.code` should be used in preference
    // to the truncated-id last resort. Only the truncated-id branch (no
    // symbol AND no balance) was previously covered.
    const balance = {
      total: new BigNumber("50"),
      token: { code: "USDC", issuer: { key: "GISSUER" } },
    } as never;

    const { held } = buildEarnTokenRows({
      options: [option({ symbol: null, name: null })],
      poolId: POOL_ID,
      balances: {} as never,
      networkDetails,
      findBalance: () => balance,
    });

    expect(held[0].code).toBe("USDC");
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

  // XLM's total includes the minimum balance, which can't be deposited.
  describe("an XLM balance", () => {
    const TESTNET_NATIVE_SAC =
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
    const rowsFor = (total: string) => {
      const balance = {
        token: { type: "native", code: "XLM" },
        total: new BigNumber(total),
        available: new BigNumber(total).minus("1.5"),
        minimumBalance: new BigNumber("1.5"),
      } as never;
      return buildEarnTokenRows({
        options: [
          option({ assetId: TESTNET_NATIVE_SAC, symbol: null, name: null }),
        ],
        poolId: POOL_ID,
        balances: {} as never,
        networkDetails: { network: NETWORKS.TESTNET } as never,
        subentryCount: 1,
        transactionFee: "0.00001",
        findBalance: () => balance,
      });
    };

    it("lists XLM held only as its minimum balance as not held", () => {
      const { held, supported } = rowsFor("1.5");

      expect(held).toHaveLength(0);
      expect(supported).toHaveLength(1);
      // Still carried, so the row's icon and amount come from it.
      expect(supported[0].balance).toBeDefined();
    });

    it("lists XLM above its minimum balance as held", () => {
      const { held, supported } = rowsFor("10");

      expect(held).toHaveLength(1);
      expect(supported).toHaveLength(0);
    });
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
