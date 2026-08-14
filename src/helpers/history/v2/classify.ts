/**
 * Derives the list-row presentation (kind, texts, icon descriptor, amounts)
 * and the detail title from the mapped balance classification + state-change
 * cards. All user-facing strings are centralized here so design/i18n
 * adjustments stay one-file changes (wrapped by the UI layer's t()).
 */
import { V2OperationType } from "config/historyV2Types";
import { formatAmount, trimTrailingZeros } from "helpers/formatAmount";
import { BalanceClassification } from "helpers/history/v2/balances";
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
 * Sentence-case labels for the operation types that can reach the fallbacks
 * below. The v1 list used constants/transaction's Title Case names; the
 * redesign's rows are sentence case ("Added trustline", "Data entry added").
 *
 * A function, not a module-scope const: the imported `t` resolves at call
 * time, but a const table would evaluate at import — possibly before
 * i18next has its resources — and bake in raw keys.
 *
 * A full Record, deliberately: every classic operation names itself, so no
 * classic operation can ever fall back to a generic "Transaction" label — and
 * a new wire operation type fails to compile until it gets one. Most of these
 * only surface when a transaction reaches the fallbacks (no movement and no
 * state change, or a homogeneous multi-row shape); the common cases render
 * through their families first (§3 of history-row-label-derivation.md).
 */
const operationLabels = (): Record<V2OperationType, string> => ({
  CREATE_ACCOUNT: t("history.v2.operationTypes.createAccount"),
  PAYMENT: t("history.v2.operationTypes.payment"),
  PATH_PAYMENT_STRICT_RECEIVE: t(
    "history.v2.operationTypes.pathPaymentStrictReceive",
  ),
  PATH_PAYMENT_STRICT_SEND: t(
    "history.v2.operationTypes.pathPaymentStrictSend",
  ),
  MANAGE_SELL_OFFER: t("history.v2.operationTypes.manageSellOffer"),
  MANAGE_BUY_OFFER: t("history.v2.operationTypes.manageBuyOffer"),
  CREATE_PASSIVE_SELL_OFFER: t(
    "history.v2.operationTypes.createPassiveSellOffer",
  ),
  SET_OPTIONS: t("history.v2.operationTypes.setOptions"),
  CHANGE_TRUST: t("history.v2.operationTypes.changeTrust"),
  ALLOW_TRUST: t("history.v2.operationTypes.allowTrust"),
  SET_TRUST_LINE_FLAGS: t("history.v2.operationTypes.setTrustLineFlags"),
  ACCOUNT_MERGE: t("history.v2.operationTypes.accountMerge"),
  INFLATION: t("history.v2.operationTypes.inflation"),
  MANAGE_DATA: t("history.v2.operationTypes.manageData"),
  BUMP_SEQUENCE: t("history.v2.operationTypes.bumpSequence"),
  CREATE_CLAIMABLE_BALANCE: t(
    "history.v2.operationTypes.createClaimableBalance",
  ),
  CLAIM_CLAIMABLE_BALANCE: t("history.v2.operationTypes.claimClaimableBalance"),
  BEGIN_SPONSORING_FUTURE_RESERVES: t(
    "history.v2.operationTypes.beginSponsoringFutureReserves",
  ),
  END_SPONSORING_FUTURE_RESERVES: t(
    "history.v2.operationTypes.endSponsoringFutureReserves",
  ),
  REVOKE_SPONSORSHIP: t("history.v2.operationTypes.revokeSponsorship"),
  CLAWBACK: t("history.v2.operationTypes.clawback"),
  CLAWBACK_CLAIMABLE_BALANCE: t(
    "history.v2.operationTypes.clawbackClaimableBalance",
  ),
  LIQUIDITY_POOL_DEPOSIT: t("history.v2.operationTypes.liquidityPoolDeposit"),
  LIQUIDITY_POOL_WITHDRAW: t("history.v2.operationTypes.liquidityPoolWithdraw"),
  INVOKE_HOST_FUNCTION: t("history.v2.operationTypes.invokeHostFunction"),
  EXTEND_FOOTPRINT_TTL: t("history.v2.operationTypes.extendFootprintTtl"),
  RESTORE_FOOTPRINT: t("history.v2.operationTypes.restoreFootprint"),
});

/**
 * The single label a transaction's own operations agree on, or null when the
 * operations genuinely disagree (a heterogeneous batch has no one identity).
 * Distinct op types that share a label (the three offer ops, the two path
 * payments) still agree.
 */
const homogeneousOpLabel = (
  operationTypes: V2OperationType[],
): string | null => {
  const table = operationLabels();
  const labels = new Set(
    operationTypes.map((type) => table[type]).filter(Boolean),
  );
  return labels.size === 1 ? [...labels][0] : null;
};

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

/**
 * The treatment family an operation type belongs to. Row identity comes from
 * here — from what the account actually submitted — never inferred from the
 * shape of the balance changes it produced. Shapes lie about identity: an LP
 * deposit debits two assets and "looks like" a contract call, a claim credits
 * one asset and "looks like" a payment, two opposite payments in one
 * transaction "look like" a swap. The balance classification is consulted
 * only for what it actually knows — direction, amounts, and tokens.
 */
type ValueFamily =
  | "transfer"
  | "pathPayment"
  | "lpDeposit"
  | "lpWithdraw"
  | "claim"
  | "claimCreate"
  | "offer";

const VALUE_FAMILIES: Partial<Record<V2OperationType, ValueFamily>> = {
  PAYMENT: "transfer",
  CREATE_ACCOUNT: "transfer",
  ACCOUNT_MERGE: "transfer",
  // No design copy for a clawback yet, so the victim's row reads Sent — the
  // least-wrong of the existing treatments. Revisit when copy exists.
  CLAWBACK: "transfer",
  PATH_PAYMENT_STRICT_SEND: "pathPayment",
  PATH_PAYMENT_STRICT_RECEIVE: "pathPayment",
  LIQUIDITY_POOL_DEPOSIT: "lpDeposit",
  LIQUIDITY_POOL_WITHDRAW: "lpWithdraw",
  CLAIM_CLAIMABLE_BALANCE: "claim",
  CREATE_CLAIMABLE_BALANCE: "claimCreate",
  MANAGE_SELL_OFFER: "offer",
  MANAGE_BUY_OFFER: "offer",
  CREATE_PASSIVE_SELL_OFFER: "offer",
};

/**
 * Which family drives the row when a transaction holds several operations:
 * a contract invocation outranks everything (the protocol overlay needs the
 * contract identity); one distinct value-moving family names itself; several
 * distinct ones are honestly "mixed" — never "Contract" without a contract.
 * No value-mover at all falls to the config-cards/labeled-op path.
 */
const resolveOpFamily = (
  operationTypes: V2OperationType[],
): ValueFamily | "invoke" | "mixed" | "none" => {
  if (operationTypes.includes("INVOKE_HOST_FUNCTION")) {
    return "invoke";
  }
  const families = new Set(
    operationTypes.flatMap((type) => {
      const family = VALUE_FAMILIES[type];
      return family ? [family] : [];
    }),
  );
  if (families.size === 1) {
    return [...families][0];
  }
  return families.size > 1 ? "mixed" : "none";
};

/** Every balance row the classification carries, in its original order. */
const rowsOf = (classification: BalanceClassification): BalanceChangeRow[] => {
  switch (classification.type) {
    case "sent":
    case "received":
      return [classification.row];
    case "swapped":
      return [classification.credit, classification.debit];
    case "multiple":
      return classification.rows;
    case "none":
    default:
      return [];
  }
};

/**
 * Row amounts for a family whose identity is NOT the movement itself (LP,
 * offer, claim): the single amount when exactly one asset moved, otherwise
 * the "Multiple" label — the right column never stacks amounts. The full
 * per-asset breakdown lives in the detail sheet's balance card.
 */
const amountsFor = (rows: BalanceChangeRow[]): Presentation["amounts"] => {
  if (rows.length === 0) {
    return null;
  }
  if (rows.length === 1) {
    return [signedAmount(rows[0])];
  }
  return "multiple";
};

/**
 * The treatment for classic multi-asset movement: named after the operations
 * when they all agree on a label (a payment batch is "Payment", a multi-hop
 * path payment is "Path payment"), and only a genuinely heterogeneous batch —
 * which has no single identity — reads "Transaction". Never "Contract":
 * there is no contract in it.
 */
const transactionFallback = (
  rows: BalanceChangeRow[],
  operationTypes: V2OperationType[],
): Presentation => {
  const label =
    homogeneousOpLabel(operationTypes) ?? t("history.v2.labels.transaction");
  return {
    kind: "other",
    rowIcon:
      rows.length > 0
        ? { type: "asset", tokens: distinctTokens(rows) }
        : { type: "contract" },
    primaryText: label,
    secondaryText: t("history.v2.labels.multipleBalanceChanges"),
    secondaryIcon: null,
    amounts: "multiple",
    title: label,
  };
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

const basePresentation = ({
  classification,
  cards,
  protocol,
  failed,
  operationTypes,
}: {
  classification: BalanceClassification;
  cards: StateChangeCardData[];
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

  // Identity first: which family of operation is this? Only then consult the
  // balance classification, and only for direction/amounts/tokens.
  const family = resolveOpFamily(operationTypes);

  /** Classic swap treatment: the pair is the row's identity. */
  const classicSwap = (
    swapped: Extract<BalanceClassification, { type: "swapped" }>,
  ): Presentation => {
    const { credit, debit } = swapped;
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- t()'s strictly-typed return combined with a template literal trips this rule; matches the pre-existing disable pattern in components/screens/HistoryScreen for the same t()-in-template shape.
    const pair = `${debit.token.code} ${t("history.v2.labels.to")} ${credit.token.code}`;
    return {
      kind: "swapped",
      rowIcon: { type: "asset", tokens: [debit.token, credit.token] },
      primaryText: pair,
      secondaryText: t("history.v2.labels.swapped"),
      secondaryIcon: "swap",
      amounts: [signedAmount(credit)],
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- see the `pair` disable above for the same t()-in-template shape.
      title: `${t("history.v2.labels.swapped")} ${pair}`,
    };
  };

  /** Classic single-movement treatment: the asset is the row's identity. */
  const plainMovement = (
    row: BalanceChangeRow,
    direction: "sent" | "received",
  ): Presentation => ({
    kind: direction,
    rowIcon: { type: "asset", tokens: [row.token] },
    primaryText: row.token.code,
    secondaryText:
      direction === "sent"
        ? t("history.v2.labels.sent")
        : t("history.v2.labels.received"),
    secondaryIcon: direction,
    amounts: [signedAmount(row)],
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- see the classicSwap `pair` disable above for the same t()-in-template shape.
    title: `${direction === "sent" ? t("history.v2.labels.sent") : t("history.v2.labels.received")} ${row.token.code}`,
  });

  switch (family) {
    case "invoke": {
      const rows = rowsOf(classification);

      // A recognized protocol brands the row (and the protocolAction overlay
      // may relabel it further); the classification only picks direction and
      // amounts. Unknown protocols fall through to the movement/name
      // treatments below.
      if (protocol) {
        const secondaryIcon = protocol.domain ? "globe" : "contract";
        switch (classification.type) {
          case "swapped":
            return {
              kind: "swapped",
              rowIcon: iconForContract(protocol, distinctTokens(rows)),
              primaryText: protocol.name,
              secondaryText: protocol.domain ?? t("history.v2.labels.swapped"),
              secondaryIcon: protocol.domain ? "globe" : "swap",
              amounts: [signedAmount(classification.credit)],
              title: protocol.name,
            };
          case "sent":
          case "received":
            return {
              kind: classification.type,
              rowIcon: iconForContract(protocol, [classification.row.token]),
              primaryText: protocol.name,
              secondaryText:
                protocol.domain ??
                (classification.type === "sent"
                  ? t("history.v2.labels.sent")
                  : t("history.v2.labels.received")),
              secondaryIcon: protocol.domain ? "globe" : classification.type,
              amounts: [signedAmount(classification.row)],
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- see the classicSwap `pair` disable above for the same t()-in-template shape.
              title: `${classification.type === "sent" ? t("history.v2.labels.sent") : t("history.v2.labels.received")} ${classification.row.token.code}`,
            };
          case "multiple":
            return {
              kind: "contract",
              rowIcon: iconForContract(protocol, distinctTokens(rows)),
              primaryText: protocol.name,
              secondaryText:
                protocol.domain ??
                t("history.v2.labels.multipleBalanceChanges"),
              secondaryIcon,
              amounts: "multiple",
              title: protocol.name,
            };
          case "none":
          default:
            return {
              kind: "contract",
              rowIcon: {
                type: "protocol",
                src: protocol.iconUrl,
                name: protocol.name,
              },
              primaryText: protocol.name,
              secondaryText:
                protocol.domain ?? t("history.v2.labels.interacted"),
              secondaryIcon,
              amounts: null,
              title: protocol.name,
            };
        }
      }

      // Unknown protocol: the STATE CHANGES say what actually happened — a
      // single movement renders exactly like a classic payment (a SEP-41
      // transfer credit is a received payment), a swap-shaped movement
      // renders the classic pair whatever contract routed it. Invocation
      // names deliberately do NOT label rows — they stay in the detail
      // sheet — so anything the movement can't describe stays "Contract".
      switch (classification.type) {
        case "swapped":
          return classicSwap(classification);
        case "sent":
        case "received":
          return plainMovement(classification.row, classification.type);
        case "multiple":
          return {
            kind: "contract",
            rowIcon: iconForContract(null, distinctTokens(rows)),
            primaryText: t("history.v2.labels.contract"),
            secondaryText: t("history.v2.labels.multipleBalanceChanges"),
            secondaryIcon: "contract",
            amounts: "multiple",
            title: t("history.v2.labels.contract"),
          };
        case "none":
        default:
          // No movement — the contract identity is all the row can say; the
          // state changes (data entries, allowances, …) are supporting cards
          // in the detail sheet, not the row's title.
          return {
            kind: "contract",
            rowIcon: { type: "contract" },
            primaryText: t("history.v2.labels.contract"),
            secondaryText: t("history.v2.labels.interacted"),
            secondaryIcon: "contract",
            amounts: null,
            title: t("history.v2.labels.contract"),
          };
      }
    }

    case "pathPayment": {
      if (classification.type === "swapped") {
        return classicSwap(classification);
      }
      // A path payment to (or from) another account is a transfer whose send
      // and receive legs live on different accounts.
      if (
        classification.type === "sent" ||
        classification.type === "received"
      ) {
        return plainMovement(classification.row, classification.type);
      }
      if (classification.type === "multiple") {
        return transactionFallback(classification.rows, operationTypes);
      }
      break; // none → cards/floor below
    }

    case "transfer": {
      if (
        classification.type === "sent" ||
        classification.type === "received"
      ) {
        return plainMovement(classification.row, classification.type);
      }
      if (
        classification.type === "swapped" ||
        classification.type === "multiple"
      ) {
        // Two opposite payments in one transaction LOOK like a swap and a
        // batch looks like anything — the ops say what it is (a homogeneous
        // batch names itself, e.g. "Payment"), never a swap pair and never
        // "Contract".
        return transactionFallback(rowsOf(classification), operationTypes);
      }
      break;
    }

    case "lpDeposit":
    case "lpWithdraw": {
      const label =
        family === "lpDeposit"
          ? t("history.v2.operationTypes.liquidityPoolDeposit")
          : t("history.v2.operationTypes.liquidityPoolWithdraw");
      const rows = rowsOf(classification);
      return {
        kind: "other",
        rowIcon:
          rows.length > 0
            ? { type: "asset", tokens: distinctTokens(rows) }
            : { type: "contract" },
        primaryText: label,
        secondaryText: t("history.v2.labels.submitted"),
        secondaryIcon: null,
        amounts: amountsFor(rows),
        title: label,
      };
    }

    case "claim": {
      const rows = rowsOf(classification);
      return {
        // kind stays shape-behavioral, not label-driven: a claim IS an
        // inbound credit, and kind feeds dust filtering and the sheet's
        // To/From direction — not the row text.
        kind: rows.length > 0 ? "received" : "other",
        rowIcon:
          rows.length > 0
            ? { type: "asset", tokens: distinctTokens(rows) }
            : { type: "settings", glyph: "claimable" },
        primaryText: t("history.v2.operationTypes.claimClaimableBalance"),
        secondaryText: t("history.v2.labels.claimed"),
        secondaryIcon: rows.length > 0 ? "received" : null,
        amounts: amountsFor(rows),
        title: t("history.v2.operationTypes.claimClaimableBalance"),
      };
    }

    case "claimCreate":
      // The creator's debit stays in the detail sheet's balance card; the
      // row names the operation — nothing has been received by anyone yet,
      // so "Sent" (what the debit shape suggests) would be wrong.
      return {
        kind: "other",
        primaryText: t("history.v2.labels.claimableBalanceCreated"),
        secondaryText: t("history.v2.labels.pendingClaim"),
        secondaryIcon: null,
        rowIcon: { type: "settings", glyph: "claimable" },
        amounts: null,
        title: t("history.v2.labels.claimableBalanceCreated"),
      };

    case "offer": {
      const rows = rowsOf(classification);
      return {
        kind: "other",
        rowIcon:
          rows.length > 0
            ? { type: "asset", tokens: distinctTokens(rows) }
            : { type: "contract" },
        primaryText: t("history.v2.labels.offer"),
        secondaryText: t("history.v2.labels.submitted"),
        secondaryIcon: null,
        // A crossed offer's fills show as amounts; the identity stays
        // "Offer" — the user placed an offer, the fill is its consequence.
        amounts: amountsFor(rows),
        title: t("history.v2.labels.offer"),
      };
    }

    case "mixed":
      return transactionFallback(rowsOf(classification), operationTypes);

    case "none":
    default:
      break;
  }

  // None of this account's own operations moves value (config ops, or the
  // backend sent operations we don't know) — yet balances moved. That means
  // another account's operation in this transaction did it (operations[] only
  // carries the queried account's ops), so there is no op identity to name:
  // here, and only here, the movement shape legitimately drives the row.
  switch (classification.type) {
    case "sent":
    case "received":
      return plainMovement(classification.row, classification.type);
    case "swapped":
      return classicSwap(classification);
    case "multiple":
      return transactionFallback(classification.rows, operationTypes);
    case "none":
    default:
      break;
  }

  if (cards.length > 0) {
    const config = configPresentation(cards[0]);
    return { ...config, amounts: null };
  }

  // No state change to describe — fall back to naming the operation itself
  return { ...operationPresentation(operationTypes[0]), amounts: null };
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
