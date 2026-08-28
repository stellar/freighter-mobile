import BigNumber from "bignumber.js";
import { NETWORKS, STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { addBlockaidScanResults } from "helpers/addBlockaidScanResults";
import { MappedAccountBalances } from "helpers/mapAccountBalancesV2";
import { scanBulkTokens } from "services/blockaid/api";
import { dataStorage } from "services/storage/storageFactory";

// The helper goes through the blockaidTokenScans duck's disk-backed cache
// (scanBulkWithCache); mock the raw API + storage underneath it, same as the
// duck's own tests, so cache behavior is exercised for real.
jest.mock("services/blockaid/api");
jest.mock("services/storage/storageFactory");

const mockScanBulkTokens = scanBulkTokens as jest.MockedFunction<
  typeof scanBulkTokens
>;
const mockDataStorage = dataStorage as jest.Mocked<typeof dataStorage>;

const benignResult = { result_type: "Benign" };
const maliciousResult = { result_type: "Malicious" };

const storageKey = `${STORAGE_KEYS.BLOCKAID_TOKEN_SCANS_PREFIX}${NETWORKS.PUBLIC}`;

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
    mockDataStorage.getItem.mockResolvedValue(null);
    mockDataStorage.setItem.mockResolvedValue();
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

    expect(mockScanBulkTokens).toHaveBeenCalledWith(
      {
        addressList: ["USDC-GISSUER", "TKN-CTOKEN456"],
        network: NETWORKS.PUBLIC,
      },
      undefined,
    );

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

  it("serves fresh cache entries without a network call (30s polls stay local)", async () => {
    const cached = {
      "USDC-GISSUER": { ...maliciousResult, _cachedAt: Date.now() },
      "TKN-CTOKEN456": { ...benignResult, _cachedAt: Date.now() },
    };
    mockDataStorage.getItem.mockImplementation((key) =>
      Promise.resolve(key === storageKey ? JSON.stringify(cached) : null),
    );

    const result = await addBlockaidScanResults(
      makeBalances(),
      NETWORKS.PUBLIC,
    );

    expect(mockScanBulkTokens).not.toHaveBeenCalled();
    expect((result.balances["USDC:GISSUER"] as any).blockaidData).toEqual(
      maliciousResult,
    );
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

  it("applies the verdict to a Soroban token whose symbol contains a hyphen", async () => {
    // A SEP-41 `symbol()` is an unconstrained String, so the balance-map key
    // `<symbol>:<contractId>` can carry hyphens in the symbol half. The
    // Blockaid id is then `MY-TOKEN-CTOKEN789`, which cannot be split back
    // into the key by a first-hyphen rule.
    const hyphenated = {
      isFunded: true,
      subentryCount: 0,
      balances: {
        "MY-TOKEN:CTOKEN789": {
          token: { code: "MY-TOKEN", issuer: { key: "CTOKEN789" } },
          contractId: "CTOKEN789",
          total: new BigNumber("5"),
          available: new BigNumber("5"),
        },
      },
    } as any;

    mockScanBulkTokens.mockResolvedValueOnce({
      results: { "MY-TOKEN-CTOKEN789": maliciousResult },
    } as any);

    const result = await addBlockaidScanResults(hyphenated, NETWORKS.PUBLIC);

    expect(mockScanBulkTokens).toHaveBeenCalledWith(
      { addressList: ["MY-TOKEN-CTOKEN789"], network: NETWORKS.PUBLIC },
      undefined,
    );
    expect((result.balances["MY-TOKEN:CTOKEN789"] as any).blockaidData).toEqual(
      maliciousResult,
    );
  });

  it("logs a returned asset id that matches no balance instead of dropping it silently", async () => {
    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});
    mockScanBulkTokens.mockResolvedValueOnce({
      results: { "GHOST-CNOTHELD": maliciousResult },
    } as any);

    await addBlockaidScanResults(makeBalances(), NETWORKS.PUBLIC);

    expect(warnSpy).toHaveBeenCalledWith(
      "addBlockaidScanResults",
      expect.stringContaining("GHOST-CNOTHELD"),
    );
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
