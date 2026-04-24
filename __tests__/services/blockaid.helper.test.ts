import BigNumber from "bignumber.js";
import {
  getTransactionBalanceChanges,
  isUnfundedDestinationError,
} from "services/blockaid/helper";

const CONTRACT_ADDRESS =
  "CAZXRTOKNUQ2JQQF3NCRU7GYMDJNZ2NMQN6IGN4FCT5DWPODMPVEXSND";
const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

const makeScanResult = (diffs: unknown[]) =>
  ({
    simulation: {
      account_summary: {
        account_assets_diffs: diffs,
      },
    },
  }) as any;

describe("getTransactionBalanceChanges", () => {
  it.each([
    ["scanResult is undefined", undefined],
    ["simulation is missing", {} as any],
    [
      "simulation has an error",
      { simulation: { error: "simulation failed" } } as any,
    ],
  ])("returns null when %s", (_description, input) => {
    expect(getTransactionBalanceChanges(input)).toBeNull();
  });

  it.each([
    ["account_assets_diffs is absent", { simulation: {} } as any],
    ["account_assets_diffs is empty", makeScanResult([])],
  ])("returns [] when %s", (_description, input) => {
    expect(getTransactionBalanceChanges(input)).toEqual([]);
  });

  it("correctly maps all valid asset types", () => {
    const result = getTransactionBalanceChanges(
      makeScanResult([
        // NATIVE credit — no decimals field → DEFAULT_DECIMALS (7); 10290000 / 1e7 = 1.029
        {
          asset: { type: "NATIVE", code: "XLM" },
          in: { raw_value: 10290000 },
          out: null,
        },
        // NATIVE debit — 100 / 1e7 = 0.00001
        {
          asset: { type: "NATIVE", code: "XLM" },
          in: null,
          out: { raw_value: 100 },
        },
        // classic ASSET — no decimals field → DEFAULT_DECIMALS (7); 5000000 / 1e7 = 0.5
        {
          asset: { type: "ASSET", code: "USDC", issuer: USDC_ISSUER },
          in: { raw_value: 5000000 },
          out: null,
        },
        // SEP41 — uses asset.decimals (5); symbol preferred over code; 102900 / 1e5 = 1.029
        {
          asset: {
            type: "SEP41",
            symbol: "PBT",
            code: "IGNORED",
            address: CONTRACT_ADDRESS,
            decimals: 5,
          },
          in: { raw_value: 102900 },
          out: null,
        },
        // SEP41 — decimals=0 edge case; 42 / 1e0 = 42
        {
          asset: {
            type: "SEP41",
            symbol: "TKN",
            address: CONTRACT_ADDRESS,
            decimals: 0,
          },
          in: { raw_value: 42 },
          out: null,
        },
      ]),
    );

    expect(result).toHaveLength(5);

    expect(result![0]).toMatchObject({
      assetCode: "XLM",
      assetIssuer: undefined,
      isNative: true,
      isCredit: true,
    });
    expect(result![0].amount).toEqual(new BigNumber("1.029"));

    expect(result![1]).toMatchObject({
      assetCode: "XLM",
      isNative: true,
      isCredit: false,
    });
    expect(result![1].amount).toEqual(new BigNumber("0.00001"));

    expect(result![2]).toMatchObject({
      assetCode: "USDC",
      assetIssuer: USDC_ISSUER,
      isNative: false,
      isCredit: true,
    });
    expect(result![2].amount).toEqual(new BigNumber("0.5"));

    expect(result![3]).toMatchObject({
      assetCode: "PBT",
      assetIssuer: CONTRACT_ADDRESS,
      isNative: false,
      isCredit: true,
    });
    expect(result![3].amount).toEqual(new BigNumber("1.029"));

    expect(result![4]).toMatchObject({ assetCode: "TKN" });
    expect(result![4].amount).toEqual(new BigNumber("42"));
  });

  it("skips invalid entries and returns only valid ones", () => {
    const result = getTransactionBalanceChanges(
      makeScanResult([
        // no in/out
        { asset: { type: "NATIVE", code: "XLM" }, in: null, out: null },
        // non-string code (42) and null symbol
        {
          asset: { type: "ASSET", symbol: 42, code: null, issuer: "GABCDE" },
          in: { raw_value: 1000000 },
          out: null,
        },
        // missing code/symbol entirely
        {
          asset: { type: "ASSET", issuer: "GABCDE" },
          in: { raw_value: 1000000 },
          out: null,
        },
        // missing issuer/address for non-native
        {
          asset: { type: "ASSET", code: "USDC" },
          in: { raw_value: 1000000 },
          out: null,
        },
        // non-string issuer/address (99 and null)
        {
          asset: { type: "ASSET", code: "USDC", issuer: 99, address: null },
          in: { raw_value: 1000000 },
          out: null,
        },
        // negative decimals
        {
          asset: {
            type: "SEP41",
            symbol: "TKN",
            address: CONTRACT_ADDRESS,
            decimals: -1,
          },
          in: { raw_value: 100 },
          out: null,
        },
        // NaN decimals
        {
          asset: {
            type: "SEP41",
            symbol: "TKN",
            address: CONTRACT_ADDRESS,
            decimals: NaN,
          },
          in: { raw_value: 100 },
          out: null,
        },
        // non-integer float decimals
        {
          asset: {
            type: "SEP41",
            symbol: "TKN",
            address: CONTRACT_ADDRESS,
            decimals: 5.5,
          },
          in: { raw_value: 100 },
          out: null,
        },
        // decimals above upper bound (20 > 19)
        {
          asset: {
            type: "SEP41",
            symbol: "TKN",
            address: CONTRACT_ADDRESS,
            decimals: 20,
          },
          in: { raw_value: 100 },
          out: null,
        },
        // raw_value is boolean
        {
          asset: { type: "ASSET", code: "USDC", issuer: USDC_ISSUER },
          in: { raw_value: true as any },
          out: null,
        },
        // raw_value is object
        {
          asset: { type: "ASSET", code: "USDC", issuer: USDC_ISSUER },
          in: { raw_value: {} as any },
          out: null,
        },
        // raw_value is empty string
        {
          asset: { type: "ASSET", code: "USDC", issuer: USDC_ISSUER },
          in: { raw_value: "" },
          out: null,
        },
        // valid anchor — must survive
        {
          asset: {
            type: "SEP41",
            symbol: "PBT",
            address: CONTRACT_ADDRESS,
            decimals: 5,
          },
          in: { raw_value: 102900 },
          out: null,
        },
      ]),
    );

    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({ assetCode: "PBT" });
    expect(result![0].amount).toEqual(new BigNumber("1.029"));
  });

  it("falls back to XLM for NATIVE asset with no code or symbol", () => {
    const result = getTransactionBalanceChanges(
      makeScanResult([
        {
          asset: { type: "NATIVE" },
          in: { raw_value: 10290000 },
          out: null,
        },
      ]),
    );

    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({
      assetCode: "XLM",
      assetIssuer: undefined,
      isNative: true,
      isCredit: true,
    });
    expect(result![0].amount).toEqual(new BigNumber("1.029"));
  });

  it("accepts decimals at the upper boundary (19) and rejects above it (20)", () => {
    const result = getTransactionBalanceChanges(
      makeScanResult([
        // decimals: 19 — at the boundary, must be included
        {
          asset: {
            type: "SEP41",
            symbol: "BOUNDARY",
            address: CONTRACT_ADDRESS,
            decimals: 19,
          },
          in: { raw_value: 1 },
          out: null,
        },
        // decimals: 20 — above the boundary, must be skipped
        {
          asset: {
            type: "SEP41",
            symbol: "OVER",
            address: CONTRACT_ADDRESS,
            decimals: 20,
          },
          in: { raw_value: 1 },
          out: null,
        },
      ]),
    );

    expect(result).toHaveLength(1);
    expect(result![0].assetCode).toBe("BOUNDARY");
  });
});

describe("isUnfundedDestinationError", () => {
  it("returns false when no context is provided", () => {
    expect(isUnfundedDestinationError(undefined)).toBe(false);
  });

  it("returns false for contract tokens sent to unfunded destinations", () => {
    expect(
      isUnfundedDestinationError({
        assetCode: "PBT",
        isDestinationFunded: false,
        isClassicAsset: false,
        isContractDestination: false,
      }),
    ).toBe(false);
  });

  it("returns false for collectibles sent to unfunded destinations", () => {
    expect(
      isUnfundedDestinationError({
        assetCode: "collectible",
        isDestinationFunded: false,
        isClassicAsset: false,
        isContractDestination: false,
      }),
    ).toBe(false);
  });

  it("returns true for classic non-XLM asset sent to unfunded destination", () => {
    expect(
      isUnfundedDestinationError({
        assetCode: "USDC",
        isDestinationFunded: false,
        isClassicAsset: true,
        isContractDestination: false,
      }),
    ).toBe(true);
  });

  it("returns true for XLM below create-account minimum to unfunded destination", () => {
    expect(
      isUnfundedDestinationError({
        assetCode: "XLM",
        isDestinationFunded: false,
        canCreateAccountWithAmount: false,
        isClassicAsset: true,
        isContractDestination: false,
      }),
    ).toBe(true);
  });

  it("returns false for XLM at/above create-account minimum to unfunded destination", () => {
    expect(
      isUnfundedDestinationError({
        assetCode: "XLM",
        isDestinationFunded: false,
        canCreateAccountWithAmount: true,
        isClassicAsset: true,
        isContractDestination: false,
      }),
    ).toBe(false);
  });

  it("returns false when destination is already funded", () => {
    expect(
      isUnfundedDestinationError({
        assetCode: "USDC",
        isDestinationFunded: true,
        isClassicAsset: true,
        isContractDestination: false,
      }),
    ).toBe(false);
  });

  it("returns false for a classic non-XLM asset sent to a contract destination", () => {
    // A C... destination isn't a classic account — the token contract
    // holds the balance entry — so the unfunded warning shouldn't fire
    // even for a classic asset like USDC.
    expect(
      isUnfundedDestinationError({
        assetCode: "USDC",
        isDestinationFunded: false,
        isClassicAsset: true,
        isContractDestination: true,
      }),
    ).toBe(false);
  });

  it("returns false for XLM below create-account minimum sent to a contract destination", () => {
    expect(
      isUnfundedDestinationError({
        assetCode: "XLM",
        isDestinationFunded: false,
        canCreateAccountWithAmount: false,
        isClassicAsset: true,
        isContractDestination: true,
      }),
    ).toBe(false);
  });
});
