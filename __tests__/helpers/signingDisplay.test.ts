import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  hash,
  Keypair,
  Networks,
  Operation,
  OperationRecord,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { G_ACCOUNT } from "__tests__/support/muxedContractFixtures";
import {
  sacTransferArgs,
  sacTransferInvocation,
  sacTransferPreimageXdr,
  sacTransferTransactionXdr,
  XLM_SAC_TESTNET,
} from "__tests__/support/sacTransferFixtures";
import { logger } from "config/logger";
import {
  assertInvocationDisplayable,
  assertOperationsDisplayable,
  isAuthEntryDisplayable,
} from "helpers/signingDisplay";
import { addressToString, scValToDisplayTokens } from "helpers/soroban";

// Both conversions are wrapped so a test can make one throw, which is what an
// arm the app can't stringify does. The wrappers call through by default.
jest.mock("helpers/soroban", () => {
  const actual = jest.requireActual("helpers/soroban");
  return {
    ...actual,
    addressToString: jest.fn(actual.addressToString),
    scValToDisplayTokens: jest.fn(actual.scValToDisplayTokens),
  };
});

const actualSoroban = jest.requireActual("helpers/soroban");

const DEPLOYER = "GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3";
const OWNER_CONTRACT =
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

/** Every `scValToDisplayTokens` call throws, as it does for an arm it can't render. */
const failTokens = () =>
  jest.mocked(scValToDisplayTokens).mockImplementation(() => {
    throw new Error("unsupported arm");
  });

/**
 * `addressToString` throws for `address` only, as it does for an address arm it
 * can't stringify. Matching on the string keeps the other conversions, and the
 * ones `scValToDisplayTokens` makes for itself, working.
 */
const failAddress = (address: string) =>
  jest.mocked(addressToString).mockImplementation((scAddress) => {
    const text = actualSoroban.addressToString(scAddress) as string;
    if (text === address) {
      throw new Error("unsupported address arm");
    }
    return text;
  });

/** The operation records of a testnet transaction carrying `operations`, parsed back from its XDR like a dApp's. */
const opsOf = (...operations: xdr.Operation[]): OperationRecord[] => {
  const builder = new TransactionBuilder(new Account(G_ACCOUNT, "0"), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  });
  operations.forEach((operation) => builder.addOperation(operation));

  return (
    TransactionBuilder.fromXdr(
      builder.setTimeout(0).build().toXdr(),
      Networks.TESTNET,
    ) as Transaction
  ).operations;
};

const transferOps = () =>
  (
    TransactionBuilder.fromXdr(
      sacTransferTransactionXdr(),
      Networks.TESTNET,
    ) as Transaction
  ).operations;

/** A V2 contract creation from wasm, with the transfer args as constructor args. */
const createWasmOps = () =>
  opsOf(
    Operation.createCustomContract({
      address: new Address(DEPLOYER),
      wasmHash: Buffer.alloc(32, 1),
      salt: Buffer.alloc(32, 2),
      constructorArgs: sacTransferArgs(),
    }),
  );

/** A CAP-85 creation from an external executable reference, with no constructor args. */
const createExternalRefOps = () =>
  opsOf(
    Operation.createCustomContract({
      address: new Address(DEPLOYER),
      externalRef: { owner: new Address(OWNER_CONTRACT), tag: "token-v2" },
      salt: Buffer.alloc(32, 2),
    }),
  );

/** A V1 creation of the native asset's contract: no preimage address, no constructor args. */
const createSacOps = () =>
  opsOf(Operation.createStellarAssetContract({ asset: Asset.native() }));

const withInvocation = (
  fn: xdr.SorobanAuthorizedFunction,
  subInvocations: xdr.SorobanAuthorizedInvocation[] = [],
) => new xdr.SorobanAuthorizedInvocation({ function: fn, subInvocations });

const contractFn = (args: xdr.ScVal[]) =>
  xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
    new xdr.InvokeContractArgs({
      contractAddress: new Address(XLM_SAC_TESTNET).toScAddress(),
      functionName: "transfer",
      args,
    }),
  );

const addressPreimage = () =>
  xdr.ContractIdPreimage.contractIdPreimageFromAddress(
    new xdr.ContractIdPreimageFromAddress({
      address: new Address(DEPLOYER).toScAddress(),
      salt: new xdr.Uint256Bytes(Buffer.alloc(32, 7)),
    }),
  );

/** A V2 creation invocation (what an auth entry names) with `constructorArgs`. */
const createV2Invocation = (constructorArgs: xdr.ScVal[]) =>
  withInvocation(
    xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeCreateContractV2HostFn(
      new xdr.CreateContractArgsV2({
        contractIdPreimage: addressPreimage(),
        executable: xdr.ContractExecutable.contractExecutableWasm(
          new xdr.Hash(Buffer.alloc(32, 1)),
        ),
        constructorArgs,
      }),
    ),
  );

/** The CAP-71 arm of an auth preimage, which binds the signer's address. */
const withAddressPreimageXdr = (signer: string) =>
  xdr.HashIdPreimage.envelopeTypeSorobanAuthorizationWithAddress(
    new xdr.HashIdPreimageSorobanAuthorizationWithAddress({
      networkId: new xdr.Hash(hash(Buffer.from(Networks.TESTNET))),
      nonce: BigInt(1),
      signatureExpirationLedger: 1000,
      address: new Address(signer).toScAddress(),
      invocation: sacTransferInvocation(),
    }),
  ).toXdr("base64");

beforeEach(() => {
  jest
    .mocked(scValToDisplayTokens)
    .mockReset()
    .mockImplementation(actualSoroban.scValToDisplayTokens);
  jest
    .mocked(addressToString)
    .mockReset()
    .mockImplementation(actualSoroban.addressToString);
  jest.mocked(logger.warn).mockClear();
  jest.mocked(logger.error).mockClear();
});

describe("assertOperationsDisplayable", () => {
  it("accepts a SAC transfer to a W address", () =>
    expect(() => assertOperationsDisplayable(transferOps())).not.toThrow());

  it("throws when an operation argument can't be converted", () => {
    failTokens();

    expect(() => assertOperationsDisplayable(transferOps())).toThrow(
      "unsupported arm",
    );
  });

  it("throws when the invoked contract's address can't be converted", () => {
    failAddress(XLM_SAC_TESTNET);

    expect(() => assertOperationsDisplayable(transferOps())).toThrow(
      "unsupported address arm",
    );
  });

  it("converts nothing for a classic payment", () => {
    failTokens();
    failAddress(G_ACCOUNT);
    const paymentOps = opsOf(
      Operation.payment({
        destination: G_ACCOUNT,
        asset: Asset.native(),
        amount: "1",
      }),
    );

    expect(() => assertOperationsDisplayable(paymentOps)).not.toThrow();
  });

  it("converts nothing for a wasm upload", () => {
    failTokens();
    failAddress(G_ACCOUNT);
    const uploadOps = opsOf(
      Operation.uploadContractWasm({ wasm: Buffer.from("0061736d", "hex") }),
    );

    expect(() => assertOperationsDisplayable(uploadOps)).not.toThrow();
  });

  describe("contract creation", () => {
    it("accepts a creation from wasm and one from an external reference", () => {
      expect(() => assertOperationsDisplayable(createWasmOps())).not.toThrow();
      expect(() =>
        assertOperationsDisplayable(createExternalRefOps()),
      ).not.toThrow();
    });

    it("throws when the deployer address can't be converted", () => {
      failAddress(DEPLOYER);

      expect(() => assertOperationsDisplayable(createWasmOps())).toThrow(
        "unsupported address arm",
      );
    });

    it("throws when an external executable's owner can't be converted", () => {
      failAddress(OWNER_CONTRACT);

      expect(() => assertOperationsDisplayable(createExternalRefOps())).toThrow(
        "unsupported address arm",
      );
    });

    it("converts an external executable's owner whatever the preimage is", () => {
      // An external reference with an asset preimage is decodable XDR, and the
      // details sheet still shows the owner, so the check can't depend on the
      // preimage being an address.
      const mismatched = opsOf(
        Operation.invokeHostFunction({
          func: xdr.HostFunction.hostFunctionTypeCreateContractV2(
            new xdr.CreateContractArgsV2({
              contractIdPreimage:
                xdr.ContractIdPreimage.contractIdPreimageFromAsset(
                  Asset.native().toXdrObject(),
                ),
              executable: xdr.ContractExecutable.contractExecutableExternalRef(
                new xdr.ContractExecutableExternalRef({
                  executableOwner: new Address(OWNER_CONTRACT).toScAddress(),
                  tag: "token-v2",
                }),
              ),
              constructorArgs: [],
            }),
          ),
        }),
      );
      failAddress(OWNER_CONTRACT);

      expect(() => assertOperationsDisplayable(mismatched)).toThrow(
        "unsupported address arm",
      );
    });

    it("throws when a constructor argument can't be converted", () => {
      failTokens();

      expect(() => assertOperationsDisplayable(createWasmOps())).toThrow(
        "unsupported arm",
      );
    });

    it("converts nothing for a Stellar asset contract, which has no address or constructor", () => {
      failTokens();
      failAddress(G_ACCOUNT);

      expect(() => assertOperationsDisplayable(createSacOps())).not.toThrow();
    });
  });
});

describe("assertInvocationDisplayable", () => {
  it("accepts a W transfer invocation", () =>
    expect(() =>
      assertInvocationDisplayable(sacTransferInvocation()),
    ).not.toThrow());

  it("throws when an invocation argument can't be converted", () => {
    failTokens();

    expect(() =>
      assertInvocationDisplayable(sacTransferInvocation()),
    ).toThrow();
  });

  it("reaches the arguments of a sub-invocation", () => {
    failTokens();
    // The root takes no arguments, so only its sub-invocation can throw.
    const nested = withInvocation(contractFn([]), [sacTransferInvocation()]);

    expect(() => assertInvocationDisplayable(nested)).toThrow(
      "unsupported arm",
    );
  });

  it("converts the constructor arguments of a contract creation", () => {
    expect(() =>
      assertInvocationDisplayable(createV2Invocation(sacTransferArgs())),
    ).not.toThrow();

    failTokens();

    expect(() =>
      assertInvocationDisplayable(createV2Invocation(sacTransferArgs())),
    ).toThrow("unsupported arm");
  });

  it("keeps an invocation it can't decode displayable, as the warning it renders", () => {
    failTokens();
    // A wasm executable paired with an asset preimage is decodable XDR but not
    // a creation the app can describe, so it becomes an `unrecognized` entry.
    const undecodable = withInvocation(
      xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeCreateContractV2HostFn(
        new xdr.CreateContractArgsV2({
          contractIdPreimage:
            xdr.ContractIdPreimage.contractIdPreimageFromAsset(
              Asset.native().toXdrObject(),
            ),
          executable: xdr.ContractExecutable.contractExecutableWasm(
            new xdr.Hash(Buffer.alloc(32, 1)),
          ),
          constructorArgs: [],
        }),
      ),
    );

    expect(() => assertInvocationDisplayable(undecodable)).not.toThrow();
  });
});

describe("isAuthEntryDisplayable", () => {
  it("is true for a W transfer preimage", () =>
    expect(isAuthEntryDisplayable(sacTransferPreimageXdr())).toBe(true));

  it("is false, and reports to Sentry, when an argument can't be converted", () => {
    failTokens();

    expect(isAuthEntryDisplayable(sacTransferPreimageXdr())).toBe(false);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("is false, with only a breadcrumb, for XDR that doesn't parse", () => {
    expect(isAuthEntryDisplayable("not-xdr")).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("is false, with only a breadcrumb, for a preimage that isn't an authorization", () => {
    const opIdPreimage = xdr.HashIdPreimage.envelopeTypeOpId(
      new xdr.HashIdPreimageOperationId({
        sourceAccount: Keypair.fromPublicKey(DEPLOYER).xdrAccountId(),
        seqNum: BigInt(1),
        opNum: 0,
      }),
    ).toXdr("base64");

    expect(isAuthEntryDisplayable(opIdPreimage)).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("converts the signer address a CAP-71 preimage binds", () => {
    expect(isAuthEntryDisplayable(withAddressPreimageXdr(DEPLOYER))).toBe(true);

    failAddress(DEPLOYER);

    expect(isAuthEntryDisplayable(withAddressPreimageXdr(DEPLOYER))).toBe(
      false,
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("converts no address for a legacy preimage, which binds none", () => {
    failAddress(DEPLOYER);

    expect(isAuthEntryDisplayable(sacTransferPreimageXdr())).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
