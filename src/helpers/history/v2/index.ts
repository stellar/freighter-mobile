/**
 * mapV2Transaction — the single entry point from a v2 AccountTransaction to
 * the normalized HistoryEntry the redesigned History UI renders.
 *
 * Usage per page:
 *   const tokens = await buildTokenContext({ tokenIds: collectTokenIds(page), ... });
 *   const entries = page.data.map((tx) => mapV2Transaction(tx, { tokens, publicKey, nativeTokenId }));
 */
import BigNumber from "bignumber.js";
import { DEFAULT_DECIMALS } from "config/constants";
import { V2AccountTransaction, V2StateChange } from "config/historyV2Types";
import { mapBalanceChanges } from "helpers/history/v2/balances";
import { buildPresentation } from "helpers/history/v2/classify";
import {
  decodeContractCall,
  decodeCounterparty,
  resolveProtocol,
} from "helpers/history/v2/contract";
import { formatTokenAmount } from "helpers/history/v2/formatTokenAmount";
import { HistoryEntry } from "helpers/history/v2/model";
import { resolveProtocolAction } from "helpers/history/v2/protocolActions";
import { mapStateChangeCards } from "helpers/history/v2/stateChanges";
import { TokenContext } from "helpers/history/v2/tokenResolver";

export interface MapV2Context {
  tokens: TokenContext;
  /** the account whose history this is */
  publicKey: string;
  /** the network's native SAC contract id (fee heuristic); null skips the token match */
  nativeTokenId: string | null;
}

/** Every token contract id referenced by a page — feed to buildTokenContext */
export const collectTokenIds = (
  transactions: V2AccountTransaction[],
): string[] => {
  const ids = new Set<string>();
  const collect = (change: V2StateChange) => {
    switch (change.type) {
      case "BALANCE":
      case "ALLOWANCE":
        ids.add(change.token_id);
        break;
      // Trustlines and authorizations reference either a token or a liquidity
      // pool; only token ids resolve to token metadata.
      case "TRUSTLINE":
      case "BALANCE_AUTHORIZATION":
        if (change.token_id) {
          ids.add(change.token_id);
        }
        break;
      default:
        break;
    }
  };
  // eslint-disable-next-line no-restricted-syntax -- ported verbatim from the extension's token-id collection algorithm.
  for (const tx of transactions) {
    tx.state_changes.forEach(collect);
  }
  return [...ids];
};

/**
 * Transaction result codes arrive as XDR enum names
 * ("TransactionResultCodeTxSuccess"), not the snake_case Horizon spelling —
 * freighter-backend-v2 passes wallet-backend's stored value straight through.
 * Fee-bump transactions report their inner result separately, so both success
 * codes count as success. The snake_case forms are accepted too because the
 * Horizon fallback (custom networks) synthesizes them.
 */
const SUCCESS_RESULT_CODES = new Set([
  "TransactionResultCodeTxSuccess",
  "TransactionResultCodeTxFeeBumpInnerSuccess",
  "tx_success",
  "tx_fee_bump_inner_success",
]);

export const mapV2Transaction = (
  tx: V2AccountTransaction,
  { tokens, publicKey, nativeTokenId }: MapV2Context,
): HistoryEntry => {
  const failed = !SUCCESS_RESULT_CODES.has(tx.result_code);

  const { rows, classification } = mapBalanceChanges(tx, tokens, nativeTokenId);
  const cards = mapStateChangeCards(tx.state_changes, tokens, publicKey);

  const contractCall =
    tx.operations.map(decodeContractCall).find((info) => info !== null) ?? null;
  const protocol = contractCall
    ? resolveProtocol(contractCall.contractId)
    : null;

  const counterparty =
    contractCall?.transferDestination ??
    tx.operations
      .map((op) => decodeCounterparty(op, publicKey))
      .find((address) => address !== null) ??
    null;

  const protocolAction = resolveProtocolAction(tx.state_changes);

  const presentation = buildPresentation({
    classification,
    cards,
    contractCall,
    protocol,
    failed,
    operationTypes: tx.operations.map((op) => op.operation_type),
    protocolAction,
  });

  return {
    id: tx.hash,
    kind: presentation.kind,
    createdAt: tx.ledger_created_at,
    rowIcon: presentation.rowIcon,
    primaryText: presentation.primaryText,
    secondaryText: presentation.secondaryText,
    secondaryIcon: presentation.secondaryIcon,
    amounts: presentation.amounts,
    details: {
      title: presentation.title,
      status: failed ? "failed" : "success",
      fee: formatTokenAmount(new BigNumber(tx.fee_charged), DEFAULT_DECIMALS),
      rate: classification.type === "swapped" ? classification.rate : null,
      contractId: contractCall?.contractId ?? null,
      functionName: contractCall?.functionName ?? null,
      protocol,
      counterparty,
      balanceChanges: rows,
      stateChangeCards: cards,
      operations: tx.operations.map((op) => ({
        id: op.id,
        type: op.operation_type,
        xdr: op.operation_xdr,
        successful: op.successful,
      })),
    },
  };
};
