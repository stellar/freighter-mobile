import {
  Asset,
  Keypair,
  Networks,
  TransactionBuilder,
  Address,
  Transaction,
  Operation,
  xdr,
} from "@stellar/stellar-sdk";
import { BigNumber } from "bignumber.js";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { TokenTypeWithCustomToken, type PricedBalance } from "config/types";
import { analytics } from "services/analytics";
import * as backend from "services/backend";
import {
  buildPaymentTransaction,
  buildSendCollectibleTransaction,
  BuildSendCollectibleParams,
  buildSwapTransaction,
  getContractIdForNativeToken,
  getTokenForPayment,
  simulateCollectibleTransfer,
  validateSendCollectibleTransactionParams,
} from "services/transactionService";

// Hoisted so it can be reconfigured per test (e.g. to simulate an unfunded
// destination) while defaulting to the always-succeed behavior the rest of
// this file's tests rely on.
const mockLoadAccount = jest.fn((publicKey: string) =>
  Promise.resolve({
    accountId: () => publicKey,
    sequenceNumber: () => "1000",
    incrementSequenceNumber: jest.fn(),
  }),
);

jest.mock("services/stellar", () => ({
  ...jest.requireActual("services/stellar"),
  stellarSdkServer: jest.fn(() => ({
    loadAccount: mockLoadAccount,
    fetchTimebounds: jest.fn(() => ({
      minTime: 0,
      maxTime: Math.floor(Date.now() / 1000) + 300,
    })),
  })),
}));

jest.mock("services/analytics", () => ({
  analytics: {
    trackSimulationError: jest.fn(),
  },
}));

jest.mock("i18next", () => ({
  t: jest.fn((key: string) => key),
}));

jest.mock("services/backend", () => ({
  simulateTransaction: jest.fn(),
  checkContractSupportsMuxed: jest.fn().mockResolvedValue(false),
}));

const SPOOF_ISSUER = "GBEO62ZYAOEKVL4WMF5Q6VYTOJQUT7H2QYRDVFO5LT4W7VQPFDWVKUHO";

// Fixture pair: identical tokenCode "XLM", differing only in token type and
// issuer.
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

const spoofedXlmBalance = {
  id: `XLM:${SPOOF_ISSUER}`,
  token: {
    type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    code: "XLM",
    issuer: { key: SPOOF_ISSUER },
  },
  total: new BigNumber("100"),
  available: new BigNumber("100"),
  limit: new BigNumber("1000"),
  buyingLiabilities: "0",
  sellingLiabilities: "0",
  tokenCode: "XLM",
} as unknown as PricedBalance;

describe("getTokenForPayment", () => {
  it("returns the native asset only for a native-typed balance", () => {
    const token = getTokenForPayment(nativeXlmBalance);
    expect(token.isNative()).toBe(true);
  });

  it("returns the classic asset for an XLM-coded non-native balance", () => {
    const token = getTokenForPayment(spoofedXlmBalance);
    expect(token.isNative()).toBe(false);
    expect(token.getCode()).toBe("XLM");
    expect(token.getIssuer()).toBe(SPOOF_ISSUER);
  });
});

describe("getContractIdForNativeToken", () => {
  it("derives the native contract for every network without throwing", () => {
    expect(getContractIdForNativeToken(NETWORKS.PUBLIC)).toBe(
      "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    );
    expect(getContractIdForNativeToken(NETWORKS.TESTNET)).toBe(
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    );
    // Networks without a hardcoded entry must still derive a real id.
    expect(getContractIdForNativeToken(NETWORKS.FUTURENET)).toMatch(
      /^C[A-Z2-7]{55}$/,
    );
  });
});

describe("buildPaymentTransaction asset resolution", () => {
  const sender = Keypair.random().publicKey();
  const fundedRecipient = Keypair.random().publicKey();

  const baseParams = {
    tokenAmount: "5",
    recipientAddress: fundedRecipient,
    transactionFee: "0.00001",
    transactionTimeout: 300,
    network: NETWORKS.TESTNET,
    senderAddress: sender,
  };

  it("builds a payment carrying the classic asset for an XLM-coded non-native balance", async () => {
    const result = await buildPaymentTransaction({
      ...baseParams,
      selectedBalance: spoofedXlmBalance,
    });
    const tx = TransactionBuilder.fromXdr(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;
    const op = tx.operations[0] as Operation.Payment;
    expect(op.type).toBe("payment");
    expect(op.asset.getCode()).toBe("XLM");
    expect(op.asset.getIssuer()).toBe(SPOOF_ISSUER);
    expect(op.asset.isNative()).toBe(false);
  });

  it("still builds a native payment for the native balance", async () => {
    const result = await buildPaymentTransaction({
      ...baseParams,
      selectedBalance: nativeXlmBalance,
    });
    const tx = TransactionBuilder.fromXdr(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;
    const op = tx.operations[0] as Operation.Payment;
    expect(op.asset.isNative()).toBe(true);
  });
});

describe("buildPaymentTransaction unfunded destination", () => {
  // loadAccount: succeeds for the sender, 404s for the destination —
  // configure via the overridable mock from the module factory.
  const sender = Keypair.random().publicKey();
  const unfundedRecipient = Keypair.random().publicKey();

  const baseParams = {
    tokenAmount: "5", // >= MINIMUM_CREATE_ACCOUNT_XLM
    recipientAddress: unfundedRecipient,
    transactionFee: "0.00001",
    transactionTimeout: 300,
    network: NETWORKS.TESTNET,
    senderAddress: sender,
  };

  beforeEach(() => {
    mockLoadAccount.mockImplementation((publicKey: string) => {
      if (publicKey === unfundedRecipient) {
        const notFound = new Error("Not Found") as Error & {
          response: { status: number };
        };
        notFound.response = { status: 404 };
        return Promise.reject(notFound);
      }
      return Promise.resolve({
        accountId: () => publicKey,
        sequenceNumber: () => "1000",
        incrementSequenceNumber: jest.fn(),
      });
    });
  });

  afterEach(() => {
    // Restore the file-wide always-succeed default so later describes are
    // unaffected by this block's per-destination override.
    mockLoadAccount.mockImplementation((publicKey: string) =>
      Promise.resolve({
        accountId: () => publicKey,
        sequenceNumber: () => "1000",
        incrementSequenceNumber: jest.fn(),
      }),
    );
  });

  it("creates the account only for the native balance", async () => {
    const result = await buildPaymentTransaction({
      ...baseParams,
      selectedBalance: nativeXlmBalance,
    });
    const tx = TransactionBuilder.fromXdr(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;
    expect(tx.operations[0].type).toBe("createAccount");
  });

  it("builds a classic-asset payment (not createAccount) for an XLM-coded non-native balance", async () => {
    const result = await buildPaymentTransaction({
      ...baseParams,
      selectedBalance: spoofedXlmBalance,
    });
    const tx = TransactionBuilder.fromXdr(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;
    const op = tx.operations[0] as Operation.Payment;
    expect(op.type).toBe("payment");
    expect(op.asset.getIssuer()).toBe(SPOOF_ISSUER);
  });
});

describe("buildSwapTransaction asset resolution", () => {
  // Mirrors the params/mocks used by the existing buildSwapTransaction —
  // includeTrustline tests below; asserts on the built pathPaymentStrictSend op.
  it("carries the classic asset as sendAsset for an XLM-coded non-native source", async () => {
    const senderAddress = Keypair.random().publicKey();

    const result = await buildSwapTransaction({
      sourceBalance: spoofedXlmBalance,
      destinationBalance: nativeXlmBalance,
      sourceAmount: "5",
      destinationAmount: "5",
      destinationAmountMin: "4.9",
      path: [],
      transactionFee: "0.00001",
      transactionTimeout: 300,
      network: NETWORKS.TESTNET,
      senderAddress,
    });
    const tx = TransactionBuilder.fromXdr(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;
    const op = tx.operations[0] as Operation.PathPaymentStrictSend;
    expect(op.sendAsset.isNative()).toBe(false);
    expect(op.sendAsset.getIssuer()).toBe(SPOOF_ISSUER);
    expect(op.destAsset.isNative()).toBe(true);
  });
});

describe("buildSendCollectibleTransaction", () => {
  const mockSenderKeypair = Keypair.random();
  const mockRecipientKeypair = Keypair.random();
  const mockCollectionAddress =
    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

  const baseParams: BuildSendCollectibleParams = {
    collectionAddress: mockCollectionAddress,
    recipientAddress: mockRecipientKeypair.publicKey(),
    transactionMemo: undefined,
    transactionFee: "0.001",
    transactionTimeout: 300,
    tokenId: 12345,
    network: NETWORKS.TESTNET,
    senderAddress: mockSenderKeypair.publicKey(),
  };

  it("should build a valid collectible transfer transaction", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    expect(result).toHaveProperty("tx");
    expect(result).toHaveProperty("xdr");
    expect(typeof result.xdr).toBe("string");
  });

  it("should create transaction with correct sender address from parsed XDR", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    const parsedTx = TransactionBuilder.fromXdr(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;

    expect(parsedTx.source).toBe(mockSenderKeypair.publicKey());
  });

  it("should include invoke host function operation with transfer call", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    const parsedTx = TransactionBuilder.fromXdr(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;

    expect(parsedTx.operations).toHaveLength(1);
    expect(parsedTx.operations[0].type).toBe("invokeHostFunction");
  });

  it("should encode correct contract address in operation", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    const parsedTx = TransactionBuilder.fromXdr(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;

    const operation = parsedTx.operations[0] as Operation.InvokeHostFunction;
    const hostFunction = operation.func;

    expect(hostFunction.type).toBe("hostFunctionTypeInvokeContract");

    const invokeContractArgs = xdr.expectUnionVariant(
      hostFunction,
      "hostFunctionTypeInvokeContract",
    ).invokeContract;
    const { contractAddress } = invokeContractArgs;
    const addressFromXdr = Address.fromScAddress(contractAddress);

    expect(addressFromXdr.toString()).toBe(mockCollectionAddress);
  });

  it("should call transfer function in the contract", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    const parsedTx = TransactionBuilder.fromXdr(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;

    const operation = parsedTx.operations[0] as Operation.InvokeHostFunction;
    const hostFunction = operation.func;
    const invokeContractArgs = xdr.expectUnionVariant(
      hostFunction,
      "hostFunctionTypeInvokeContract",
    ).invokeContract;
    const functionName = invokeContractArgs.functionName.toString();

    expect(functionName).toBe("transfer");
  });

  it("should encode correct transfer parameters: from, to, token_id", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    const parsedTx = TransactionBuilder.fromXdr(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;

    const operation = parsedTx.operations[0] as Operation.InvokeHostFunction;
    const hostFunction = operation.func;
    const invokeContractArgs = xdr.expectUnionVariant(
      hostFunction,
      "hostFunctionTypeInvokeContract",
    ).invokeContract;
    const { args } = invokeContractArgs;

    // Should have 3 arguments: from, to, token_id
    expect(args).toHaveLength(3);

    // First argument should be sender address
    const fromAddress = Address.fromScVal(args[0]);
    expect(fromAddress.toString()).toBe(mockSenderKeypair.publicKey());

    // Second argument should be recipient address
    const toAddress = Address.fromScVal(args[1]);
    expect(toAddress.toString()).toBe(mockRecipientKeypair.publicKey());

    // Third argument should be token_id as u32
    const tokenIdScVal = args[2];
    expect(tokenIdScVal.type).toBe("scvU32");
    const tokenIdValue = xdr.expectUnionVariant(tokenIdScVal, "scvU32").u32;
    expect(tokenIdValue.toString()).toBe("12345");
  });

  it("should use correct fee from parameters", async () => {
    const customFee = "0.002";
    const params = { ...baseParams, transactionFee: customFee };

    const result = await buildSendCollectibleTransaction(params);

    const parsedTx = TransactionBuilder.fromXdr(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;

    // 0.002 XLM = 20,000 stroops
    expect(parsedTx.fee).toBe("20000");
  });

  it("should handle different network configurations", async () => {
    const mainnetParams = {
      ...baseParams,
      network: NETWORKS.PUBLIC,
    };

    const result = await buildSendCollectibleTransaction(mainnetParams);

    const parsedTx = TransactionBuilder.fromXdr(
      result.xdr,
      Networks.PUBLIC,
    ) as Transaction;

    expect(parsedTx.networkPassphrase).toBe(Networks.PUBLIC);
  });

  it("should throw error for invalid fee", async () => {
    const invalidFeeParams = {
      ...baseParams,
      transactionFee: "0",
    };

    await expect(
      buildSendCollectibleTransaction(invalidFeeParams),
    ).rejects.toThrow();
  });

  it("should throw error for invalid timeout", async () => {
    const invalidTimeoutParams = {
      ...baseParams,
      transactionTimeout: 0,
    };

    await expect(
      buildSendCollectibleTransaction(invalidTimeoutParams),
    ).rejects.toThrow();
  });

  it("should throw error for negative timeout", async () => {
    const negativeTimeoutParams = {
      ...baseParams,
      transactionTimeout: -100,
    };

    await expect(
      buildSendCollectibleTransaction(negativeTimeoutParams),
    ).rejects.toThrow();
  });

  it("should throw error for negative fee", async () => {
    const negativeFeeParams = {
      ...baseParams,
      transactionFee: "-0.001",
    };

    await expect(
      buildSendCollectibleTransaction(negativeFeeParams),
    ).rejects.toThrow();
  });

  it("should create transaction with correct sequence number", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    const parsedTx = TransactionBuilder.fromXdr(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;

    // Sequence number should be incremented from the loaded account
    // Our mock returns "1000", so the transaction should have "1001"
    expect(parsedTx.sequence).toBe("1001");
  });

  it("should create XDR that can be successfully parsed and rebuilt", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    const parsedTx = TransactionBuilder.fromXdr(result.xdr, Networks.TESTNET);

    const reExportedXdr = parsedTx.toXdr();
    expect(reExportedXdr).toBe(result.xdr);
  });

  it("should set correct timebounds", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    const parsedTx = TransactionBuilder.fromXdr(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;

    expect(parsedTx.timeBounds).toBeDefined();
    expect(parsedTx.timeBounds!.minTime).toBe("0");
    expect(Number(parsedTx.timeBounds!.maxTime)).toBeGreaterThan(0);
  });
});

describe("simulateCollectibleTransfer", () => {
  const mockTransactionXdr = "mock_transaction_xdr";
  const mockPreparedXdr = "mock_prepared_xdr";
  const mockNetworkDetails = mapNetworkToNetworkDetails(NETWORKS.TESTNET);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully simulate collectible transfer", async () => {
    (backend.simulateTransaction as jest.Mock).mockResolvedValue({
      preparedTransaction: mockPreparedXdr,
      simulationResponse: {},
    });

    const result = await simulateCollectibleTransfer({
      transactionXdr: mockTransactionXdr,
      networkDetails: mockNetworkDetails,
    });

    expect(result).toEqual({
      preparedTransaction: mockPreparedXdr,
      minResourceFee: undefined,
    });
    expect(backend.simulateTransaction).toHaveBeenCalledWith({
      xdr: mockTransactionXdr,
      network_url: mockNetworkDetails.sorobanRpcUrl,
      network_passphrase: mockNetworkDetails.networkPassphrase,
    });
  });

  it("should correctly plumb minResourceFee when present in simulationResponse", async () => {
    const mockResourceFee = "500";
    (backend.simulateTransaction as jest.Mock).mockResolvedValue({
      preparedTransaction: mockPreparedXdr,
      simulationResponse: { minResourceFee: mockResourceFee },
    });

    const result = await simulateCollectibleTransfer({
      transactionXdr: mockTransactionXdr,
      networkDetails: mockNetworkDetails,
    });

    expect(result).toEqual({
      preparedTransaction: mockPreparedXdr,
      minResourceFee: mockResourceFee,
    });
  });

  it("should throw error if Soroban RPC URL is not defined", async () => {
    const invalidNetworkDetails = {
      ...mockNetworkDetails,
      sorobanRpcUrl: undefined,
    };

    await expect(
      simulateCollectibleTransfer({
        transactionXdr: mockTransactionXdr,
        networkDetails: invalidNetworkDetails,
      }),
    ).rejects.toThrow("Soroban RPC URL is not defined for this network");
  });

  it("should track simulation error when simulation fails", async () => {
    const mockError = new Error("Simulation failed");
    (backend.simulateTransaction as jest.Mock).mockRejectedValue(mockError);

    await expect(
      simulateCollectibleTransfer({
        transactionXdr: mockTransactionXdr,
        networkDetails: mockNetworkDetails,
      }),
    ).rejects.toThrow("Simulation failed");

    expect(analytics.trackSimulationError).toHaveBeenCalledWith(
      "Simulation failed",
      "collectible_transfer",
    );
  });

  it("should handle backend error responses", async () => {
    const backendError = new Error("Backend service unavailable");
    (backend.simulateTransaction as jest.Mock).mockRejectedValue(backendError);

    await expect(
      simulateCollectibleTransfer({
        transactionXdr: mockTransactionXdr,
        networkDetails: mockNetworkDetails,
      }),
    ).rejects.toThrow("Backend service unavailable");
  });
});

describe("validateSendCollectibleTransactionParams", () => {
  it("should return null for valid params", () => {
    const params = {
      fee: "0.001",
      timeout: 300,
    };

    const result = validateSendCollectibleTransactionParams(params);

    expect(result).toBeNull();
  });

  it("should return error for invalid fee (zero)", () => {
    const params = {
      fee: "0",
      timeout: 300,
    };

    const result = validateSendCollectibleTransactionParams(params);

    expect(result).toBe("transaction.errors.feeRequired");
  });

  it("should return error for invalid fee (negative)", () => {
    const params = {
      fee: "-0.001",
      timeout: 300,
    };

    const result = validateSendCollectibleTransactionParams(params);

    expect(result).toBe("transaction.errors.feeRequired");
  });

  it("should return error for invalid timeout (zero)", () => {
    const params = {
      fee: "0.001",
      timeout: 0,
    };

    const result = validateSendCollectibleTransactionParams(params);

    expect(result).toBe("transaction.errors.timeoutRequired");
  });

  it("should return error for invalid timeout (negative)", () => {
    const params = {
      fee: "0.001",
      timeout: -100,
    };

    const result = validateSendCollectibleTransactionParams(params);

    expect(result).toBe("transaction.errors.timeoutRequired");
  });

  it("should accept valid positive fee", () => {
    const params = {
      fee: "0.01",
      timeout: 300,
    };

    const result = validateSendCollectibleTransactionParams(params);

    expect(result).toBeNull();
  });

  it("should accept valid timeout", () => {
    const params = {
      fee: "0.001",
      timeout: 600,
    };

    const result = validateSendCollectibleTransactionParams(params);

    expect(result).toBeNull();
  });
});

describe("buildSwapTransaction — includeTrustline", () => {
  const issuer = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
  const senderAddress = Keypair.random().publicKey();

  const mockSourceBalance = {
    id: "XLM",
    token: { type: "native" },
    total: "100",
    available: { toString: () => "100" },
  } as any;

  const mockDestBalance = {
    id: `USDC:${issuer}`,
    token: {
      code: "USDC",
      issuer: { key: issuer },
      type: "credit_alphanum4",
    },
    total: "0",
    available: { toString: () => "0" },
  } as any;

  const baseParams = {
    sourceAmount: "10",
    sourceBalance: mockSourceBalance,
    destinationBalance: mockDestBalance,
    path: [],
    destinationAmount: "5",
    destinationAmountMin: "4.9",
    transactionFee: "0.001",
    transactionTimeout: 180,
    network: NETWORKS.PUBLIC,
    senderAddress,
  };

  it("prepends a changeTrust op when includeTrustline is provided", async () => {
    const { xdr: swapXdr } = await buildSwapTransaction({
      ...baseParams,
      includeTrustline: {
        tokenCode: "USDC",
        issuer,
      },
    });

    const tx = TransactionBuilder.fromXdr(
      swapXdr,
      Networks.PUBLIC,
    ) as Transaction;

    expect(tx.operations).toHaveLength(2);
    expect(tx.operations[0].type).toBe("changeTrust");
    expect(tx.operations[1].type).toBe("pathPaymentStrictSend");

    const trustlineOp = tx.operations[0] as Operation.ChangeTrust;
    const trustlineAsset = trustlineOp.line as Asset;
    expect(trustlineAsset.code).toBe("USDC");
    expect(trustlineAsset.issuer).toBe(
      "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    );

    // The user-set 0.001 XLM (10,000 stroops) is the TOTAL: it's split across
    // the 2 ops (5,000 stroops/op) so the charged total stays 10,000 — not
    // doubled to 20,000.
    expect(tx.fee).toBe("10000");
  });

  it("builds a single pathPaymentStrictSend op when includeTrustline is omitted (regression)", async () => {
    const { xdr: swapXdr } = await buildSwapTransaction(baseParams);

    const tx = TransactionBuilder.fromXdr(
      swapXdr,
      Networks.PUBLIC,
    ) as Transaction;

    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0].type).toBe("pathPaymentStrictSend");
    // Single op: total == the user-set 0.001 XLM (10,000 stroops).
    expect(tx.fee).toBe("10000");
  });
});
