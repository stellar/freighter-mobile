import {
  Asset,
  Keypair,
  Networks,
  TransactionBuilder,
  Transaction,
  Operation,
  Address,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { BigNumber } from "bignumber.js";
import { NETWORKS } from "config/constants";
import { PricedBalance, TokenTypeWithCustomToken } from "config/types";
import { getNativeContractDetails } from "helpers/soroban";
import { buildPaymentTransaction } from "services/transactionService";

jest.mock("services/stellar", () => ({
  ...jest.requireActual("services/stellar"),
  stellarSdkServer: jest.fn(() => ({
    loadAccount: jest.fn((publicKey: string) => ({
      accountId: () => publicKey,
      sequenceNumber: () => "1000",
      incrementSequenceNumber: jest.fn(),
    })),
    fetchTimebounds: jest.fn(() => ({ minTime: 0, maxTime: 2000000000 })),
  })),
}));

jest.mock("services/analytics", () => ({
  analytics: { trackSimulationError: jest.fn() },
}));

jest.mock("i18next", () => ({ t: jest.fn((key: string) => key) }));

jest.mock("services/backend", () => ({
  simulateTransaction: jest.fn(),
  checkContractSupportsMuxed: jest.fn().mockResolvedValue(false),
}));

const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const USDC_SAC = new Asset("USDC", ISSUER).contractId(Networks.TESTNET);
const XLM_SAC = getNativeContractDetails(NETWORKS.TESTNET).contract;
// An unrelated contract address, standing in for any pasted C... destination
const UNRELATED_CONTRACT =
  "CB5OQXIXSBZROO54MDQCH3T55Z46E5E46WBNCT4K4FKQERK3NIFFEJ3W";
const CUSTOM_TOKEN_CONTRACT =
  "CBOVW5CXOPHYWGLJPWBQMGX2F3REBY2ZTZX3N47RTYWWHZV2BXCIIGTL";

const CLASSIC_XLM_ISSUER =
  "GBEO62ZYAOEKVL4WMF5Q6VYTOJQUT7H2QYRDVFO5LT4W7VQPFDWVKUHO";
const classicXlmSacTestnet = new Asset("XLM", CLASSIC_XLM_ISSUER).contractId(
  Networks.TESTNET,
);
const NATIVE_SAC_TESTNET =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const sender = Keypair.random();

const baseParams = {
  tokenAmount: "500",
  transactionFee: "0.001",
  transactionTimeout: 300,
  network: NETWORKS.TESTNET,
  senderAddress: sender.publicKey(),
};

const nativeXlmBalance = {
  id: "native",
  token: { type: "native", code: "XLM" },
  total: new BigNumber("100"),
  available: new BigNumber("99"),
  minimumBalance: new BigNumber("1"),
  buyingLiabilities: "0",
  sellingLiabilities: "0",
  tokenCode: "XLM",
} as unknown as PricedBalance;

const nonNativeXlmBalance = {
  id: `XLM:${CLASSIC_XLM_ISSUER}`,
  token: {
    type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    code: "XLM",
    issuer: { key: CLASSIC_XLM_ISSUER },
  },
  total: new BigNumber("100"),
  available: new BigNumber("100"),
  limit: new BigNumber("1000"),
  buyingLiabilities: "0",
  sellingLiabilities: "0",
  tokenCode: "XLM",
} as unknown as PricedBalance;

const classicUsdcBalance = {
  token: { code: "USDC", issuer: { key: ISSUER }, type: "credit_alphanum4" },
  total: new BigNumber("1000"),
  available: new BigNumber("1000"),
  limit: new BigNumber("100000"),
  buyingLiabilities: "0",
  sellingLiabilities: "0",
  tokenCode: "USDC",
} as unknown as PricedBalance;

const nativeBalance = {
  token: { code: "XLM", type: "native" },
  total: new BigNumber("1000"),
  available: new BigNumber("1000"),
  minimumBalance: new BigNumber("1"),
  buyingLiabilities: "0",
  sellingLiabilities: "0",
  tokenCode: "XLM",
} as unknown as PricedBalance;

const customTokenBalance = {
  token: { code: "WETH", issuer: { key: CUSTOM_TOKEN_CONTRACT } },
  contractId: CUSTOM_TOKEN_CONTRACT,
  total: new BigNumber("1000"),
  available: new BigNumber("1000"),
  name: "Wrapped Ether",
  symbol: "WETH",
  decimals: 18,
  tokenCode: "WETH",
} as unknown as PricedBalance;

const decodeInvocation = (xdrString: string) => {
  const tx = TransactionBuilder.fromXdr(
    xdrString,
    Networks.TESTNET,
  ) as Transaction;
  const op = tx.operations[0] as Operation.InvokeHostFunction;
  const invoke = xdr.expectUnionVariant(
    op.func,
    "hostFunctionTypeInvokeContract",
  ).invokeContract;

  return {
    invokedContract: Address.fromScAddress(invoke.contractAddress).toString(),
    fnName: invoke.functionName.toString(),
    args: invoke.args.map((arg) => scValToNative(arg)),
  };
};

describe("buildPaymentTransaction — Soroban transfer target selection", () => {
  it("targets the asset's own SAC when a classic asset goes to a contract address", async () => {
    const result = await buildPaymentTransaction({
      ...baseParams,
      selectedBalance: classicUsdcBalance,
      recipientAddress: UNRELATED_CONTRACT,
    } as never);

    // Regression guard: the recipient must never become the token contract.
    expect(result.contractId).toBe(USDC_SAC);
    expect(result.contractId).not.toBe(UNRELATED_CONTRACT);

    const { invokedContract, fnName, args } = decodeInvocation(result.xdr);
    expect(invokedContract).toBe(USDC_SAC);
    expect(fnName).toBe("transfer");
    expect(args[0]).toBe(sender.publicKey());
    expect(args[1]).toBe(UNRELATED_CONTRACT);
    expect(String(args[2])).toBe("5000000000"); // 500 * 10^7
  });

  it("does not move a different asset when the destination is another asset's SAC", async () => {
    const result = await buildPaymentTransaction({
      ...baseParams,
      selectedBalance: classicUsdcBalance,
      recipientAddress: XLM_SAC,
    } as never);

    // Selecting USDC must never produce a call into the XLM SAC.
    expect(result.contractId).toBe(USDC_SAC);
    expect(decodeInvocation(result.xdr).invokedContract).toBe(USDC_SAC);
  });

  it("targets the native SAC for XLM sent to a contract address", async () => {
    const result = await buildPaymentTransaction({
      ...baseParams,
      selectedBalance: nativeBalance,
      recipientAddress: UNRELATED_CONTRACT,
    } as never);

    expect(result.contractId).toBe(XLM_SAC);
    expect(decodeInvocation(result.xdr).invokedContract).toBe(XLM_SAC);
  });

  it("targets the token's own contract for a custom token", async () => {
    const result = await buildPaymentTransaction({
      ...baseParams,
      selectedBalance: customTokenBalance,
      recipientAddress: Keypair.random().publicKey(),
    } as never);

    expect(result.contractId).toBe(CUSTOM_TOKEN_CONTRACT);
    expect(decodeInvocation(result.xdr).invokedContract).toBe(
      CUSTOM_TOKEN_CONTRACT,
    );
  });

  // Sending a token to its own token contract credits the contract's own
  // address, where nothing can spend it again. Refusing to build is defence
  // in depth: it also catches any future rewiring that lets the recipient
  // become the invocation target.
  it.each([
    ["a classic asset", classicUsdcBalance, USDC_SAC],
    ["native XLM", nativeBalance, XLM_SAC],
    ["a custom token", customTokenBalance, CUSTOM_TOKEN_CONTRACT],
  ])(
    "refuses to send %s to the token's own contract address",
    async (_label, selectedBalance, ownContract) => {
      await expect(
        buildPaymentTransaction({
          ...baseParams,
          selectedBalance,
          recipientAddress: ownContract,
        } as never),
      ).rejects.toThrow("transaction.errors.recipientIsTokenContract");
    },
  );
});

describe("send to contract address — asset/contract resolution", () => {
  const contractTestBaseParams = {
    tokenAmount: "5",
    transactionFee: "0.001",
    transactionTimeout: 300,
    network: NETWORKS.TESTNET,
    senderAddress: sender.publicKey(),
  };

  beforeAll(() => {
    expect(classicXlmSacTestnet).not.toBe(NATIVE_SAC_TESTNET);
  });

  it("refuses when the recipient is the selected asset's own token contract", async () => {
    await expect(
      buildPaymentTransaction({
        ...contractTestBaseParams,
        selectedBalance: nonNativeXlmBalance,
        recipientAddress: classicXlmSacTestnet,
      } as never),
    ).rejects.toThrow("transaction.errors.recipientIsTokenContract");
  });

  it("still refuses native sends to the native token contract", async () => {
    await expect(
      buildPaymentTransaction({
        ...contractTestBaseParams,
        selectedBalance: nativeXlmBalance,
        recipientAddress: NATIVE_SAC_TESTNET,
      } as never),
    ).rejects.toThrow("transaction.errors.recipientIsTokenContract");
  });

  it("invokes the selected asset's own contract, not the native one, for an XLM-coded non-native balance", async () => {
    const unrelatedContract =
      "CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2HV2KN7OHT";
    expect(unrelatedContract).not.toBe(classicXlmSacTestnet);
    const result = await buildPaymentTransaction({
      ...contractTestBaseParams,
      selectedBalance: nonNativeXlmBalance,
      recipientAddress: unrelatedContract,
    } as never);
    expect(result.contractId).toBe(classicXlmSacTestnet);
    expect(result.contractId).not.toBe(NATIVE_SAC_TESTNET);
  });
});
