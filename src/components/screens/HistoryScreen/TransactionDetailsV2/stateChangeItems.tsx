import { ListItemProps } from "components/List";
import { assertNever } from "components/screens/HistoryScreen/helpers";
import Icon from "components/sds/Icon";
import {
  DataEntrySelection,
  StateChangeCardData,
} from "helpers/history/v2/model";
import { truncateAddress } from "helpers/stellar";
import { t } from "i18next";
import React from "react";

export type StateChangeItemContext = {
  /** opens the dataEntry view; only the dataEntry builder uses it */
  onSelectDataEntry: (selection: DataEntrySelection) => void;
};

/** Em dash for a value we could not determine — never a guessed number. */
export const EM_DASH = "—";

/**
 * Describe an old → new change.
 *
 * A null side is not "empty": in the model it means the thing is being added
 * (no old value) or removed (no new value). Both cases keep the one value
 * that exists visible alongside a word marker, so "added" and "removed" read
 * symmetrically instead of one showing a bare number and the other showing
 * only a word with the value silently dropped.
 */
export const transitionDescription = (
  oldValue: string | null,
  newValue: string | null,
): string => {
  if (oldValue === null && newValue !== null) {
    const added: string = t("history.v2.detail.added");
    return `${added} ${newValue}`;
  }
  if (newValue === null && oldValue !== null) {
    const removed: string = t("history.v2.detail.removed");
    return `${removed} ${oldValue}`;
  }
  if (oldValue === null && newValue === null) {
    // Not reachable from any current StateChangeCardData shape, but
    // returning the removed wording here would assert something we don't
    // know — an em dash signals "we can't determine this" rather than a
    // guessed direction.
    return EM_DASH;
  }
  return `${oldValue} → ${newValue}`;
};

/**
 * A whole row for a transition whose label IS the field name (thresholds, home
 * domain). Cards whose row label is an address or token code — signers,
 * trustlines — build their own row and call `transitionDescription` directly,
 * rather than passing a title here only to override it.
 */
export const transitionItem = (
  title: string,
  oldValue: string | null,
  newValue: string | null,
): ListItemProps => ({
  title,
  value: transitionDescription(oldValue, newValue),
});

type Builder<K extends StateChangeCardData["kind"]> = (
  card: Extract<StateChangeCardData, { kind: K }>,
  ctx: StateChangeItemContext,
) => ListItemProps[];

export const signersItems: Builder<"signers"> = (card) =>
  card.entries.map((entry) => ({
    key: entry.address,
    title: truncateAddress(entry.address),
    value: transitionDescription(
      entry.weightOld === null ? null : String(entry.weightOld),
      entry.weightNew === null ? null : String(entry.weightNew),
    ),
  }));

export const thresholdsItems: Builder<"thresholds"> = (card) => [
  {
    ...transitionItem(
      t("history.v2.detail.threshold", { level: card.level }),
      card.valueOld,
      card.valueNew,
    ),
    key: `threshold-${card.level}`,
  },
];

export const homeDomainItems: Builder<"homeDomain"> = (card) => [
  {
    ...transitionItem(
      t("history.v2.detail.homeDomain"),
      card.domainOld,
      card.domainNew,
    ),
    key: "home-domain",
  },
];

export const trustlinesItems: Builder<"trustlines"> = (card) =>
  card.entries.map((entry) => ({
    key: entry.token.contractId ?? entry.token.code,
    title: entry.token.code,
    value: transitionDescription(entry.limitOld, entry.limitNew),
  }));

export const accountCreatedItems: Builder<"accountCreated"> = (card) => {
  const items: ListItemProps[] = [
    {
      key: "created-address",
      title: t("history.v2.detail.accountCreated"),
      value: truncateAddress(card.address),
    },
  ];

  if (card.funder) {
    items.push({
      key: "funder",
      title: t("history.v2.detail.funder"),
      value: truncateAddress(card.funder),
    });
  }

  return items;
};

export const accountMergedItems: Builder<"accountMerged"> = () => [
  { key: "account-merged", title: t("history.v2.detail.accountMerged") },
];

export const dataEntryItems: Builder<"dataEntry"> = (card, ctx) =>
  card.entries.map((entry) => ({
    key: entry.key,
    // The entry key is the visual anchor — the user scans key names. No static
    // label: the card's own heading (added in index.tsx) already says these
    // are data entries, so a "Key" label on every row would just repeat
    // itself. Deliberately title-only otherwise, unlike the label+value rows
    // elsewhere in this file.
    title: entry.key,
    // Tappable: opens the dataEntry view, where the value is decoded.
    onPress: () => ctx.onSelectDataEntry({ verb: card.verb, entry }),
    // Deliberate, narrow exception to this module's plain-data contract
    // (every other builder here returns strings only) — matches the same
    // exception AdvancedDetails.tsx already takes for its XDR rows. A row
    // with only `onPress` and no visual marker looks identical to a static
    // row (List renders both the same way), so a bare info icon is the
    // cheapest honest signal that tapping does something.
    trailingContent: <Icon.InfoCircle size={16} themeColor="gray" />,
  }));

export const flagsItems: Builder<"flags"> = (card) => {
  const items: ListItemProps[] = [];

  if (card.set.length) {
    items.push({
      key: "flags-set",
      title: t("history.v2.detail.flagsSet"),
      value: card.set.join(", "),
    });
  }

  if (card.cleared.length) {
    items.push({
      key: "flags-cleared",
      title: t("history.v2.detail.flagsCleared"),
      value: card.cleared.join(", "),
    });
  }

  return items;
};

export const balanceAuthorizationsItems: Builder<"balanceAuthorizations"> = (
  card,
) => [
  {
    key: "authorization",
    title: card.authorized
      ? t("history.v2.detail.authorized")
      : t("history.v2.detail.authorizationRevoked"),
    value: card.tokens.map((token) => token.code).join(", "),
  },
];

export const allowanceItems: Builder<"allowance"> = (card) => [
  {
    key: "allowance-token",
    title: t("history.v2.detail.token"),
    value: card.token.code,
  },
  {
    key: "allowance-spender",
    title: t("history.v2.detail.spender"),
    value: truncateAddress(card.spender),
  },
  {
    key: "allowance-amount",
    title: t("history.v2.detail.amount"),
    // null means the token's scale was never resolved — never guess a number.
    value: card.amount ?? EM_DASH,
  },
  {
    key: "allowance-expiration",
    title: t("history.v2.detail.expirationLedger"),
    value: String(card.expirationLedger),
  },
];

/** Single dispatch point over the card union. */
export const buildStateChangeItems = (
  card: StateChangeCardData,
  ctx: StateChangeItemContext,
): ListItemProps[] => {
  switch (card.kind) {
    case "accountCreated":
      return accountCreatedItems(card, ctx);
    case "accountMerged":
      return accountMergedItems(card, ctx);
    case "signers":
      return signersItems(card, ctx);
    case "thresholds":
      return thresholdsItems(card, ctx);
    case "dataEntry":
      return dataEntryItems(card, ctx);
    case "homeDomain":
      return homeDomainItems(card, ctx);
    case "flags":
      return flagsItems(card, ctx);
    case "trustlines":
      return trustlinesItems(card, ctx);
    case "balanceAuthorizations":
      return balanceAuthorizationsItems(card, ctx);
    case "allowance":
      return allowanceItems(card, ctx);
    default:
      return assertNever(card, "state-change card dispatcher") ?? [];
  }
};
