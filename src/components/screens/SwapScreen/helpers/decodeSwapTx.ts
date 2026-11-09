import {
  Address,
  Asset,
  FeeBumpTransaction,
  Operation,
  StrKey,
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
  /**
   * Decimal amount the transaction refuses to pay out less than. Classic only:
   * where a Soroban call keeps its minimum is source-specific.
   */
  minReceived: string | undefined;
  /** XLM; for a Soroban swap this includes the resource fee */
  fee: string;
  addsTrustline: boolean;
}

const XLM_DECIMALS = 7;

const fromUnits = (value: bigint | string, decimals: number) =>
  new BigNumber(value.toString()).shiftedBy(-decimals).toFixed();

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

/** A wire asset: `classic` is null for a Soroban-only token. */
interface SwapToken {
  classic: Asset | null;
  contract: string;
}

const toSwapToken = (wire: string, networkPassphrase: string): SwapToken => {
  if (StrKey.isValidContract(wire)) return { classic: null, contract: wire };
  let classic: Asset;
  if (isNativeAssetId(wire)) {
    classic = Asset.native();
  } else {
    const [code, issuer, ...rest] = wire.split(":");
    if (!code || !issuer || rest.length) {
      throw mismatch(`unsupported asset ${wire}`);
    }
    classic = new Asset(code, issuer);
  }
  return { classic, contract: classic.contractId(networkPassphrase) };
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
  return {
    sendAmount: new BigNumber(payment.sendAmount).toFixed(),
    minReceived: new BigNumber(payment.destMin).toFixed(),
    fee: fromUnits(tx.fee, XLM_DECIMALS),
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
 * Any source's Soroban swap. Only the authorization tree is read, since it is
 * what the signature authorizes and every source must use it: the amount sold
 * is the sold token's transfers out of the account, and a trust() on the
 * bought token is the trustline. The call itself is source-specific and the
 * backend checks it, so a new source needs no client release. Only a classic
 * asset has a trustline, so a trust() on a Soroban-only token is refused.
 */
const decodeSoroban = (
  tx: Transaction,
  account: string,
  from: SwapToken,
  to: SwapToken,
  fromDecimals: number,
): DecodedSwapTx => {
  const op = tx.operations[0] as Operation.InvokeHostFunction;
  if (op.func.type !== "hostFunctionTypeInvokeContract") {
    throw mismatch("host function");
  }
  const fromContract = from.contract;
  const toContract = to.contract;

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
        if (
          contract !== fromContract ||
          typeof amount !== "bigint" ||
          amount < BigInt(0)
        ) {
          throw mismatch("transfer");
        }
        sent += amount;
      } else if (name === "trust") {
        if (contract !== toContract || !to.classic) {
          throw mismatch("trustline");
        }
        addsTrustline = true;
      }
    });
  if (sent <= BigInt(0)) {
    throw mismatch("amount");
  }

  return {
    sendAmount: fromUnits(sent, fromDecimals),
    minReceived: undefined,
    fee: fromUnits(tx.fee, XLM_DECIMALS),
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
  fromDecimals,
}: {
  transactionXdr: string;
  networkPassphrase: string;
  account: string;
  /** Wire form: `XLM`, `CODE:ISSUER` or a `C…` contract ID */
  fromAsset: string;
  toAsset: string;
  /** The `minOut` sent to `/swap/tx`; a classic destMin must meet it */
  minOut: string;
  /** The sold token's decimals: the unit of its authorized transfers */
  fromDecimals: number;
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
  const from = toSwapToken(fromAsset, networkPassphrase);
  const to = toSwapToken(toAsset, networkPassphrase);
  if (
    parsed.operations.length === 1 &&
    parsed.operations[0].type === "invokeHostFunction"
  ) {
    return decodeSoroban(parsed, account, from, to, fromDecimals);
  }
  if (!from.classic || !to.classic) {
    throw mismatch("operations");
  }
  const decoded = decodeClassic(parsed, account, from.classic, to.classic);
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
