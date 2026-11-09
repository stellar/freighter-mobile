import {
  Address,
  Asset,
  FeeBumpTransaction,
  Operation,
  Transaction,
  TransactionBuilder,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { isNativeAssetId } from "helpers/assetIdentity";

/** What the swap review shows, read from the transaction, not the quote. */
export interface DecodedSwapTx {
  /** Decimal amount of the sold asset the transaction spends */
  sendAmount: string;
  /** Decimal amount the transaction refuses to pay out less than */
  minReceived: string;
  /** XLM; for a Soroban swap this includes the resource fee */
  fee: string;
  addsTrustline: boolean;
}

// Classic assets and their contracts both use 7 decimals. Soroban-only
// tokens are refused below until the picker allows them (C3).
const CLASSIC_DECIMALS = 7;

const fromUnits = (value: bigint | string) =>
  new BigNumber(value.toString()).shiftedBy(-CLASSIC_DECIMALS).toFixed();

/** A `/swap/tx` transaction that is not the swap the client asked for. */
export class SwapTxMismatchError extends Error {
  constructor(what: string) {
    super(`Swap transaction does not match the request: ${what}`);
    this.name = "SwapTxMismatchError";
  }
}

const mismatch = (what: string) => new SwapTxMismatchError(what);

const toClassicAsset = (wire: string): Asset => {
  if (isNativeAssetId(wire)) return Asset.native();
  const [code, issuer, ...rest] = wire.split(":");
  if (!code || !issuer || rest.length) {
    throw new Error(`Swap: unsupported asset ${wire}`);
  }
  return new Asset(code, issuer);
};

const decodeClassic = (
  tx: Transaction,
  account: string,
  from: Asset,
  to: Asset,
): DecodedSwapTx => {
  const ops = tx.operations;
  const payment = ops[ops.length - 1];
  const changeTrust = ops.length === 2 ? ops[0] : null;
  if (ops.length > 2 || payment.type !== "pathPaymentStrictSend") {
    throw mismatch("operations");
  }
  if (
    !payment.sendAsset.equals(from) ||
    !payment.destAsset.equals(to) ||
    payment.destination !== account
  ) {
    throw mismatch("path payment");
  }
  if (
    changeTrust &&
    (changeTrust.type !== "changeTrust" ||
      !(changeTrust.line instanceof Asset) ||
      !changeTrust.line.equals(to))
  ) {
    throw mismatch("trustline");
  }
  return {
    sendAmount: new BigNumber(payment.sendAmount).toFixed(),
    minReceived: new BigNumber(payment.destMin).toFixed(),
    fee: fromUnits(tx.fee),
    addsTrustline: !!changeTrust,
  };
};

const contractCalls = (
  invocation: xdr.SorobanAuthorizedInvocation,
): xdr.InvokeContractArgs[] => {
  const fn = invocation.function;
  const own =
    fn.type === "sorobanAuthorizedFunctionTypeContractFn"
      ? [fn.contractFn]
      : [];
  return own.concat(...invocation.subInvocations.map(contractCalls));
};

/**
 * The LI.FI call is swap(params, receiver). The amount sold is what the
 * authorization tree lets the swap move out of the account (LI.FI's fee plus
 * the aggregator's input), since that is what the signature authorizes.
 */
const decodeLifi = (
  tx: Transaction,
  account: string,
  from: Asset,
  to: Asset,
  networkPassphrase: string,
): DecodedSwapTx => {
  const op = tx.operations[0] as Operation.InvokeHostFunction;
  if (op.func.type !== "hostFunctionTypeInvokeContract") {
    throw mismatch("host function");
  }
  const call = op.func.invokeContract;
  if (call.functionName.toString() !== "swap" || call.args.length !== 2) {
    throw mismatch("swap call");
  }
  const params = scValToNative(call.args[0]) as Record<string, unknown>;
  const fromContract = from.contractId(networkPassphrase);
  const toContract = to.contractId(networkPassphrase);
  if (
    scValToNative(call.args[1]) !== account ||
    params?.token_in !== fromContract ||
    params?.token_out !== toContract ||
    typeof params?.min_amount_out !== "bigint"
  ) {
    throw mismatch("swap call");
  }

  let sent = BigInt(0);
  let addsTrustline = false;
  (op.auth ?? [])
    .flatMap(({ rootInvocation }) => contractCalls(rootInvocation))
    .forEach((fn) => {
      const contract = Address.fromScAddress(fn.contractAddress).toString();
      const name = fn.functionName.toString();
      const firstArg = fn.args.length ? scValToNative(fn.args[0]) : undefined;
      if (firstArg !== account) return;
      if (name === "transfer") {
        const amount = scValToNative(fn.args[2]) as unknown;
        if (contract !== fromContract || typeof amount !== "bigint") {
          throw mismatch("transfer");
        }
        sent += amount;
      } else if (contract === toContract && name === "trust") {
        addsTrustline = true;
      }
    });
  if (sent <= BigInt(0)) {
    throw mismatch("amount");
  }

  return {
    sendAmount: fromUnits(sent),
    minReceived: fromUnits(params.min_amount_out),
    fee: fromUnits(tx.fee),
    addsTrustline,
  };
};

const decode = ({
  transactionXdr,
  networkPassphrase,
  account,
  fromAsset,
  toAsset,
}: {
  transactionXdr: string;
  networkPassphrase: string;
  account: string;
  /** Wire form: `XLM` or `CODE:ISSUER` */
  fromAsset: string;
  toAsset: string;
}): DecodedSwapTx => {
  const parsed = TransactionBuilder.fromXdr(transactionXdr, networkPassphrase);
  if (parsed instanceof FeeBumpTransaction) {
    throw mismatch("fee bump");
  }
  if (
    parsed.source !== account ||
    parsed.operations.some((op) => op.source && op.source !== account)
  ) {
    throw mismatch("source account");
  }
  const from = toClassicAsset(fromAsset);
  const to = toClassicAsset(toAsset);
  if (
    parsed.operations.length === 1 &&
    parsed.operations[0].type === "invokeHostFunction"
  ) {
    return decodeLifi(parsed, account, from, to, networkPassphrase);
  }
  return decodeClassic(parsed, account, from, to);
};

/**
 * Reads the review values out of a swap transaction from `/swap/tx`. Refuses
 * one that does not swap `fromAsset` into `toAsset` for and to `account`: a
 * classic path payment (after an optional changeTrust) or the LI.FI swap call.
 * A transaction it cannot read is a mismatch too.
 */
export const decodeSwapTx = (params: Parameters<typeof decode>[0]) => {
  try {
    return decode(params);
  } catch (error) {
    if (error instanceof SwapTxMismatchError) throw error;
    throw mismatch(
      `unreadable transaction (${error instanceof Error ? error.message : String(error)})`,
    );
  }
};
