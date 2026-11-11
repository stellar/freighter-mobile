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
import { formatTokenIdentifier } from "helpers/balances";

/** What the swap review shows, read from the transaction, not the quote. */
export interface DecodedSwapTx {
  /** Decimal amount of the sold asset the transaction spends */
  sendAmount: string;
  /**
   * Decimal amount the transaction refuses to pay out less than. Classic only:
   * where a Soroban call keeps its minimum is source-specific.
   */
  minReceived: string | undefined;
  /** XLM; for a Soroban swap this includes the resource fee */
  fee: string;
  addsTrustline: boolean;
}

// Classic assets and their contracts both use 7 decimals. Soroban-only
// tokens are refused below until the picker allows them (C3).
const CLASSIC_DECIMALS = 7;

const fromUnits = (value: bigint | string) =>
  new BigNumber(value.toString()).shiftedBy(-CLASSIC_DECIMALS).toFixed();

// The SDK's default changeTrust limit (Int64 max stroops). Anything lower
// edits an existing trustline rather than just opening one.
const MAX_TRUSTLINE_LIMIT = "922337203685.4775807";

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
  const { tokenCode, issuer } = formatTokenIdentifier(wire);
  try {
    return new Asset(tokenCode, issuer);
  } catch {
    throw mismatch(`unsupported asset ${wire}`);
  }
};

const decodeClassic = (
  tx: Transaction,
  account: string,
  from: Asset,
  to: Asset,
  amount: string,
): DecodedSwapTx => {
  const ops = tx.operations;
  const payment = ops[ops.length - 1];
  const changeTrust = ops.length === 2 ? ops[0] : null;
  if (ops.length > 2 || payment?.type !== "pathPaymentStrictSend") {
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
      !changeTrust.line.equals(to) ||
      changeTrust.limit !== MAX_TRUSTLINE_LIMIT)
  ) {
    throw mismatch("trustline");
  }
  if (!new BigNumber(payment.sendAmount).eq(amount)) {
    throw mismatch("amount");
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

// The SEP-41 / SAC calls an account authorizes for itself. Only the swap's
// own transfer and trust belong in the tree; any other grants the source
// something the user did not ask for.
const ACCOUNT_TOKEN_CALLS = new Set([
  "approve",
  "burn",
  "burn_from",
  "transfer",
  "transfer_from",
  "trust",
]);

/**
 * Any source's Soroban swap. Only the authorization tree is read, since it is
 * what the signature authorizes and every source must use it: the amount sold
 * is the sold token's transfers out of the account, and a trust() on the
 * bought token is the trustline. The call itself is source-specific and the
 * backend checks it, so a new source needs no client release.
 */
const decodeSoroban = (
  tx: Transaction,
  account: string,
  from: Asset,
  to: Asset,
  amount: string,
  networkPassphrase: string,
): DecodedSwapTx => {
  const op = tx.operations[0] as Operation.InvokeHostFunction;
  if (op.func.type !== "hostFunctionTypeInvokeContract") {
    throw mismatch("host function");
  }
  const fromContract = from.contractId(networkPassphrase);
  const toContract = to.contractId(networkPassphrase);

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
        const moved = scValToNative(fn.args[2]) as unknown;
        if (
          contract !== fromContract ||
          typeof moved !== "bigint" ||
          moved < BigInt(0)
        ) {
          throw mismatch("transfer");
        }
        sent += moved;
      } else if (name === "trust") {
        if (contract !== toContract) throw mismatch("trustline");
        addsTrustline = true;
      } else if (ACCOUNT_TOKEN_CALLS.has(name)) {
        throw mismatch(name);
      }
    });
  if (sent <= BigInt(0) || !new BigNumber(fromUnits(sent)).eq(amount)) {
    throw mismatch("amount");
  }

  return {
    sendAmount: fromUnits(sent),
    minReceived: undefined,
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
  minOut,
  amount,
}: {
  transactionXdr: string;
  networkPassphrase: string;
  account: string;
  /** Wire form: `XLM` or `CODE:ISSUER` */
  fromAsset: string;
  toAsset: string;
  /** The `minOut` sent to `/swap/tx`; a classic destMin must meet it */
  minOut: string;
  /** The `amount` sent to `/swap/tx`; the transaction must sell exactly it */
  amount: string;
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
    return decodeSoroban(parsed, account, from, to, amount, networkPassphrase);
  }
  const decoded = decodeClassic(parsed, account, from, to, amount);
  const wantMin = new BigNumber(minOut);
  if (
    !wantMin.isFinite() ||
    new BigNumber(decoded.minReceived ?? 0).lt(wantMin)
  ) {
    throw mismatch("minimum");
  }
  return decoded;
};

/**
 * Reads the review values out of a swap transaction from `/swap/tx`. Refuses
 * one that does not swap `fromAsset` into `toAsset` for and to `account`: a
 * classic path payment (after an optional changeTrust) or one Soroban call.
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
