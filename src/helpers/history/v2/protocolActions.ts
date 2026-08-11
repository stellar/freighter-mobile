/**
 * Derives a history row's label from a protocol state change's (type, reason)
 * pair.
 *
 * State changes are modelled upstream as a noun/verb pair — the category names
 * the on-chain object, the reason names the action — so a recognized category
 * names the protocol and the pair names what happened. That is why this needs no
 * contract->protocol resolution: `BLEND_EMISSIONS` + `CLAIM` is self-describing.
 *
 * Only relabels rows the account can already see; never changes the amount,
 * icon, or kind.
 */
import {
  StateChangeCategory,
  StateChangeReason,
  V2StateChange,
} from "config/historyV2Types";
import { t } from "i18next";

export interface ProtocolAction {
  /** what happened, e.g. "Claimed emissions" */
  label: string;
  /** the protocol that emitted the row, e.g. "Blend" */
  protocolName: string;
}

/**
 * Recognized protocol categories and their display names. This doubles as the
 * registry: a category absent here is not a protocol category. An explicit map
 * rather than a `BLEND_` prefix test, so onboarding a protocol is deliberate and
 * its display name is not forced to match its category spelling.
 */
export const PROTOCOL_NAMES: Partial<Record<StateChangeCategory, string>> = {
  BLEND_SUPPLY: "Blend",
  BLEND_COLLATERAL: "Blend",
  BLEND_DEBT: "Blend",
  BLEND_AUCTION: "Blend",
  BLEND_EMISSIONS: "Blend",
  BLEND_BACKSTOP_EMISSIONS: "Blend",
  BLEND_BACKSTOP: "Blend",
  BLEND_BACKSTOP_QUEUE: "Blend",
};

type ActionKey = `${StateChangeCategory}:${StateChangeReason}`;

/**
 * What each (category, reason) pair means to the account whose history this is.
 *
 * Two Blend debt rows differ in whose position moved, which sets the label's
 * point of view:
 *  - BAD_DEBT is attributed to the borrower, so it reaches an ordinary wallet's
 *    history and reads from their side: "Debt defaulted".
 *  - BURN is attributed to the emitting pool, so it only surfaces when the
 *    queried address IS that pool — the endpoint accepts C-addresses.
 *
 * A function, not a module-scope const: the imported `t` resolves at call
 * time, but a const table would evaluate at import — possibly before i18next
 * has its resources — and bake in raw keys.
 *
 * Exported (the extension's equivalent `PROTOCOL_ACTION_LABELS` const was
 * too) so the ported test suite can verify it stays in agreement with
 * PROTOCOL_NAMES.
 */
export const protocolActionLabels = (): Partial<Record<ActionKey, string>> => ({
  "BLEND_SUPPLY:CREDIT": t("history.v2.protocolActions.blendSupplyCredit"),
  "BLEND_SUPPLY:DEBIT": t("history.v2.protocolActions.blendSupplyDebit"),
  "BLEND_COLLATERAL:CREDIT": t(
    "history.v2.protocolActions.blendCollateralCredit",
  ),
  "BLEND_COLLATERAL:DEBIT": t(
    "history.v2.protocolActions.blendCollateralDebit",
  ),
  "BLEND_DEBT:BORROW": t("history.v2.protocolActions.blendDebtBorrow"),
  // Both BLEND_AUCTION:FILL and, more softly, BLEND_DEBT:REPAY can be emitted
  // for something that happened *to* the account rather than because of it: a
  // liquidation fill emits this same (type, reason) for both the liquidated
  // borrower and the filler, and a liquidation can repay the borrower's debt
  // on their behalf. (type, reason) alone can't tell those sides apart —
  // that needs the wallet's own address, which this function deliberately
  // does not take — so "Repaid" stays as-is and the auction label below is
  // kept point-of-view-neutral rather than implying the account did the
  // filling.
  "BLEND_DEBT:REPAY": t("history.v2.protocolActions.blendDebtRepay"),
  "BLEND_DEBT:FLASH_LOAN": t("history.v2.protocolActions.blendDebtFlashLoan"),
  "BLEND_DEBT:BAD_DEBT": t("history.v2.protocolActions.blendDebtBadDebt"),
  "BLEND_DEBT:BURN": t("history.v2.protocolActions.blendDebtBurn"),
  "BLEND_AUCTION:FILL": t("history.v2.protocolActions.blendAuctionFill"),
  "BLEND_EMISSIONS:CLAIM": t("history.v2.protocolActions.blendEmissionsClaim"),
  "BLEND_BACKSTOP_EMISSIONS:CLAIM": t(
    "history.v2.protocolActions.blendBackstopEmissionsClaim",
  ),
  "BLEND_BACKSTOP:CREDIT": t("history.v2.protocolActions.blendBackstopCredit"),
  "BLEND_BACKSTOP:DEBIT": t("history.v2.protocolActions.blendBackstopDebit"),
  "BLEND_BACKSTOP_QUEUE:ADD": t(
    "history.v2.protocolActions.blendBackstopQueueAdd",
  ),
  "BLEND_BACKSTOP_QUEUE:REMOVE": t(
    "history.v2.protocolActions.blendBackstopQueueRemove",
  ),
});

/**
 * The first recognized protocol row in wire order, or null when the transaction
 * has none — in which case the caller keeps its existing presentation.
 *
 * A row counts only when BOTH its category is in PROTOCOL_NAMES and its
 * (type, reason) pair is in PROTOCOL_ACTION_LABELS, so a half-label — a protocol
 * with no action, or an action with no protocol — is unrepresentable.
 *
 * Wire order is deterministic: Blend assigns state-change ordinals in emission
 * order within its namespace. A transaction whose most interesting action is not
 * its first will be under-described; accepted, not solved.
 */
export const resolveProtocolAction = (
  changes: V2StateChange[],
): ProtocolAction | null => {
  const labels = protocolActionLabels();
  // eslint-disable-next-line no-restricted-syntax -- ported verbatim from the extension's resolution algorithm; the early-return on first match reads clearer than an array-method rewrite here.
  for (const change of changes) {
    const protocolName = PROTOCOL_NAMES[change.type];
    if (!protocolName) {
      // eslint-disable-next-line no-continue -- ported verbatim; see the loop's disable reason above.
      continue;
    }
    const label = labels[`${change.type}:${change.reason}` as ActionKey];
    if (!label) {
      // eslint-disable-next-line no-continue -- ported verbatim; see the loop's disable reason above.
      continue;
    }
    return { label, protocolName };
  }
  return null;
};
