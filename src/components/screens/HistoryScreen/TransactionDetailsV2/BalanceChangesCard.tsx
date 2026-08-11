import { List, ListItemProps } from "components/List";
import { EM_DASH } from "components/screens/HistoryScreen/TransactionDetailsV2/stateChangeItems";
import { Text } from "components/sds/Typography";
import { BalanceChangeRow } from "helpers/history/v2/model";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

/**
 * Card listing the balance changes a transaction produced, one row per
 * token: the token code and a signed amount (credit "+", debit "-"). Amounts
 * arrive already formatted by the Phase A pipeline — this never re-derives
 * or re-scales them. A null amount means the token's decimal scale was never
 * resolved, so it renders the shared em dash rather than a guessed number.
 *
 * Credits are coloured with the success status colour, matching how v1's
 * TransactionDetailsBottomSheetCustomContent (AssetDiffRow) colours its own
 * credit amount via `themeColors.status.success` — debits stay the default
 * primary text colour, same as v1's debit rows.
 */
export const BalanceChangesCard: React.FC<{ rows: BalanceChangeRow[] }> = ({
  rows,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  if (rows.length === 0) {
    return null;
  }

  const items: ListItemProps[] = rows.map((row, index) => ({
    key: `${row.token.contractId ?? row.token.code}-${index}`,
    title: row.token.code,
    value:
      row.amount === null
        ? EM_DASH
        : `${row.direction === "credit" ? "+" : "-"}${row.amount}`,
    valueColor:
      row.amount !== null && row.direction === "credit"
        ? themeColors.status.success
        : undefined,
  }));

  return (
    // `List(secondary)` already supplies its own background
    // (bg-background-tertiary) and 16px radius — the same treatment
    // TransactionDetailsContent would add. Matches the v1 precedent
    // (TransactionDetailsBottomSheetCustomContent.tsx renders its metadata
    // List bare, no wrapper) and MetaCard's own container-free rendering;
    // wrapping this List in TransactionDetailsContent's padded card would
    // double-pad it (~40px to row text instead of List's own ~16px),
    // misaligning this card's left edge against MetaCard's when the two
    // sit stacked in the same sheet.
    <View className="gap-3">
      <Text sm secondary>
        {t("history.v2.detail.balanceChanges")}
      </Text>
      <List items={items} variant="secondary" />
    </View>
  );
};
