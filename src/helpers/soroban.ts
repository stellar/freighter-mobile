/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  StrKey,
  TransactionBuilder,
  Operation,
  OperationRecord,
  Transaction,
  Horizon,
  xdr,
  scValToNative,
  Asset as SdkToken,
  walkInvocationTree,
  Address,
} from "@stellar/stellar-sdk";
import { BigNumber } from "bignumber.js";
import {
  mapNetworkToNetworkDetails,
  NATIVE_TOKEN_CODE,
  NetworkDetails,
  NETWORKS,
} from "config/constants";
import { logger } from "config/logger";
import { Balance } from "config/types";
import {
  getNativeContractId,
  isNativeContract,
  isNativeToken,
} from "helpers/assetIdentity";

export const SOROBAN_OPERATION_TYPES = [
  "invoke_host_function",
  "invokeHostFunction",
];

export enum SorobanTokenInterface {
  transfer = "transfer",
  mint = "mint",
}

export type ArgsForTokenInvocation = {
  from: string;
  to: string;
  amount?: bigint | number;
  tokenId?: number;
};

export type TokenInvocationArgs = ArgsForTokenInvocation & {
  fnName: SorobanTokenInterface;
  contractId: string;
};

export interface SorobanToken {
  // only currently holds fields we care about
  transfer: (from: string, to: string, amount: number) => void;
  mint: (to: string, amount: number) => void;
  // values below are in storage
  name: string;
  balance: number;
  symbol: string;
  decimals: number;
}

export const isContractId = (contractId: string) => {
  try {
    StrKey.decodeContract(contractId);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Checks if a transaction is a Soroban transaction.
 * A transaction is considered Soroban if:
 * - The selected balance is a Soroban token (has a contractId), OR
 * - The recipient address is a contract address
 *
 * @param selectedBalance - The selected balance (can be undefined)
 * @param recipientAddress - The recipient address (can be undefined)
 * @returns True if the transaction is a Soroban transaction, false otherwise
 */
export const isSorobanTransaction = (
  selectedBalance?: Balance,
  recipientAddress?: string,
): boolean =>
  Boolean(
    (selectedBalance &&
      "contractId" in selectedBalance &&
      Boolean(selectedBalance.contractId)) ||
      (recipientAddress && isContractId(recipientAddress)),
  );

/**
 * Returns the total fee in XLM for display.
 * For Soroban: inclusion + resource. For classic: the flat transactionFee.
 */
export const computeTotalFeeXlm = (
  sorobanInclusionFeeXlm: string | null,
  sorobanResourceFeeXlm: string | null,
  transactionFee: string,
): string =>
  sorobanInclusionFeeXlm && sorobanResourceFeeXlm
    ? new BigNumber(sorobanInclusionFeeXlm)
        .plus(sorobanResourceFeeXlm)
        .toString()
    : transactionFee;

export const getNativeContractDetails = (network: NETWORKS) => {
  const NATIVE_CONTRACT_DEFAULTS = {
    code: NATIVE_TOKEN_CODE,
    decimals: 7,
    domain: "https://stellar.org",
    icon: "",
    org: "",
  };

  // The native SAC address derives deterministically from the network
  // passphrase, which keeps every network correct.
  const contract = getNativeContractId(
    mapNetworkToNetworkDetails(network).networkPassphrase,
  );

  switch (network) {
    case NETWORKS.PUBLIC:
      return {
        ...NATIVE_CONTRACT_DEFAULTS,
        contract,
        issuer: "GDMTVHLWJTHSUDMZVVMXXH6VJHA2ZV3HNG5LYNAZ6RTWB7GISM6PGTUV",
      };
    default:
      return { ...NATIVE_CONTRACT_DEFAULTS, contract, issuer: "" };
  }
};

export const addressToString = (address: xdr.ScAddress) => {
  if (address.type === "scAddressTypeAccount") {
    return StrKey.encodeEd25519PublicKey(address.accountId.ed25519.toBytes());
  }
  return Address.fromScAddress(address).toString();
};

/**
 * Narrows an ScVal to its SCV_ADDRESS arm.
 *
 * Pre-v17 the generated arm accessor (`scVal.address()`) threw when the union
 * carried a different arm; `expectUnionVariant` preserves that contract now
 * that arms are plain properties on variant classes.
 *
 * @throws TypeError if the value is not an SCV_ADDRESS
 */
export const scValToAddress = (scVal: xdr.ScVal): xdr.ScAddress =>
  xdr.expectUnionVariant(scVal, "scvAddress").address;

/**
 * Extracts the address credentials from a SorobanCredentials union, handling
 * all CAP-71 address arms. Returns null for source-account credentials, which
 * carry no address payload.
 */
export const getAddressCredentials = (
  credentials: xdr.SorobanCredentials,
): xdr.SorobanAddressCredentials | null => {
  switch (credentials.type) {
    case "sorobanCredentialsAddress":
      return credentials.address;
    case "sorobanCredentialsAddressV2":
      return credentials.addressV2;
    case "sorobanCredentialsAddressWithDelegates":
      return credentials.addressWithDelegates.addressCredentials;
    default:
      return null;
  }
};

/**
 * Returns the address a Soroban authorization entry is bound to (the address
 * whose authorization its credentials represent), or undefined for
 * source-account credentials.
 */
export const getAuthEntryBoundAddress = (
  entry: xdr.SorobanAuthorizationEntry,
): string | undefined => {
  const addressCredentials = getAddressCredentials(entry.credentials);
  return addressCredentials
    ? addressToString(addressCredentials.address)
    : undefined;
};

export const getArgsForTokenInvocation = (
  fnName: string,
  args: xdr.ScVal[],
): ArgsForTokenInvocation => {
  let tokenId: number | undefined;
  let amount: bigint | number | undefined;
  let from = "";
  let to = "";

  const thirdArgType = args[2].type;
  switch (fnName) {
    case SorobanTokenInterface.transfer:
      // both SEP-41 & SEP-50 tokens use the transfer method
      // with different signatures. Without parsing the token spec,
      // we can guess that the contract is either a token or a collectible
      // by the type of the 3rd argument.
      // Token transfer - (from: Address, to: Address, amount: i128)
      // Collectible transfer - (from: Address, to: Address, tokenId: u32)
      if (thirdArgType === "scvI128") {
        amount = scValToNative(args[2]);
      }
      if (thirdArgType === "scvU32") {
        tokenId = scValToNative(args[2]);
      }

      from = addressToString(scValToAddress(args[0]));
      to = addressToString(scValToAddress(args[1]));
      break;
    case SorobanTokenInterface.mint:
      to = addressToString(scValToAddress(args[0]));
      amount = scValToNative(args[1]);
      break;
    default:
      amount = BigInt(0);
  }

  return { from, to, amount, tokenId };
};

export const getTokenInvocationArgs = (
  hostFn: Operation.InvokeHostFunction,
): TokenInvocationArgs | null => {
  const func = hostFn?.func;
  if (!func || func.type !== "hostFunctionTypeInvokeContract") {
    return null;
  }

  const invokedContract: xdr.InvokeContractArgs = func.invokeContract;

  const contractId = Address.fromScAddress(
    invokedContract.contractAddress,
  ).toString();
  const fnName = invokedContract.functionName.toString();
  const { args } = invokedContract;

  if (
    fnName !== SorobanTokenInterface.transfer &&
    fnName !== SorobanTokenInterface.mint
  ) {
    return null;
  }

  let opArgs: ArgsForTokenInvocation;

  try {
    opArgs = getArgsForTokenInvocation(fnName, args);
  } catch (e) {
    return null;
  }

  return {
    fnName,
    contractId,
    ...opArgs,
  };
};

export const isSorobanOp = (
  operation: Horizon.ServerApi.OperationRecord | OperationRecord,
) => SOROBAN_OPERATION_TYPES.includes(operation.type);

export const hasSorobanOperations = (
  transaction: ReturnType<typeof TransactionBuilder.fromXdr>,
) => transaction.operations.some((operation) => isSorobanOp(operation));

export const getAttrsFromSorobanHorizonOp = (
  operation: Horizon.ServerApi.OperationRecord,
  networkDetails: NetworkDetails,
) => {
  if (!isSorobanOp(operation)) {
    return null;
  }

  const op = operation as any;

  if (op.transaction_attr.contractId) {
    return {
      contractId: op.transaction_attr.contractId,
      fnName: op.transaction_attr.fnName,
      ...op.transaction_attr.args,
    };
  }

  const transaction = TransactionBuilder.fromXdr(
    op.transaction_attr.envelope_xdr as string,
    networkDetails.networkPassphrase,
  ) as Transaction;

  // only one op per tx in Soroban right now
  const invokeHostFn = transaction
    .operations[0] as Operation.InvokeHostFunction;

  return getTokenInvocationArgs(invokeHostFn);
};

/**
 * Derive a classic asset's Stellar Asset Contract (SAC) C-address. The SAC
 * address is deterministic — same (code, issuer, network) always resolves
 * to the same C-address, regardless of whether the asset has been wrapped
 * on-chain yet.
 *
 * Throws via `new SdkToken(...)` for invalid input (e.g. asset code longer
 * than 12 chars). Callers that pass user-supplied codes/issuers should
 * guard with a try/catch.
 */
export const getTokenSacAddress = (
  tokenCode: string,
  issuer: string,
  networkPassphrase: string,
) => new SdkToken(tokenCode, issuer).contractId(networkPassphrase);

/*
  Attempts to match a balance to a related contract ID, expects a token or SAC contract ID.
*/
export const getBalanceByKey = (
  contractId: string,
  balances: Balance[],
  networkDetails: NetworkDetails,
) => {
  const foundBalance = balances.find((balance) => {
    const matchesIssuer =
      "contractId" in balance && contractId === balance.contractId;

    try {
      // The native arm is entered only for the native-typed balance; every
      // other balance is matched by its own SAC below.
      if ("token" in balance && isNativeToken(balance.token)) {
        return isNativeContract(contractId, networkDetails.networkPassphrase);
      }

      // if issuer is a G address, check for a SAC match
      if (
        "token" in balance &&
        "issuer" in balance.token &&
        !isContractId(balance.token.issuer.key)
      ) {
        const sacAddress = getTokenSacAddress(
          balance.token.code,
          balance.token.issuer.key,
          networkDetails.networkPassphrase,
        );
        const matchesSac = contractId === sacAddress;
        return matchesSac;
      }
    } catch (e) {
      logger.error("getBalanceByKey", "Error checking for SAC match", e);
    }
    return matchesIssuer;
  });

  return foundBalance;
};

// Adopted from https://github.com/ethers-io/ethers.js/blob/master/packages/bignumber/src.ts/fixednumber.ts#L27
export const formatTokenForDisplay = (amount: BigNumber, decimals: number) => {
  let formatted = amount.toString();

  if (decimals > 0) {
    formatted = amount.shiftedBy(-decimals).toFixed(decimals).toString();

    // Trim trailing zeros
    while (formatted[formatted.length - 1] === "0") {
      formatted = formatted.substring(0, formatted.length - 1);
    }

    if (formatted.endsWith(".")) {
      formatted = formatted.substring(0, formatted.length - 1);
    }
  }

  return formatted;
};

export const INVOCATION_TYPE_INVOKE = "invoke" as const;
export const INVOCATION_TYPE_WASM = "wasm" as const;
export const INVOCATION_TYPE_SAC = "sac" as const;
/** CAP-85 (Protocol 28): contract created from an external executable reference. */
export const INVOCATION_TYPE_EXTERNAL_REF = "externalRef" as const;
/** An invocation whose contents could not be decoded. */
export const INVOCATION_TYPE_UNRECOGNIZED = "unrecognized" as const;

export interface FnArgsInvoke {
  type: typeof INVOCATION_TYPE_INVOKE;
  fnName: string;
  contractId: string;
  args: xdr.ScVal[];
}

export interface FnArgsCreateWasm {
  type: typeof INVOCATION_TYPE_WASM;
  salt: string;
  hash: string;
  address: string;
  args?: xdr.ScVal[];
}

export interface FnArgsCreateSac {
  type: typeof INVOCATION_TYPE_SAC;
  asset: string;
  args?: xdr.ScVal[];
}

/**
 * A CAP-85 (Protocol 28) contract creation whose executable is a reference
 * into another contract's storage rather than a wasm hash. `owner` and `tag`
 * identify the reference; the code behind it is chosen by the owner at
 * invocation time and can change after this entry is signed, so there is
 * deliberately no wasm hash here. `tag` is the SEP-51 JSON form of the
 * SCString so a non-UTF-8 tag stays distinguishable (e.g. `\xff\xfe`) instead
 * of collapsing to replacement characters.
 */
export interface FnArgsCreateExternalRef {
  type: typeof INVOCATION_TYPE_EXTERNAL_REF;
  owner: string;
  tag: string;
  address: string;
  salt: string;
  args?: xdr.ScVal[];
}

/** An invocation whose contents we could not decode. */
export interface FnArgsUnrecognized {
  type: typeof INVOCATION_TYPE_UNRECOGNIZED;
}

export type InvocationArgs =
  | FnArgsInvoke
  | FnArgsCreateWasm
  | FnArgsCreateSac
  | FnArgsCreateExternalRef
  | FnArgsUnrecognized;

const isInvocationArg = (
  invocation: InvocationArgs | undefined,
): invocation is InvocationArgs => !!invocation;

/**
 * Decodes a single authorized invocation into the shape the signing screens
 * render.
 *
 * Returns `undefined` for function types we do not render. For contract
 * creations, decodes the wasm, Stellar-asset, and CAP-85 (Protocol 28)
 * external-reference executables; the `externalRef` arm reports the owner and
 * tag but deliberately no wasm hash, since the owner can change the code the
 * reference resolves to after signing.
 *
 * Throws when the creation is not something we can safely describe: an
 * executable paired with the wrong contract-id preimage (wasm or external ref
 * without an address preimage, Stellar asset without an asset preimage), or an
 * executable type this build does not know. Callers that must not fail the
 * whole view should catch and substitute `FnArgsUnrecognized` (see
 * `getInvocationDetails`).
 */
export const getInvocationArgs = (
  invocation: xdr.SorobanAuthorizedInvocation,
): InvocationArgs | undefined => {
  const fn = invocation.function;

  switch (fn.type) {
    case "sorobanAuthorizedFunctionTypeContractFn": {
      const invocationItem = fn.contractFn;
      const contractId = Address.fromScAddress(
        invocationItem.contractAddress,
      ).toString();
      const fnName = invocationItem.functionName.toString();
      const { args } = invocationItem;
      return { fnName, contractId, args, type: INVOCATION_TYPE_INVOKE };
    }

    case "sorobanAuthorizedFunctionTypeCreateContractV2HostFn":
    case "sorobanAuthorizedFunctionTypeCreateContractHostFn": {
      const isCreateV2 =
        fn.type === "sorobanAuthorizedFunctionTypeCreateContractV2HostFn";
      const invocationItem: xdr.CreateContractArgs | xdr.CreateContractArgsV2 =
        fn.type === "sorobanAuthorizedFunctionTypeCreateContractV2HostFn"
          ? fn.createContractV2HostFn
          : fn.createContractHostFn;
      const exec = invocationItem.executable;
      const preimage = invocationItem.contractIdPreimage;

      switch (exec.type) {
        case "contractExecutableWasm": {
          // A wasm executable must be paired with an address preimage: the
          // contract id is derived from deployer + salt. The two arms are
          // independent in XDR, so the invalid pairings are representable.
          if (preimage.type !== "contractIdPreimageFromAddress") {
            throw new Error(
              `creation function appears invalid: a wasm executable is paired with ${preimage.type} (should be wasm+address or token+asset)`,
            );
          }
          const details = preimage.fromAddress;

          const contractDetails = {
            type: INVOCATION_TYPE_WASM,
            salt: xdr.encodeBytes(details.salt.toBytes(), "hex"),
            hash: xdr.encodeBytes(exec.wasmHash.toBytes(), "hex"),
            address: Address.fromScAddress(details.address).toString(),
          } as FnArgsCreateWasm;

          if (isCreateV2) {
            contractDetails.args = (
              invocationItem as xdr.CreateContractArgsV2
            ).constructorArgs;
          }

          return contractDetails;
        }

        case "contractExecutableStellarAsset": {
          // A SAC is only ever derived from the asset it wraps.
          if (preimage.type !== "contractIdPreimageFromAsset") {
            throw new Error(
              `creation function appears invalid: a Stellar asset executable is paired with ${preimage.type} (should be wasm+address or token+asset)`,
            );
          }
          const sacDetails = {
            type: INVOCATION_TYPE_SAC,
            asset: SdkToken.fromOperation(preimage.fromAsset).toString(),
          } as FnArgsCreateSac;

          if (isCreateV2) {
            sacDetails.args = (
              invocationItem as xdr.CreateContractArgsV2
            ).constructorArgs;
          }

          return sacDetails;
        }

        // CAP-85 (Protocol 28): the executable is a reference to a Wasm hash
        // held by another contract, resolved on-chain at creation time.
        case "contractExecutableExternalRef": {
          // Like wasm, an external reference deploys from an address; the SDK's
          // own invocation decoder rejects every other pairing, so do the same
          // rather than rendering an invalid authorization as a normal
          // contract creation.
          if (preimage.type !== "contractIdPreimageFromAddress") {
            throw new Error(
              `creation function appears invalid: an external executable reference is paired with ${preimage.type} (should be wasm+address, external ref+address, or token+asset)`,
            );
          }
          const details = preimage.fromAddress;
          const { executableOwner, tag } = exec.externalRef;

          const externalRefDetails = {
            type: INVOCATION_TYPE_EXTERNAL_REF,
            owner: Address.fromScAddress(executableOwner).toString(),
            // SEP-51 form: reversible for non-UTF-8 bytes, plain text otherwise.
            tag: tag.toJson(),
            address: Address.fromScAddress(details.address).toString(),
            salt: xdr.encodeBytes(details.salt.toBytes(), "hex"),
          } as FnArgsCreateExternalRef;

          if (isCreateV2) {
            externalRefDetails.args = (
              invocationItem as xdr.CreateContractArgsV2
            ).constructorArgs;
          }

          return externalRefDetails;
        }

        default:
          throw new Error(`unknown creation type: ${JSON.stringify(exec)}`);
      }
    }

    default: {
      return undefined;
    }
  }
};

export const getInvocationDetails = (
  invocation: xdr.SorobanAuthorizedInvocation,
): InvocationArgs[] => {
  const invocations = [] as InvocationArgs[];

  walkInvocationTree(invocation, (inv) => {
    try {
      const args = getInvocationArgs(inv);
      if (args) {
        invocations.push(args);
      }
    } catch (error) {
      // An invocation we cannot decode must not take down the whole signing
      // view -- surface it so the user sees that something was unreadable.
      //
      // `error` rather than `warn` (unlike the XDR-parse failures upstream):
      // the XDR itself parsed, so reaching here means either our decoder is
      // missing an executable/preimage arm the network now accepts, or a dApp
      // is asking the user to sign a creation the SDK considers invalid. Both
      // warrant an engineer's attention, and volume is bounded by user-initiated
      // sign requests.
      logger.error("soroban", "Failed to decode authorized invocation", error);
      invocations.push({ type: INVOCATION_TYPE_UNRECOGNIZED });
    }

    return null;
  });

  return invocations.filter(isInvocationArg);
};

export const scValByType = (scVal: xdr.ScVal): any => {
  switch (scVal.type) {
    case "scvAddress": {
      const { address } = scVal;
      if (address.type === "scAddressTypeAccount") {
        return StrKey.encodeEd25519PublicKey(
          address.accountId.ed25519.toBytes(),
        );
      }
      return Address.fromScAddress(address).toString();
    }

    case "scvBool": {
      return scVal.b;
    }

    case "scvBytes": {
      return xdr.encodeBytes(scVal.bytes.toBytes(), "hex");
    }

    case "scvContractInstance": {
      const { executable } = scVal.instance;
      return executable.type === "contractExecutableWasm"
        ? xdr.encodeBytes(executable.wasmHash.toBytes(), "hex")
        : undefined;
    }

    case "scvError": {
      return scVal.error.value;
    }

    case "scvTimepoint":
    case "scvDuration":
    case "scvI128":
    case "scvI256":
    case "scvI32":
    case "scvI64":
    case "scvU128":
    case "scvU256":
    case "scvU32":
    case "scvU64": {
      return scValToNative(scVal).toString();
    }

    case "scvLedgerKeyNonce": {
      return scVal.nonceKey.nonce.toString();
    }

    case "scvLedgerKeyContractInstance": {
      // void arm — carries no payload
      return null;
    }

    case "scvVec":
    case "scvMap": {
      return JSON.stringify(
        scValToNative(scVal),
        (_, val) => (typeof val === "bigint" ? val.toString() : val),
        2,
      );
    }

    // CAP-85 (Protocol 28): an executable tag is an SCString. Use the SEP-51
    // JSON form so a non-UTF-8 tag stays distinguishable instead of decoding
    // to replacement characters.
    case "scvExecutableTag": {
      return scVal.executableTag.toJson();
    }

    case "scvString":
    case "scvSymbol": {
      const native = scValToNative(scVal);
      // v17: scValToNative returns Uint8Array (not a lossy string) when the
      // XDR string/symbol payload is not valid UTF-8.
      if (native instanceof Uint8Array) {
        return xdr.encodeBytes(native, "hex");
      }
      return native;
    }

    case "scvVoid": {
      return null;
    }

    default:
      return null;
  }
};

export const getCreateContractArgs = (hostFunction: xdr.HostFunction) => {
  if (hostFunction.type !== "hostFunctionTypeCreateContractV2") {
    // Pre-v17 the generated `createContract()` arm accessor threw for any
    // other host function type; keep that contract.
    const args = xdr.expectUnionVariant(
      hostFunction,
      "hostFunctionTypeCreateContract",
    ).createContract;

    return {
      contractIdPreimage: args.contractIdPreimage,
      executable: args.executable,
    };
  }

  const argsV2 = hostFunction.createContractV2;

  return {
    contractIdPreimage: argsV2.contractIdPreimage,
    executable: argsV2.executable,
    constructorArgs: argsV2.constructorArgs,
  };
};
