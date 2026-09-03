import { Networks } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { TokenTypeWithCustomToken, type Balance } from "config/types";
import {
  getNativeContractId,
  isNativeBalance,
  isNativeContract,
  isNativeToken,
} from "helpers/assetIdentity";

const ISSUER_A = "GBEO62ZYAOEKVL4WMF5Q6VYTOJQUT7H2QYRDVFO5LT4W7VQPFDWVKUHO";
const CONTRACT_A = "CAGU6PWW5X5CIQNLDORUUK3WYXL6JHBQLCDFB5DEVXFJNB4POMLZNEYI";
const PUBNET_NATIVE_SAC =
  "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
const TESTNET_NATIVE_SAC =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const nativeBalance: Balance = {
  token: { type: "native", code: "XLM" },
  total: new BigNumber("100"),
  available: new BigNumber("99"),
  minimumBalance: new BigNumber("1"),
  buyingLiabilities: "0",
  sellingLiabilities: "0",
};

// An XLM-coded classic asset: same code as native, different type/issuer.
const nonNativeXlmBalance: Balance = {
  token: {
    type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    code: "XLM",
    issuer: { key: ISSUER_A },
  },
  total: new BigNumber("100"),
  available: new BigNumber("100"),
  limit: new BigNumber("1000"),
  buyingLiabilities: "0",
  sellingLiabilities: "0",
};

// SEP-41 style entry: symbol "XLM", issuer.key holds the contract id,
// and `type` is absent — the shape injectLocalTokenBalances produces.
const sorobanXlmSymbolBalance: Balance = {
  token: { code: "XLM", issuer: { key: CONTRACT_A } },
  total: new BigNumber("5"),
  available: new BigNumber("5"),
  contractId: CONTRACT_A,
  name: "XLM",
  symbol: "XLM",
  decimals: 7,
};

const lpBalance: Balance = {
  total: new BigNumber("1"),
  limit: new BigNumber("1"),
  liquidityPoolId: "abc123",
  reserves: [],
};

describe("isNativeToken", () => {
  it("is true only for type native", () => {
    expect(isNativeToken({ type: "native", code: "XLM" })).toBe(true);
    expect(isNativeToken(nonNativeXlmBalance.token)).toBe(false);
    expect(isNativeToken(sorobanXlmSymbolBalance.token)).toBe(false);
    expect(isNativeToken(undefined)).toBe(false);
    expect(isNativeToken(null)).toBe(false);
  });
});

describe("isNativeBalance", () => {
  it("accepts the native balance and nothing else with code XLM", () => {
    expect(isNativeBalance(nativeBalance)).toBe(true);
    expect(isNativeBalance(nonNativeXlmBalance)).toBe(false);
    expect(isNativeBalance(sorobanXlmSymbolBalance)).toBe(false);
    expect(isNativeBalance(lpBalance)).toBe(false);
  });
});

describe("getNativeContractId", () => {
  it("derives the known SACs for pubnet and testnet", () => {
    expect(getNativeContractId(Networks.PUBLIC)).toBe(PUBNET_NATIVE_SAC);
    expect(getNativeContractId(Networks.TESTNET)).toBe(TESTNET_NATIVE_SAC);
  });

  it("derives a non-empty id for networks with no hardcoded entry", () => {
    const futurenetId = getNativeContractId(Networks.FUTURENET);
    expect(futurenetId).toMatch(/^C[A-Z2-7]{55}$/);
    expect(futurenetId).not.toBe(PUBNET_NATIVE_SAC);
  });
});

describe("isNativeContract", () => {
  it("matches only the derived native SAC for the given network", () => {
    expect(isNativeContract(PUBNET_NATIVE_SAC, Networks.PUBLIC)).toBe(true);
    expect(isNativeContract(CONTRACT_A, Networks.PUBLIC)).toBe(false);
    expect(isNativeContract(PUBNET_NATIVE_SAC, Networks.TESTNET)).toBe(false);
    expect(isNativeContract(undefined, Networks.PUBLIC)).toBe(false);
    expect(isNativeContract("", Networks.PUBLIC)).toBe(false);
  });
});
