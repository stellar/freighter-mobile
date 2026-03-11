import BigNumber from "bignumber.js";
import { getTransactionBalanceChanges } from "services/blockaid/helper";

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
    [undefined, "scanResult is undefined"],
    [{} as any, "simulation is missing"],
    [
      { simulation: { error: "simulation failed" } } as any,
      "simulation has an error",
    ],
  ])("returns null when %s", (input) => {
    expect(getTransactionBalanceChanges(input)).toBeNull();
  });

  it.each([
    [{ simulation: {} } as any, "account_assets_diffs is absent"],
    [makeScanResult([]), "account_assets_diffs is empty"],
  ])("returns [] when %s", (input) => {
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
});
