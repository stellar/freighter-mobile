import { List, ListItemProps } from "components/List";
import { AdvancedDetails } from "components/screens/HistoryScreen/TransactionDetailsV2/AdvancedDetails";
import { BalanceChangesCard } from "components/screens/HistoryScreen/TransactionDetailsV2/BalanceChangesCard";
import { DataEntryDetails } from "components/screens/HistoryScreen/TransactionDetailsV2/DataEntryDetails";
import { DetailHeader } from "components/screens/HistoryScreen/TransactionDetailsV2/DetailHeader";
import { MetaCard } from "components/screens/HistoryScreen/TransactionDetailsV2/MetaCard";
import {
  buildStateChangeItems,
  StateChangeItemContext,
} from "components/screens/HistoryScreen/TransactionDetailsV2/stateChangeItems";
import { TextButton } from "components/sds/TextButton";
import { Text } from "components/sds/Typography";
import {
  DataEntrySelection,
  HistoryEntry,
  StateChangeCardData,
} from "helpers/history/v2/model";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState } from "react";
import { View } from "react-native";

/**
 * Short heading i18n key per state-change card kind, keyed by `card.kind` —
 * this is the composition layer, not the pure-data builder module
 * (stateChangeItems.tsx), so it's the right place for these: nothing there
 * ever barred a header, there's just never been one rendered until now.
 * Without it, a signers card reads as a bare address + "Added 2" ("2" of
 * what?) and a trustlines card reads as a token code + "Added 500" (a
 * limit) — the card's own kind is the only thing that disambiguates either.
 *
 * A `satisfies Record<..., string>` object (rather than a switch calling
 * `t()` directly) for two reasons: it keeps the exhaustiveness check (a new
 * `kind` without an entry here fails to typecheck) without also having to
 * pass i18next's overloaded `TFunction` into this function — doing that
 * crashes tsc 5.8.3 ("Debug Failure. No error for last overload signature")
 * when the call is inlined inside a JSX expression. Callers call `t()`
 * themselves with the key this returns.
 */
const CARD_HEADING_KEYS = {
  accountCreated: "history.v2.detail.cardAccountCreated",
  accountMerged: "history.v2.detail.cardAccountMerged",
  signers: "history.v2.detail.cardSigners",
  thresholds: "history.v2.detail.cardThresholds",
  dataEntry: "history.v2.detail.cardDataEntry",
  homeDomain: "history.v2.detail.cardHomeDomain",
  flags: "history.v2.detail.cardFlags",
  trustlines: "history.v2.detail.cardTrustlines",
  balanceAuthorizations: "history.v2.detail.cardBalanceAuthorizations",
  allowance: "history.v2.detail.cardAllowance",
} as const satisfies Record<StateChangeCardData["kind"], string>;

const cardHeadingKey = (kind: StateChangeCardData["kind"]) =>
  CARD_HEADING_KEYS[kind];

/**
 * "detail" is the sheet's resting state; "advanced" and "dataEntry" are
 * swapped in over it in place. Mirrors the extension's single-sheet
 * `SheetView` state machine (history-redesign-plan.md) rather than stacking
 * a second BottomSheet on top of the one HistoryList already owns.
 */
type SheetView = "detail" | "advanced" | "dataEntry";

/**
 * The v2 transaction detail sheet: a view state machine composing every
 * piece built in Tasks 1-6 (state-change card builders, DetailHeader,
 * BalanceChangesCard, MetaCard, AdvancedDetails, DataEntryDetails) into the
 * three views the extension's design calls for. Rendered as the
 * `customContent` of the bottom sheet HistoryList already owns (Task 8) —
 * this component never opens a BottomSheet of its own.
 */
export const TransactionDetailsV2: React.FC<{ entry: HistoryEntry }> = ({
  entry,
}) => {
  const { t } = useAppTranslation();
  const [view, setView] = useState<SheetView>("detail");
  const [selection, setSelection] = useState<DataEntrySelection | null>(null);

  const backToDetail = (): void => setView("detail");

  const ctx: StateChangeItemContext = {
    onSelectDataEntry: (nextSelection) => {
      setSelection(nextSelection);
      setView("dataEntry");
    },
  };

  if (view === "advanced") {
    return <AdvancedDetails entry={entry} onBack={backToDetail} />;
  }

  // A null selection while view === "dataEntry" would render an empty sheet
  // (DataEntryDetails requires a non-null selection prop) — fall back to the
  // detail view instead. Not reachable via onSelectDataEntry, which always
  // sets both together, but guards against a future caller setting the view
  // without a selection.
  if (view === "dataEntry" && selection !== null) {
    return <DataEntryDetails selection={selection} onBack={backToDetail} />;
  }

  return (
    <View className="gap-[24px]">
      <DetailHeader entry={entry} />

      {entry.details.stateChangeCards.map((card, index) => {
        const items: ListItemProps[] = buildStateChangeItems(card, ctx);
        return (
          <View
            // Cards have no stable id of their own; kind+index is stable for
            // the life of this render and cards never reorder in place.
            // eslint-disable-next-line react/no-array-index-key
            key={`${card.kind}-${index}`}
            testID="state-change-card"
            className="gap-3"
          >
            {/* Disambiguates otherwise-ambiguous rows — e.g. a signers card's
              "Added 2" (2 of what?) or a trustlines card's "Added 500" (a
              limit) only read correctly once the card's own kind is named. */}
            <Text sm secondary>
              {t(cardHeadingKey(card.kind))}
            </Text>
            <List items={items} variant="secondary" />
          </View>
        );
      })}

      <BalanceChangesCard rows={entry.details.balanceChanges} />

      <MetaCard details={entry.details} />

      <TextButton
        testID="advanced-details-link"
        text={t("history.v2.detail.advancedTitle")}
        variant="tertiary"
        onPress={() => setView("advanced")}
      />
    </View>
  );
};
