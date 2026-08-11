/**
 * Derives the list-row presentation (kind, texts, icon descriptor, amounts)
 * and the detail title from the mapped balance classification + state-change
 * cards. All user-facing strings are centralized here so design/i18n
 * adjustments stay one-file changes (wrapped by the UI layer's t()).
 */
import { V2OperationType } from "config/historyV2Types";
import { formatAmount, trimTrailingZeros } from "helpers/formatAmount";
import { BalanceClassification } from "helpers/history/v2/balances";
import { ContractCallInfo } from "helpers/history/v2/contract";
import {
  BalanceChangeRow,
  HistoryEntry,
  ProtocolInfo,
  ResolvedToken,
  RowIconDescriptor,
  StateChangeCardData,
} from "helpers/history/v2/model";
import { ProtocolAction } from "helpers/history/v2/protocolActions";
import { t } from "i18next";

type Presentation = Pick<
  HistoryEntry,
  | "kind"
  | "rowIcon"
  | "primaryText"
  | "secondaryText"
  | "secondaryIcon"
  | "amounts"
> & { title: string };

/**
 * An unknown token scale leaves the magnitude unknowable, so the row shows an em
 * dash with the token code — the direction still colors it credit/debit.
 *
 * trimTrailingZeros runs BEFORE formatAmount, not after: trimTrailingZeros
 * hard-codes "." as the decimal separator, but formatAmount's output uses
 * the target locale's separator (which is "," under e.g. pt-BR/de-DE). Since
 * row.amount is always "."-joined (it comes straight from
 * formatTokenAmount's BigNumber-based scaling), trimming it first and then
 * handing the trimmed, still-"."-joined string to formatAmount keeps both
 * helpers working on the input shape they each expect.
 */
const signedAmount = (row: BalanceChangeRow) => ({
  text:
    row.amount === null
      ? `— ${row.token.code}`
      : `${row.direction === "credit" ? "+" : "-"}${formatAmount(
          trimTrailingZeros(row.amount),
        )} ${row.token.code}`,
  direction: row.direction,
});

const distinctTokens = (rows: BalanceChangeRow[]): ResolvedToken[] => {
  const seen = new Map<string, ResolvedToken>();
  // eslint-disable-next-line no-restricted-syntax -- ported verbatim from the extension; a for...of over rows reads clearer than an array-method rewrite for this seen-map accumulation.
  for (const row of rows) {
    const key = row.token.contractId ?? row.token.code;
    if (!seen.has(key)) {
      seen.set(key, row.token);
    }
  }
  return [...seen.values()];
};

/**
 * Sentence-case labels for the operation types that can reach the fallback
 * below. The v1 list used constants/transaction's Title Case names; the
 * redesign's rows are sentence case ("Added trustline", "Data entry added").
 *
 * A function, not a module-scope const: the imported `t` resolves at call
 * time, but a const table would evaluate at import — possibly before
 * i18next has its resources — and bake in raw keys.
 */
const operationLabels = (): Partial<Record<V2OperationType, string>> => ({
  CLAIM_CLAIMABLE_BALANCE: t("history.v2.operationTypes.claimClaimableBalance"),
  CLAWBACK_CLAIMABLE_BALANCE: t(
    "history.v2.operationTypes.clawbackClaimableBalance",
  ),
  MANAGE_SELL_OFFER: t("history.v2.operationTypes.manageSellOffer"),
  MANAGE_BUY_OFFER: t("history.v2.operationTypes.manageBuyOffer"),
  CREATE_PASSIVE_SELL_OFFER: t(
    "history.v2.operationTypes.createPassiveSellOffer",
  ),
  BUMP_SEQUENCE: t("history.v2.operationTypes.bumpSequence"),
  BEGIN_SPONSORING_FUTURE_RESERVES: t(
    "history.v2.operationTypes.beginSponsoringFutureReserves",
  ),
  END_SPONSORING_FUTURE_RESERVES: t(
    "history.v2.operationTypes.endSponsoringFutureReserves",
  ),
  REVOKE_SPONSORSHIP: t("history.v2.operationTypes.revokeSponsorship"),
  EXTEND_FOOTPRINT_TTL: t("history.v2.operationTypes.extendFootprintTtl"),
  RESTORE_FOOTPRINT: t("history.v2.operationTypes.restoreFootprint"),
  LIQUIDITY_POOL_DEPOSIT: t("history.v2.operationTypes.liquidityPoolDeposit"),
  LIQUIDITY_POOL_WITHDRAW: t("history.v2.operationTypes.liquidityPoolWithdraw"),
  ALLOW_TRUST: t("history.v2.operationTypes.allowTrust"),
  INFLATION: t("history.v2.operationTypes.inflation"),
});

/**
 * Row treatment for operations that move no balance and emit no state change
 * the account can be told about — a claimable balance it is only a claimant of
 * (the funds move on claim, not on creation), an offer, a sequence bump, a
 * footprint extension. Without this they would all read "Transaction".
 */
const operationPresentation = (
  type: V2OperationType | undefined,
): Pick<
  Presentation,
  "kind" | "primaryText" | "secondaryText" | "secondaryIcon" | "rowIcon"
> & { title: string } => {
  if (type === "CREATE_CLAIMABLE_BALANCE") {
    return {
      kind: "other",
      primaryText: t("history.v2.labels.claimableBalanceCreated"),
      secondaryText: t("history.v2.labels.pendingClaim"),
      secondaryIcon: null,
      rowIcon: { type: "settings", glyph: "claimable" },
      title: t("history.v2.labels.claimableBalanceCreated"),
    };
  }

  const labels = operationLabels();
  const label = type ? labels[type] : undefined;
  return {
    kind: "other",
    primaryText: label ?? t("history.v2.labels.transaction"),
    secondaryText: label
      ? t("history.v2.labels.submitted")
      : t("history.v2.labels.interacted"),
    secondaryIcon: null,
    rowIcon: { type: "contract" },
    title: label ?? t("history.v2.labels.transaction"),
  };
};

/** Row treatment for pure config-change transactions (no balance movement) */
const configPresentation = (
  card: StateChangeCardData,
): Pick<
  Presentation,
  "kind" | "primaryText" | "secondaryText" | "secondaryIcon" | "rowIcon"
> & { title: string } => {
  switch (card.kind) {
    case "accountCreated":
      return {
        kind: "accountCreated",
        primaryText: t("history.v2.labels.accountCreated"),
        secondaryText: t("history.v2.labels.created"),
        secondaryIcon: "add",
        rowIcon: { type: "account", variant: "create" },
        title: t("history.v2.labels.accountCreated"),
      };
    case "accountMerged":
      return {
        kind: "accountMerged",
        primaryText: t("history.v2.labels.accountMerged"),
        secondaryText: t("history.v2.labels.merged"),
        secondaryIcon: "remove",
        rowIcon: { type: "account", variant: "merge" },
        title: t("history.v2.labels.accountMerged"),
      };
    case "trustlines": {
      const first = card.entries[0];
      const primaryText =
        card.entries.length === 1
          ? first.token.code
          : t("history.v2.labels.trustlines");
      if (card.verb === "removed") {
        return {
          kind: "trustlineRemoved",
          primaryText,
          secondaryText: t("history.v2.labels.removedTrustline"),
          secondaryIcon: "remove",
          rowIcon: { type: "asset", tokens: card.entries.map((e) => e.token) },
          title: t("history.v2.labels.removedTrustline"),
        };
      }
      return {
        kind: "trustlineAdded",
        primaryText,
        secondaryText:
          card.verb === "created"
            ? t("history.v2.labels.addedTrustline")
            : t("history.v2.labels.updatedTrustline"),
        secondaryIcon: "add",
        rowIcon: { type: "asset", tokens: card.entries.map((e) => e.token) },
        title:
          card.verb === "created"
            ? t("history.v2.labels.addedTrustline")
            : t("history.v2.labels.updatedTrustline"),
      };
    }
    case "signers":
      return {
        kind: "other",
        primaryText: t("history.v2.labels.signers"),
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- t()'s strictly-typed return combined with a template literal trips this rule; matches the pre-existing disable pattern in components/screens/HistoryScreen for the same t()-in-template shape.
        secondaryText: `${t("history.v2.labels.signer")} ${card.verb}`,
        secondaryIcon: "settings",
        rowIcon: { type: "settings", glyph: "signer" },
        title: t("history.v2.labels.signerChange"),
      };
    case "thresholds":
      return {
        kind: "other",
        primaryText: t("history.v2.labels.thresholds"),
        secondaryText: t("history.v2.labels.thresholdUpdated"),
        secondaryIcon: "settings",
        rowIcon: { type: "settings", glyph: "threshold" },
        title: t("history.v2.labels.thresholdUpdated"),
      };
    case "dataEntry":
      return {
        kind: "other",
        primaryText: t("history.v2.labels.dataEntry"),
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- see the signers case's disable reason above for the same t()-in-template shape.
        secondaryText: `${t("history.v2.labels.dataEntry")} ${card.verb}`,
        secondaryIcon: "settings",
        rowIcon: { type: "settings", glyph: "data" },
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- see the signers case's disable reason above for the same t()-in-template shape.
        title: `${t("history.v2.labels.dataEntry")} ${card.verb}`,
      };
    case "homeDomain":
      return {
        kind: "other",
        primaryText: t("history.v2.labels.homeDomain"),
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- see the signers case's disable reason above for the same t()-in-template shape.
        secondaryText: `${t("history.v2.labels.homeDomain")} ${card.verb}`,
        secondaryIcon: "settings",
        rowIcon: { type: "settings", glyph: "domain" },
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- see the signers case's disable reason above for the same t()-in-template shape.
        title: `${t("history.v2.labels.homeDomain")} ${card.verb}`,
      };
    case "flags":
      return {
        kind: "other",
        primaryText: t("history.v2.labels.accountSettings"),
        secondaryText: t("history.v2.labels.settingUpdated"),
        secondaryIcon: "settings",
        rowIcon: { type: "settings", glyph: "flag" },
        title: t("history.v2.labels.accountSettingUpdated"),
      };
    case "balanceAuthorizations":
      return {
        kind: "other",
        primaryText:
          card.tokens.length === 1
            ? card.tokens[0].code
            : t("history.v2.labels.trustlines"),
        secondaryText: card.authorized
          ? t("history.v2.labels.balanceAuthorized")
          : t("history.v2.labels.balanceUnauthorized"),
        secondaryIcon: "settings",
        rowIcon: { type: "asset", tokens: card.tokens },
        title: card.authorized
          ? t("history.v2.labels.balanceAuthorized")
          : t("history.v2.labels.balanceUnauthorized"),
      };
    case "allowance":
      return {
        kind: "other",
        primaryText: card.token.code,
        secondaryText: t("history.v2.labels.allowanceApproved"),
        secondaryIcon: "settings",
        rowIcon: { type: "settings", glyph: "allowance" },
        title: t("history.v2.labels.allowanceApproved"),
      };
    default:
      return {
        kind: "other",
        primaryText: t("history.v2.labels.transaction"),
        secondaryText: t("history.v2.labels.interacted"),
        secondaryIcon: null,
        rowIcon: { type: "settings", glyph: "generic" },
        title: t("history.v2.labels.transaction"),
      };
  }
};

const basePresentation = ({
  classification,
  cards,
  contractCall,
  protocol,
  failed,
  operationTypes,
}: {
  classification: BalanceClassification;
  cards: StateChangeCardData[];
  contractCall: ContractCallInfo | null;
  protocol: ProtocolInfo | null;
  failed: boolean;
  /** this account's operations within the transaction, in ledger order */
  operationTypes: V2OperationType[];
}): Presentation => {
  if (failed) {
    return {
      kind: "failed",
      rowIcon: { type: "failed" },
      primaryText: t("history.v2.labels.transactionFailed"),
      secondaryText: t("history.v2.labels.failed"),
      secondaryIcon: "failed",
      amounts: null,
      title: t("history.v2.labels.transactionFailed"),
    };
  }

  // Balance movement drives the row when present
  switch (classification.type) {
    case "swapped": {
      const { credit, debit } = classification;
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- t()'s strictly-typed return combined with a template literal trips this rule; matches the pre-existing disable pattern in components/screens/HistoryScreen for the same t()-in-template shape.
      const pair = `${debit.token.code} ${t("history.v2.labels.to")} ${credit.token.code}`;
      const viaContract = contractCall !== null;
      return {
        kind: "swapped",
        rowIcon: viaContract
          ? // eslint-disable-next-line @typescript-eslint/no-use-before-define -- ported verbatim; iconForContract is defined below basePresentation to keep the exported buildPresentation/basePresentation pair together, matching the extension's file layout.
            iconForContract(protocol, distinctTokens([debit, credit]))
          : { type: "asset", tokens: [debit.token, credit.token] },
        primaryText: viaContract
          ? (protocol?.name ?? t("history.v2.labels.contract"))
          : pair,
        secondaryText: protocol?.domain ?? t("history.v2.labels.swapped"),
        secondaryIcon: protocol?.domain ? "globe" : "swap",
        // Row shows only the received (credit) amount, matching the legacy
        // list; the debit is still shown in the detail drawer's balance card.
        amounts: [signedAmount(credit)],
        title: viaContract
          ? t("history.v2.labels.contract")
          : // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- see the `pair` disable above for the same t()-in-template shape.
            `${t("history.v2.labels.swapped")} ${pair}`,
      };
    }
    case "sent":
      return {
        kind: "sent",
        rowIcon: contractCall
          ? // eslint-disable-next-line @typescript-eslint/no-use-before-define -- ported verbatim; see the swap case's disable reason above.
            iconForContract(protocol, [classification.row.token])
          : { type: "asset", tokens: [classification.row.token] },
        primaryText: contractCall
          ? (protocol?.name ?? t("history.v2.labels.contract"))
          : classification.row.token.code,
        secondaryText: protocol?.domain ?? t("history.v2.labels.sent"),
        secondaryIcon: protocol?.domain ? "globe" : "sent",
        amounts: [signedAmount(classification.row)],
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- see the `pair` disable above for the same t()-in-template shape.
        title: `${t("history.v2.labels.sent")} ${classification.row.token.code}`,
      };
    case "received":
      return {
        kind: "received",
        rowIcon: contractCall
          ? // eslint-disable-next-line @typescript-eslint/no-use-before-define -- ported verbatim; see the swap case's disable reason above.
            iconForContract(protocol, [classification.row.token])
          : { type: "asset", tokens: [classification.row.token] },
        primaryText: contractCall
          ? (protocol?.name ?? t("history.v2.labels.contract"))
          : classification.row.token.code,
        secondaryText: protocol?.domain ?? t("history.v2.labels.received"),
        secondaryIcon: protocol?.domain ? "globe" : "received",
        amounts: [signedAmount(classification.row)],
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- see the `pair` disable above for the same t()-in-template shape.
        title: `${t("history.v2.labels.received")} ${classification.row.token.code}`,
      };
    case "multiple":
      return {
        kind: contractCall ? "contract" : "other",
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- ported verbatim; see the swap case's disable reason above.
        rowIcon: iconForContract(protocol, distinctTokens(classification.rows)),
        primaryText: protocol?.name ?? t("history.v2.labels.contract"),
        secondaryText:
          protocol?.domain ?? t("history.v2.labels.multipleBalanceChanges"),
        secondaryIcon: protocol?.domain ? "globe" : "contract",
        amounts: "multiple",
        title: protocol?.name ?? t("history.v2.labels.contract"),
      };
    case "none":
    default:
      break;
  }

  // No balance movement. A contract invocation is still identified by the
  // contract it called, even when it emitted state changes (data entries,
  // allowances, …) — those are supporting cards in the detail sheet, not the
  // row's title: node 12132:62391 heads a data-entry tx "Contract / domain.com".
  // Only classic config operations fall through to configPresentation.
  if (contractCall) {
    return {
      kind: "contract",
      rowIcon: protocol
        ? { type: "protocol", src: protocol.iconUrl, name: protocol.name }
        : { type: "contract" },
      primaryText: protocol?.name ?? t("history.v2.labels.contract"),
      secondaryText: protocol?.domain ?? t("history.v2.labels.interacted"),
      secondaryIcon: protocol?.domain ? "globe" : "contract",
      amounts: null,
      title: protocol?.name ?? t("history.v2.labels.contract"),
    };
  }

  if (cards.length > 0) {
    const config = configPresentation(cards[0]);
    return { ...config, amounts: null };
  }

  // No state change to describe — fall back to naming the operation itself
  return { ...operationPresentation(operationTypes[0]), amounts: null };
};

/**
 * Contract-row icon per the design's fallback matrix: protocol logo when
 * known, otherwise the moved tokens' icons (stacked "+N" when >2), otherwise
 * the generic contract icon.
 */
const iconForContract = (
  protocol: ProtocolInfo | null,
  tokens: ResolvedToken[],
): RowIconDescriptor => {
  if (protocol) {
    return { type: "protocol", src: protocol.iconUrl, name: protocol.name };
  }
  if (tokens.length > 0) {
    return { type: "asset", tokens };
  }
  return { type: "contract" };
};

/**
 * The row presentation, with protocol-action labels overlaid when the
 * transaction emitted a recognized protocol state change.
 *
 * The overlay replaces only the four label fields. `kind`, `rowIcon`, and
 * `amounts` come from basePresentation untouched, so a relabelled row is
 * otherwise identical to the row that shipped before — that is the mechanism
 * behind the "preserve every other label" requirement, and why a failed
 * transaction still reads "Transaction failed": basePresentation returns the
 * failed row and `failed` suppresses the overlay.
 */
export const buildPresentation = (
  params: Parameters<typeof basePresentation>[0] & {
    protocolAction: ProtocolAction | null;
  },
): Presentation => {
  const base = basePresentation(params);
  const { protocolAction, failed } = params;

  if (!protocolAction || failed) {
    return base;
  }

  return {
    ...base,
    primaryText: protocolAction.label,
    secondaryText: protocolAction.protocolName,
    secondaryIcon: "contract",
    title: protocolAction.label,
  };
};
