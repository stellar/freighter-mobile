import {
  Address,
  Asset,
  FeeBumpTransaction,
  Operation,
  Transaction,
  TransactionBuilder,
  scValToNative,
} from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { DEFAULT_DECIMALS, NetworkDetails } from "config/constants";
import { isNativeAssetId } from "helpers/assetIdentity";
import { BlendRequestType } from "helpers/blend";
import { SOROBAN_OPERATION_TYPES } from "helpers/soroban";

/** What a row in a position's Activity list says happened. */
export enum PositionActivityType {
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",
}

/**
 * One event in a position's history, shaped like the items a backend activity
 * endpoint would return, so moving the list off the interim History source
 * changes only where the items come from.
 */
export interface PositionActivityItem {
  /** Unique per row: one operation can carry several requests. */
  id: string;
  protocol: "blend";
  /** The position's contract: the pool, for Blend. */
  positionId: string;
  /** The token contract the event moved. */
  assetId: string;
  type: PositionActivityType;
  /**
   * Integer amount in the token's smallest unit. Null when it can't be read:
   * a withdrawal of a token that reports no balance change.
   */
  amount: string | null;
  /** ISO 8601. */
  occurredAt: string;
  txHash: string;
  /** The transaction's envelope, for its details sheet. */
  envelopeXdr: string;
}

/** The History fields this reads, which Horizon's typing doesn't carry. */
export interface ActivityHistoryOperation {
  id: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  transaction_successful?: boolean;
  transaction_attr?: { envelope_xdr?: string };
  asset_balance_changes?: {
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
    from?: string;
    to?: string;
    amount: string;
  }[];
}

/** Blend pool entry points that take `(from, spender, to, requests)`. */
const BLEND_SUBMIT_FUNCTIONS = new Set(["submit", "submit_with_allowance"]);

/**
 * Request types that change what the account supplies, and nothing else:
 * borrows, repays and auction fills are not position activity.
 */
const BLEND_REQUEST_ACTIVITY: Partial<Record<number, PositionActivityType>> = {
  [BlendRequestType.Supply]: PositionActivityType.DEPOSIT,
  [BlendRequestType.SupplyCollateral]: PositionActivityType.DEPOSIT,
  [BlendRequestType.Withdraw]: PositionActivityType.WITHDRAW,
  [BlendRequestType.WithdrawCollateral]: PositionActivityType.WITHDRAW,
};

interface BlendRequest {
  address: string;
  amount: bigint;
  request_type: number;
}

/** The contract call an operation made, read from its transaction envelope. */
const getInvocation = (envelopeXdr: string, networkPassphrase: string) => {
  try {
    const parsed = TransactionBuilder.fromXdr(envelopeXdr, networkPassphrase);
    const transaction: Transaction =
      parsed instanceof FeeBumpTransaction ? parsed.innerTransaction : parsed;
    // A Soroban transaction carries exactly one operation. The SDK hands its
    // host function back as a plain object, as signing display reads it.
    const operation = transaction.operations[0] as Operation.InvokeHostFunction;
    const func = operation?.func;
    if (!func || func.type !== "hostFunctionTypeInvokeContract") {
      return null;
    }

    const { contractAddress, functionName, args } = func.invokeContract;
    return {
      contractId: Address.fromScAddress(contractAddress).toString(),
      fnName: functionName.toString(),
      args,
    };
  } catch {
    // One undecodable envelope must not cost the rest of the list.
    return null;
  }
};

/** The SAC address of the classic asset a balance change moved. */
const getBalanceChangeAssetId = (
  change: NonNullable<ActivityHistoryOperation["asset_balance_changes"]>[0],
  networkPassphrase: string,
) => {
  try {
    const asset = isNativeAssetId(change.asset_type)
      ? Asset.native()
      : new Asset(change.asset_code || "", change.asset_issuer || "");
    return asset.contractId(networkPassphrase);
  } catch {
    return null;
  }
};

/**
 * INTERIM SOURCE, as in the extension. An account's deposits into and
 * withdrawals from one Blend pool, decoded from its History operations.
 *
 * Limits, all of which a backend activity endpoint would lift:
 * - only the operations History has: its latest 100 of any kind;
 * - only calls the account made itself (`from` is the account), so no
 *   liquidations, and no deposits routed through another contract;
 * - a withdrawal's amount is what the pool paid out, which only SAC tokens
 *   report; for a Soroban-only token it is unknown rather than the request's,
 *   which "withdraw max" overstates;
 * - no USD value at the time of the event.
 *
 * Newest first, as History is.
 */
export const getBlendActivityFromHistory = ({
  operations,
  poolId,
  publicKey,
  networkDetails,
}: {
  operations: ActivityHistoryOperation[];
  poolId: string;
  publicKey: string;
  networkDetails: NetworkDetails;
}): PositionActivityItem[] => {
  const { networkPassphrase } = networkDetails;
  const items: PositionActivityItem[] = [];

  operations.forEach((operation) => {
    const envelopeXdr = operation.transaction_attr?.envelope_xdr;
    if (
      !SOROBAN_OPERATION_TYPES.includes(operation.type) ||
      operation.transaction_successful === false ||
      !envelopeXdr
    ) {
      return;
    }

    const invocation = getInvocation(envelopeXdr, networkPassphrase);
    if (
      !invocation ||
      invocation.contractId !== poolId ||
      !BLEND_SUBMIT_FUNCTIONS.has(invocation.fnName)
    ) {
      return;
    }

    let requests: BlendRequest[];
    let recipient: string;
    try {
      const [fromArg, , toArg, requestsArg] = invocation.args;
      if (Address.fromScVal(fromArg).toString() !== publicKey) {
        return;
      }
      recipient = Address.fromScVal(toArg).toString();
      requests = scValToNative(requestsArg) as BlendRequest[];
    } catch {
      return;
    }

    requests.forEach((request, index) => {
      const type = BLEND_REQUEST_ACTIVITY[Number(request.request_type)];
      if (!type) {
        return;
      }

      // A deposit moves exactly what it asked for; a withdrawal what the pool
      // paid out, since a request can ask for more than the position holds.
      let amount: string | null = request.amount.toString();
      if (type === PositionActivityType.WITHDRAW) {
        const payout = (operation.asset_balance_changes || []).find(
          (change) =>
            change.from === poolId &&
            change.to === recipient &&
            getBalanceChangeAssetId(change, networkPassphrase) ===
              request.address,
        );
        amount = payout
          ? new BigNumber(payout.amount).shiftedBy(DEFAULT_DECIMALS).toFixed(0)
          : null;
      }

      items.push({
        id: `${operation.id}:${index}`,
        protocol: "blend",
        positionId: poolId,
        assetId: request.address,
        type,
        amount,
        occurredAt: operation.created_at,
        txHash: operation.transaction_hash,
        envelopeXdr,
      });
    });
  });

  return items;
};
