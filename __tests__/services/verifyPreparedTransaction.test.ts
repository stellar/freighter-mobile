import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Networks,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
  TimeoutInfinite,
  xdr,
} from "@stellar/stellar-sdk";
import {
  verifyFlatTransferPreparedTransaction,
  PreparedTransactionMismatchError,
} from "services/verifyPreparedTransaction";

const NETWORK = Networks.TESTNET;

const SOURCE = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 3));
const DESTINATION = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 2));
const ATTACKER = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 9));
const COLLECTION = StrKey.encodeContract(Buffer.alloc(32, 1));
const SAC = StrKey.encodeContract(Buffer.alloc(32, 7));
const TOKEN_ID = 1;

const newBuilder = (fee = BASE_FEE) =>
  new TransactionBuilder(new Account(SOURCE, "0"), {
    fee,
    networkPassphrase: NETWORK,
  });

// A flat collectible transfer built with no authorization entries.
const buildFlatTransferXdr = (): string => {
  const params = [
    new Address(SOURCE).toScVal(),
    new Address(DESTINATION).toScVal(),
    xdr.ScVal.scvU32(TOKEN_ID),
  ];
  return newBuilder()
    .addOperation(new Contract(COLLECTION).call("transfer", ...params))
    .setTimeout(TimeoutInfinite)
    .build()
    .toXDR();
};

const invokeContractArgs = (
  contractId: string,
  fn: string,
  args: xdr.ScVal[],
) =>
  new xdr.InvokeContractArgs({
    contractAddress: new Address(contractId).toScAddress(),
    functionName: fn,
    args,
  });

const authorizedInvocation = (
  contractId: string,
  fn: string,
  args: xdr.ScVal[],
  subInvocations: xdr.SorobanAuthorizedInvocation[] = [],
) =>
  new xdr.SorobanAuthorizedInvocation({
    function:
      xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        invokeContractArgs(contractId, fn, args),
      ),
    subInvocations,
  });

const rootTransferInvocation = (
  subInvocations: xdr.SorobanAuthorizedInvocation[] = [],
) =>
  authorizedInvocation(
    COLLECTION,
    "transfer",
    [
      new Address(SOURCE).toScVal(),
      new Address(DESTINATION).toScVal(),
      xdr.ScVal.scvU32(TOKEN_ID),
    ],
    subInvocations,
  );

const sourceAccountAuth = (subInvocations: xdr.SorobanAuthorizedInvocation[]) =>
  new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation: rootTransferInvocation(subInvocations),
  });

const addressCredentialsAuth = () =>
  new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(ATTACKER).toScAddress(),
        nonce: xdr.Int64.fromString("0"),
        signatureExpirationLedger: 0,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: rootTransferInvocation(),
  });

// Rebuild the transaction the way an assembling backend does: reuse the invoked
// host function verbatim (or tamper with it), set a fee, and attach auth entries.
const buildPreparedXdr = (
  builtXdr: string,
  auth: xdr.SorobanAuthorizationEntry[],
  {
    tamperFunc = false,
    fee = BASE_FEE,
  }: { tamperFunc?: boolean; fee?: string } = {},
): string => {
  const built = TransactionBuilder.fromXDR(builtXdr, NETWORK) as Transaction;
  const builtOp = built.operations[0];
  if (builtOp.type !== "invokeHostFunction") {
    throw new Error("test setup: expected invokeHostFunction");
  }

  const func = tamperFunc
    ? xdr.HostFunction.hostFunctionTypeInvokeContract(
        invokeContractArgs(COLLECTION, "transfer", [
          new Address(SOURCE).toScVal(),
          new Address(ATTACKER).toScVal(),
          xdr.ScVal.scvU32(TOKEN_ID),
        ]),
      )
    : builtOp.func;

  return newBuilder(fee)
    .addOperation(Operation.invokeHostFunction({ func, auth }))
    .setTimeout(0)
    .build()
    .toXDR();
};

const verify = (builtXdr: string, preparedXdr: string, maxResourceFee = "0") =>
  verifyFlatTransferPreparedTransaction({
    builtTransactionXdr: builtXdr,
    preparedTransactionXdr: preparedXdr,
    networkPassphrase: NETWORK,
    maxResourceFee,
  });

describe("verifyFlatTransferPreparedTransaction", () => {
  it("accepts an honest flat transfer (source-account auth, no sub-invocations)", () => {
    const builtXdr = buildFlatTransferXdr();
    const preparedXdr = buildPreparedXdr(builtXdr, [sourceAccountAuth([])]);

    expect(() => verify(builtXdr, preparedXdr)).not.toThrow();
  });

  it("accepts a transfer with no auth entries at all", () => {
    const builtXdr = buildFlatTransferXdr();
    const preparedXdr = buildPreparedXdr(builtXdr, []);

    expect(() => verify(builtXdr, preparedXdr)).not.toThrow();
  });

  it("accepts a fee raised by up to the simulated resource fee", () => {
    const builtXdr = buildFlatTransferXdr(); // fee = BASE_FEE (100)
    const preparedXdr = buildPreparedXdr(builtXdr, [sourceAccountAuth([])], {
      fee: "600",
    });

    expect(() => verify(builtXdr, preparedXdr, "500")).not.toThrow();
  });

  it("rejects sub-invocations injected under the source-account entry", () => {
    const builtXdr = buildFlatTransferXdr();
    const drain = authorizedInvocation(SAC, "transfer", [
      new Address(SOURCE).toScVal(),
      new Address(ATTACKER).toScVal(),
      xdr.ScVal.scvI128(
        new xdr.Int128Parts({
          hi: xdr.Int64.fromString("0"),
          lo: xdr.Uint64.fromString("99884944477"),
        }),
      ),
    ]);
    const preparedXdr = buildPreparedXdr(builtXdr, [
      sourceAccountAuth([drain]),
    ]);

    expect(() => verify(builtXdr, preparedXdr)).toThrow(
      PreparedTransactionMismatchError,
    );
  });

  it("rejects a tampered invoked host function (different arguments)", () => {
    const builtXdr = buildFlatTransferXdr();
    const preparedXdr = buildPreparedXdr(builtXdr, [sourceAccountAuth([])], {
      tamperFunc: true,
    });

    expect(() => verify(builtXdr, preparedXdr)).toThrow(/host function/);
  });

  it("rejects a fee larger than the built fee plus the simulated resource fee", () => {
    const builtXdr = buildFlatTransferXdr(); // fee = BASE_FEE (100)
    const preparedXdr = buildPreparedXdr(builtXdr, [sourceAccountAuth([])], {
      fee: "100000000",
    });

    expect(() => verify(builtXdr, preparedXdr, "500")).toThrow(/fee/);
  });

  it("rejects non-source-account (address) credentials", () => {
    const builtXdr = buildFlatTransferXdr();
    const preparedXdr = buildPreparedXdr(builtXdr, [addressCredentialsAuth()]);

    expect(() => verify(builtXdr, preparedXdr)).toThrow(/source-account/);
  });
});
