import {
  Asset,
  Keypair,
  Networks,
  TransactionBuilder,
  Address,
  Transaction,
  Operation,
  XdrLargeInt,
} from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { BlendRequestType } from "helpers/blend";
import { analytics } from "services/analytics";
import * as backend from "services/backend";
import {
  buildBlendDepositTransaction,
  buildSendCollectibleTransaction,
  BuildSendCollectibleParams,
  buildSwapTransaction,
  simulateCollectibleTransfer,
  validateSendCollectibleTransactionParams,
} from "services/transactionService";

jest.mock("services/stellar", () => ({
  ...jest.requireActual("services/stellar"),
  stellarSdkServer: jest.fn(() => ({
    loadAccount: jest.fn((publicKey: string) => ({
      accountId: () => publicKey,
      sequenceNumber: () => "1000",
      incrementSequenceNumber: jest.fn(),
    })),
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

    const parsedTx = TransactionBuilder.fromXDR(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;

    expect(parsedTx.source).toBe(mockSenderKeypair.publicKey());
  });

  it("should include invoke host function operation with transfer call", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    const parsedTx = TransactionBuilder.fromXDR(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;

    expect(parsedTx.operations).toHaveLength(1);
    expect(parsedTx.operations[0].type).toBe("invokeHostFunction");
  });

  it("should encode correct contract address in operation", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    const parsedTx = TransactionBuilder.fromXDR(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;

    const operation = parsedTx.operations[0] as Operation.InvokeHostFunction;
    const hostFunction = operation.func;

    expect(hostFunction.switch().name).toBe("hostFunctionTypeInvokeContract");

    const invokeContractArgs = hostFunction.invokeContract();
    const contractAddress = invokeContractArgs.contractAddress();
    const addressFromXdr = Address.fromScAddress(contractAddress);

    expect(addressFromXdr.toString()).toBe(mockCollectionAddress);
  });

  it("should call transfer function in the contract", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    const parsedTx = TransactionBuilder.fromXDR(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;

    const operation = parsedTx.operations[0] as Operation.InvokeHostFunction;
    const hostFunction = operation.func;
    const invokeContractArgs = hostFunction.invokeContract();
    const functionName = invokeContractArgs.functionName().toString();

    expect(functionName).toBe("transfer");
  });

  it("should encode correct transfer parameters: from, to, token_id", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    const parsedTx = TransactionBuilder.fromXDR(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;

    const operation = parsedTx.operations[0] as Operation.InvokeHostFunction;
    const hostFunction = operation.func;
    const invokeContractArgs = hostFunction.invokeContract();
    const args = invokeContractArgs.args();

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
    expect(tokenIdScVal.switch().name).toBe("scvU32");
    const tokenIdValue = tokenIdScVal.u32();
    expect(tokenIdValue.toString()).toBe("12345");
  });

  it("should use correct fee from parameters", async () => {
    const customFee = "0.002";
    const params = { ...baseParams, transactionFee: customFee };

    const result = await buildSendCollectibleTransaction(params);

    const parsedTx = TransactionBuilder.fromXDR(
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

    const parsedTx = TransactionBuilder.fromXDR(
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

    const parsedTx = TransactionBuilder.fromXDR(
      result.xdr,
      Networks.TESTNET,
    ) as Transaction;

    // Sequence number should be incremented from the loaded account
    // Our mock returns "1000", so the transaction should have "1001"
    expect(parsedTx.sequence).toBe("1001");
  });

  it("should create XDR that can be successfully parsed and rebuilt", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    const parsedTx = TransactionBuilder.fromXDR(result.xdr, Networks.TESTNET);

    const reExportedXdr = parsedTx.toXDR();
    expect(reExportedXdr).toBe(result.xdr);
  });

  it("should set correct timebounds", async () => {
    const result = await buildSendCollectibleTransaction(baseParams);

    const parsedTx = TransactionBuilder.fromXDR(
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
    const { xdr } = await buildSwapTransaction({
      ...baseParams,
      includeTrustline: {
        tokenCode: "USDC",
        issuer,
      },
    });

    const tx = TransactionBuilder.fromXDR(xdr, Networks.PUBLIC) as Transaction;

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
    const { xdr } = await buildSwapTransaction(baseParams);

    const tx = TransactionBuilder.fromXDR(xdr, Networks.PUBLIC) as Transaction;

    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0].type).toBe("pathPaymentStrictSend");
    // Single op: total == the user-set 0.001 XLM (10,000 stroops).
    expect(tx.fee).toBe("10000");
  });
});

describe("buildBlendDepositTransaction", () => {
  const USDC_SAC = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
  const SENDER = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
  // Mirrors config/blend.ts BLEND_FIXED_POOL_IDS[NETWORKS.PUBLIC].
  const POOL_ID = "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD";
  const mockPreparedXdr = "mock_prepared_blend_xdr";

  const baseParams = {
    senderAddress: SENDER,
    assetId: USDC_SAC,
    amount: "500",
    decimals: 7,
    network: NETWORKS.PUBLIC,
    transactionFee: "0.00001",
    transactionTimeout: 180,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (backend.simulateTransaction as jest.Mock).mockResolvedValue({
      preparedTransaction: mockPreparedXdr,
      simulationResponse: { minResourceFee: "546395" },
    });
  });

  it("rejects a network with no allowlisted pool", async () => {
    await expect(
      buildBlendDepositTransaction({
        ...baseParams,
        network: NETWORKS.FUTURENET,
      }),
    ).rejects.toThrow(/not supported/i);
  });

  it("scales the human amount by decimals into an integer string", () => {
    // 500 USDC at 7 decimals is 5_000_000_000 stroops-equivalent. An i128
    // cannot carry a fraction and exponential notation would not parse, so the
    // scaled value must be a plain integer string.
    const scaled = new BigNumber("500")
      .multipliedBy(new BigNumber(10).pow(7))
      .toFixed(0);
    expect(scaled).toBe("5000000000");
    expect(scaled).not.toMatch(/[.e+]/);
  });

  it("submits a SupplyCollateral request against the allowlisted pool with the scaled amount", async () => {
    const result = await buildBlendDepositTransaction(baseParams);

    expect(result.preparedXdr).toBe(mockPreparedXdr);
    expect(result.minResourceFee).toBe("546395");

    const parsedTx = TransactionBuilder.fromXDR(
      result.xdr,
      Networks.PUBLIC,
    ) as Transaction;

    expect(parsedTx.operations).toHaveLength(1);

    const operation = parsedTx.operations[0] as Operation.InvokeHostFunction;
    const hostFunction = operation.func;
    expect(hostFunction.switch().name).toBe("hostFunctionTypeInvokeContract");

    const invocation = hostFunction.invokeContract();
    expect(invocation.functionName().toString()).toBe("submit");
    expect(Address.fromScAddress(invocation.contractAddress()).toString()).toBe(
      POOL_ID,
    );

    // submit(from, spender, to, requests) — requests is a vec of one Request map.
    const requestScVal = invocation.args()[3].vec()![0];
    const requestEntries = requestScVal.map()!;
    const byKey = (name: string) =>
      requestEntries.find((e) => e.key().sym().toString() === name)!.val();

    expect(byKey("request_type").u32()).toBe(BlendRequestType.SupplyCollateral);
    expect(byKey("amount").toXDR("base64")).toBe(
      new XdrLargeInt("i128", "5000000000").toI128().toXDR("base64"),
    );

    // transactionFee is the INCLUSION fee only: 0.00001 XLM = 100 stroops.
    expect(parsedTx.fee).toBe("100");
  });

  it("returns minResourceFee as null when the simulation response omits it", async () => {
    (backend.simulateTransaction as jest.Mock).mockResolvedValue({
      preparedTransaction: mockPreparedXdr,
      simulationResponse: {},
    });

    const result = await buildBlendDepositTransaction(baseParams);

    // A missing minResourceFee is left unknown (null), never coerced to "0" —
    // a zero resource fee would understate the real cost and is
    // indistinguishable from a genuine zero.
    expect(result.minResourceFee).toBeNull();
  });

  it("throws a plain error when simulation succeeds with no prepared transaction", async () => {
    (backend.simulateTransaction as jest.Mock).mockResolvedValue({
      preparedTransaction: undefined,
      simulationResponse: {},
    });

    await expect(buildBlendDepositTransaction(baseParams)).rejects.toThrow(
      /simulate/i,
    );
  });
});
