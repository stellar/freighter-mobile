/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  MemoType,
  Memo,
  StrKey,
  TransactionBuilder,
  Operation,
  Transaction,
  Horizon,
  xdr,
  scValToNative,
  Asset,
} from "@stellar/stellar-sdk";
import { BigNumber } from "bignumber.js";
import { NATIVE_TOKEN_CODE, NetworkDetails, NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { Balance } from "config/types";

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
  amount: bigint | number;
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

export const getNativeContractDetails = (network: NETWORKS) => {
  const NATIVE_CONTRACT_DEFAULTS = {
    code: NATIVE_TOKEN_CODE,
    decimals: 7,
    domain: "https://stellar.org",
    icon: "",
    org: "",
  };

  switch (network) {
    case NETWORKS.PUBLIC:
      return {
        ...NATIVE_CONTRACT_DEFAULTS,
        contract: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
        issuer: "GDMTVHLWJTHSUDMZVVMXXH6VJHA2ZV3HNG5LYNAZ6RTWB7GISM6PGTUV",
      };
    case NETWORKS.TESTNET:
      return {
        ...NATIVE_CONTRACT_DEFAULTS,
        contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        issuer: "",
      };
    default:
      return { ...NATIVE_CONTRACT_DEFAULTS, contract: "", issuer: "" };
  }
};

export const addressToString = (address: xdr.ScAddress) => {
  if (address.switch().name === "scAddressTypeAccount") {
    return StrKey.encodeEd25519PublicKey(address.accountId().ed25519());
  }
  return StrKey.encodeContract(address.contractId() as unknown as Buffer);
};

export const getArgsForTokenInvocation = (
  fnName: string,
  args: xdr.ScVal[],
): ArgsForTokenInvocation => {
  let amount: bigint | number;
  let from = "";
  let to = "";

  switch (fnName) {
    case SorobanTokenInterface.transfer:
      from = addressToString(args[0].address());
      to = addressToString(args[1].address());
      amount = scValToNative(args[2]);
      break;
    case SorobanTokenInterface.mint:
      to = addressToString(args[0].address());
      amount = scValToNative(args[1]);
      break;
    default:
      amount = BigInt(0);
  }

  return { from, to, amount };
};

export const getTokenInvocationArgs = (
  hostFn: Operation.InvokeHostFunction,
): TokenInvocationArgs | null => {
  if (!hostFn?.func?.invokeContract) {
    return null;
  }

  let invokedContract: xdr.InvokeContractArgs;

  try {
    invokedContract = hostFn.func.invokeContract();
  } catch (e) {
    return null;
  }

  const contractId = StrKey.encodeContract(
    invokedContract.contractAddress().contractId() as unknown as Buffer,
  );
  const fnName = invokedContract.functionName().toString();
  const args = invokedContract.args();

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

const isSorobanOp = (operation: Horizon.ServerApi.OperationRecord) =>
  SOROBAN_OPERATION_TYPES.includes(operation.type);

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

  const transaction = TransactionBuilder.fromXDR(
    op.transaction_attr.envelope_xdr as string,
    networkDetails.networkPassphrase,
  ) as Transaction<Memo<MemoType>, Operation.InvokeHostFunction[]>;

  const invokeHostFn = transaction.operations[0]; // only one op per tx in Soroban right now

  return getTokenInvocationArgs(invokeHostFn);
};

export const getAssetSacAddress = (
  canonicalName: string,
  networkPassphrase: string,
) =>
  new Asset(...(canonicalName.split(":") as [string, string])).contractId(
    networkPassphrase,
  );

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
    let canonicalName = "";

    try {
      // if xlm, check for a SAC match
      if ("token" in balance && balance.token.code === NATIVE_TOKEN_CODE) {
        canonicalName = "native";
        const matchesSac =
          Asset.native().contractId(networkDetails.networkPassphrase) ===
          contractId;
        return matchesSac;
      }

      // if issuer is a G address, check for a SAC match
      if (
        "token" in balance &&
        "issuer" in balance.token &&
        !isContractId(balance.token.issuer.key)
      ) {
        const assetToken = balance.token;
        canonicalName = assetToken.issuer.key
          ? `${assetToken.code}:${assetToken.issuer.key}`
          : assetToken.code;
        const sacAddress = getAssetSacAddress(
          canonicalName,
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
export const formatTokenAmount = (amount: BigNumber, decimals: number) => {
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
