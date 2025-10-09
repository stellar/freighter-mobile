import {
  Keypair,
  Networks,
  TransactionBuilder,
  Address,
  Transaction,
  Operation,
} from "@stellar/stellar-sdk";
import { NETWORKS } from "config/constants";
import {
  buildSendCollectibleTransaction,
  BuildSendCollectibleParams,
} from "services/transactionService";

jest.mock("services/stellar", () => ({
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
