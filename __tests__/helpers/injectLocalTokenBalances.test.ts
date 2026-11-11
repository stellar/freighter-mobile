import { Asset, Networks } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { TokenDetailsResponse } from "config/types";
import { injectLocalTokenBalances } from "helpers/injectLocalTokenBalances";
import { MappedAccountBalances } from "helpers/mapAccountBalancesV2";

const NETWORK_PASSPHRASE = Networks.TESTNET;
const ISSUER = "GCEODJVUUVYVFD5KT4TOEDTMXQ76OPFOQC2EMYYMLPXQCUVPOB6XRWPQ";
const SAC_CANONICAL = `USDC:${ISSUER}`;
const SAC_CONTRACT = new Asset("USDC", ISSUER).contractId(NETWORK_PASSPHRASE);
const SEP41_CONTRACT =
  "CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4";

const makeBalances = (
  balances: Record<string, unknown> = {},
): MappedAccountBalances =>
  ({
    isFunded: true,
    subentryCount: 1,
    balances: {
      XLM: {
        token: { type: "native", code: "XLM" },
        total: new BigNumber("100"),
        available: new BigNumber("98"),
      },
      ...balances,
    },
  }) as unknown as MappedAccountBalances;

const sep41Details: TokenDetailsResponse = {
  name: "My Token",
  symbol: "TKN",
  decimals: 7,
  balance: "5000000000",
};

describe("injectLocalTokenBalances", () => {
  it("injects a locally saved token the backend did not return", async () => {
    const fetchTokenDetails = jest.fn().mockResolvedValue(sep41Details);

    const result = await injectLocalTokenBalances({
      accountBalances: makeBalances(),
      backendTokenIds: new Set(["native"]),
      localTokenIds: [SEP41_CONTRACT],
      networkPassphrase: NETWORK_PASSPHRASE,
      fetchTokenDetails,
    });

    expect(fetchTokenDetails).toHaveBeenCalledWith(SEP41_CONTRACT);
    expect(result.localOnlyTokenIds).toEqual([SEP41_CONTRACT]);

    const entry = result.balances[`TKN:${SEP41_CONTRACT}`] as any;
    expect(entry.contractId).toBe(SEP41_CONTRACT);
    // token.issuer.key must be the contract id — getTokenType resolves the
    // entry as a custom token from it, and the Add Token search reads it to
    // decide whether the token is already added.
    expect(entry.token).toEqual({
      code: "TKN",
      issuer: { key: SEP41_CONTRACT },
    });
    expect(entry.total.toString()).toBe("5000000000");
    expect(entry.available.toString()).toBe("5000000000");
    expect(entry.symbol).toBe("TKN");
    expect(entry.name).toBe("My Token");
    expect(entry.decimals).toBe(7);
    expect(entry.blockaidData).toBeUndefined();
    // pre-existing balances are preserved
    expect(result.balances.XLM).toBeDefined();
  });

  it("treats a token with no balance as zero", async () => {
    const result = await injectLocalTokenBalances({
      accountBalances: makeBalances(),
      backendTokenIds: new Set(["native"]),
      localTokenIds: [SEP41_CONTRACT],
      networkPassphrase: NETWORK_PASSPHRASE,
      fetchTokenDetails: jest
        .fn()
        .mockResolvedValue({ ...sep41Details, balance: undefined }),
    });

    const entry = result.balances[`TKN:${SEP41_CONTRACT}`] as any;
    expect(entry.total.toString()).toBe("0");
  });

  it("makes no requests and injects nothing when the backend covers every local id", async () => {
    const fetchTokenDetails = jest.fn();

    const result = await injectLocalTokenBalances({
      accountBalances: makeBalances({
        [`TKN:${SEP41_CONTRACT}`]: { contractId: SEP41_CONTRACT },
      }),
      backendTokenIds: new Set(["native", SEP41_CONTRACT]),
      localTokenIds: [SEP41_CONTRACT],
      networkPassphrase: NETWORK_PASSPHRASE,
      fetchTokenDetails,
    });

    expect(fetchTokenDetails).not.toHaveBeenCalled();
    expect(result.localOnlyTokenIds).toEqual([]);
    expect(Object.keys(result.balances)).toEqual([
      "XLM",
      `TKN:${SEP41_CONTRACT}`,
    ]);
  });

  it("skips a locally saved SAC already on screen as a classic trustline", async () => {
    // A classic balance's token_id is the asset string, not the contract id, so
    // the contract-id check alone would not catch this.
    const result = await injectLocalTokenBalances({
      accountBalances: makeBalances({
        [SAC_CANONICAL]: {
          token: {
            type: "credit_alphanum4",
            code: "USDC",
            issuer: { key: ISSUER },
          },
          total: new BigNumber("50"),
        },
      }),
      backendTokenIds: new Set(["native", SAC_CANONICAL]),
      localTokenIds: [SAC_CONTRACT],
      networkPassphrase: NETWORK_PASSPHRASE,
      fetchTokenDetails: jest.fn().mockResolvedValue({
        name: SAC_CANONICAL,
        symbol: "USDC",
        decimals: 7,
        balance: "500000000",
      }),
    });

    expect(result.localOnlyTokenIds).toEqual([]);
    expect(Object.keys(result.balances)).toEqual(["XLM", SAC_CANONICAL]);
  });

  it("injects a locally saved SAC that has no classic balance on screen", async () => {
    const result = await injectLocalTokenBalances({
      accountBalances: makeBalances(),
      backendTokenIds: new Set(["native"]),
      localTokenIds: [SAC_CONTRACT],
      networkPassphrase: NETWORK_PASSPHRASE,
      fetchTokenDetails: jest.fn().mockResolvedValue({
        name: SAC_CANONICAL,
        symbol: "USDC",
        decimals: 7,
        balance: "0",
      }),
    });

    expect(result.localOnlyTokenIds).toEqual([SAC_CONTRACT]);
    expect(result.balances[`USDC:${SAC_CONTRACT}`]).toBeDefined();
  });

  it("injects a SEP-41 token whose name looks like CODE:ISSUER but is not that asset's SAC", async () => {
    // The loose name-format check would dedupe this away; deriving the SAC
    // address and comparing it to the contract in hand does not.
    const result = await injectLocalTokenBalances({
      accountBalances: makeBalances({
        [SAC_CANONICAL]: { total: new BigNumber("50") },
      }),
      backendTokenIds: new Set(["native", SAC_CANONICAL]),
      localTokenIds: [SEP41_CONTRACT],
      networkPassphrase: NETWORK_PASSPHRASE,
      fetchTokenDetails: jest.fn().mockResolvedValue({
        name: SAC_CANONICAL,
        symbol: "TKN",
        decimals: 7,
        balance: "1",
      }),
    });

    expect(result.localOnlyTokenIds).toEqual([SEP41_CONTRACT]);
    expect(result.balances[`TKN:${SEP41_CONTRACT}`]).toBeDefined();
  });

  it("skips a token whose details cannot be resolved", async () => {
    const result = await injectLocalTokenBalances({
      accountBalances: makeBalances(),
      backendTokenIds: new Set(["native"]),
      localTokenIds: [SEP41_CONTRACT],
      networkPassphrase: NETWORK_PASSPHRASE,
      fetchTokenDetails: jest.fn().mockResolvedValue(null),
    });

    expect(result.localOnlyTokenIds).toEqual([]);
    expect(Object.keys(result.balances)).toEqual(["XLM"]);
  });

  it("resolves one token even when another fails, keeping ids in order", async () => {
    const otherContract =
      "CBRVEWMKQUYHYCLWCXSGWEUSYUFXQFWQGRD7NWJ5EBHXWZEQ6SGKX3AL";
    const fetchTokenDetails = jest
      .fn()
      .mockImplementation((contractId: string) =>
        Promise.resolve(contractId === SEP41_CONTRACT ? sep41Details : null),
      );

    const result = await injectLocalTokenBalances({
      accountBalances: makeBalances(),
      backendTokenIds: new Set(["native"]),
      localTokenIds: [otherContract, SEP41_CONTRACT],
      networkPassphrase: NETWORK_PASSPHRASE,
      fetchTokenDetails,
    });

    expect(fetchTokenDetails).toHaveBeenCalledTimes(2);
    expect(result.localOnlyTokenIds).toEqual([SEP41_CONTRACT]);
  });

  it("tolerates a missing local token list", async () => {
    const result = await injectLocalTokenBalances({
      accountBalances: makeBalances(),
      backendTokenIds: new Set(["native"]),
      localTokenIds: undefined,
      networkPassphrase: NETWORK_PASSPHRASE,
      fetchTokenDetails: jest.fn(),
    });

    expect(result.localOnlyTokenIds).toEqual([]);
    expect(result.balances.XLM).toBeDefined();
  });

  it("falls back to the name then the contract id when symbol is empty", async () => {
    const result = await injectLocalTokenBalances({
      accountBalances: makeBalances(),
      backendTokenIds: new Set(["native"]),
      localTokenIds: [SEP41_CONTRACT],
      networkPassphrase: NETWORK_PASSPHRASE,
      fetchTokenDetails: jest
        .fn()
        .mockResolvedValue({ name: "", symbol: "", decimals: 7 }),
    });

    // never a degenerate ":CONTRACT" key, which downstream code would read as
    // an asset with no issuer
    expect(
      result.balances[`${SEP41_CONTRACT}:${SEP41_CONTRACT}`],
    ).toBeDefined();
  });
});
