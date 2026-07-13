import BigNumber from "bignumber.js";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { addBlockaidScanResults } from "helpers/addBlockaidScanResults";
import { MappedAccountBalances } from "helpers/mapAccountBalancesV2";
import { scanBulkTokens } from "services/blockaid/api";

jest.mock("services/blockaid/api", () => ({
  scanBulkTokens: jest.fn(),
}));

const mockScanBulkTokens = scanBulkTokens as jest.MockedFunction<
  typeof scanBulkTokens
>;

const benignResult = { result_type: "Benign" };
const maliciousResult = { result_type: "Malicious" };

const makeBalances = (): MappedAccountBalances =>
  ({
    isFunded: true,
    subentryCount: 1,
    balances: {
      XLM: {
        token: { type: "native", code: "XLM" },
        total: new BigNumber("100"),
        available: new BigNumber("98"),
      },
      "USDC:GISSUER": {
        token: {
          type: "credit_alphanum4",
          code: "USDC",
          issuer: { key: "GISSUER" },
        },
        total: new BigNumber("50"),
        available: new BigNumber("50"),
      },
      "TKN:CTOKEN456": {
        token: { code: "TKN", issuer: { key: "CTOKEN456" } },
        contractId: "CTOKEN456",
        total: new BigNumber("5"),
        available: new BigNumber("5"),
      },
      "abc123poolid:lp": {
        liquidityPoolId: "abc123poolid",
        total: new BigNumber("12"),
        available: new BigNumber("12"),
      },
    },
  }) as any;

describe("addBlockaidScanResults", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stamps the benign default on every non-LP entry without scanning on testnet", async () => {
    const result = await addBlockaidScanResults(
      makeBalances(),
      NETWORKS.TESTNET,
    );

    expect(mockScanBulkTokens).not.toHaveBeenCalled();
    expect((result.balances.XLM as any).blockaidData).toEqual(benignResult);
    expect((result.balances["USDC:GISSUER"] as any).blockaidData).toEqual(
      benignResult,
    );
    expect((result.balances["TKN:CTOKEN456"] as any).blockaidData).toEqual(
      benignResult,
    );
    // LP shares have no token identity and no blockaidData field
    expect(
      (result.balances["abc123poolid:lp"] as any).blockaidData,
    ).toBeUndefined();
  });

  it("scans classic + Soroban ids (not native/LP) on mainnet and merges results", async () => {
    mockScanBulkTokens.mockResolvedValueOnce({
      results: { "USDC-GISSUER": maliciousResult },
    } as any);

    const result = await addBlockaidScanResults(
      makeBalances(),
      NETWORKS.PUBLIC,
    );

    expect(mockScanBulkTokens).toHaveBeenCalledWith({
      addressList: ["USDC-GISSUER", "TKN-CTOKEN456"],
      network: NETWORKS.PUBLIC,
    });

    // matched entry overwritten with the scan verdict
    expect((result.balances["USDC:GISSUER"] as any).blockaidData).toEqual(
      maliciousResult,
    );
    // unmatched + unscannable entries keep the benign default
    expect((result.balances["TKN:CTOKEN456"] as any).blockaidData).toEqual(
      benignResult,
    );
    expect((result.balances.XLM as any).blockaidData).toEqual(benignResult);
  });

  it("keeps benign defaults and warns when the scan request fails", async () => {
    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});
    mockScanBulkTokens.mockRejectedValueOnce(new Error("scan down"));

    const result = await addBlockaidScanResults(
      makeBalances(),
      NETWORKS.PUBLIC,
    );

    expect((result.balances["USDC:GISSUER"] as any).blockaidData).toEqual(
      benignResult,
    );
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("does not scan when there is nothing scannable", async () => {
    const onlyNative = {
      isFunded: true,
      subentryCount: 0,
      balances: {
        XLM: { total: new BigNumber("1"), available: new BigNumber("1") },
      },
    } as any;

    const result = await addBlockaidScanResults(onlyNative, NETWORKS.PUBLIC);

    expect(mockScanBulkTokens).not.toHaveBeenCalled();
    expect((result.balances.XLM as any).blockaidData).toEqual(benignResult);
  });
});
