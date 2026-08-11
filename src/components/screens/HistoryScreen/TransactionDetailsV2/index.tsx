import { List, ListItemProps } from "components/List";
import { AdvancedDetails } from "components/screens/HistoryScreen/TransactionDetailsV2/AdvancedDetails";
import { DataEntryDetails } from "components/screens/HistoryScreen/TransactionDetailsV2/DataEntryDetails";
import { DetailHeader } from "components/screens/HistoryScreen/TransactionDetailsV2/DetailHeader";
import {
  buildStateChangeItems,
  StateChangeItemContext,
} from "components/screens/HistoryScreen/TransactionDetailsV2/stateChangeItems";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { formatTokenForDisplay } from "helpers/formatAmount";
import { DataEntrySelection, HistoryEntry } from "helpers/history/v2/model";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useMemo, useState } from "react";
import { View } from "react-native";

/**
 * "detail" is the sheet's resting state; "advanced" and "dataEntry" are
 * swapped in over it in place, rather than stacking a second BottomSheet on
 * top of the one HistoryList already owns.
 */
type SheetView = "detail" | "advanced" | "dataEntry";

/**
 * The v2 transaction detail sheet.
 *
 * Deliberately the same shape as v1's
 * TransactionDetailsBottomSheetCustomContent — a `gap-6` column of header,
 * one changes card, one metadata card — because the v2 design changes what
 * goes in those cards, not the sheet itself. The two things it does add: the
 * state-change rows (which share the changes card with the balance changes,
 * rather than getting cards of their own) and the "Transaction details" row
 * that opens the advanced view.
 *
 * Both card item lists are built here in `useMemo`s, mirroring v1's
 * `detailItems`, so the whole sheet's row composition is readable in one
 * place and no i18next `TFunction` crosses a function boundary (passing one
 * into a helper called inline from JSX crashes tsc 5.8.3 with "Debug Failure.
 * No error for last overload signature").
 */
export const TransactionDetailsV2: React.FC<{ entry: HistoryEntry }> = ({
  entry,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const [view, setView] = useState<SheetView>("detail");
  const [selection, setSelection] = useState<DataEntrySelection | null>(null);

  const backToDetail = (): void => setView("detail");

  const { details } = entry;
  const isSuccess = details.status === "success";

  /**
   * The single changes card: counterparty, then state changes, then balance
   * changes — the order the design shows for both a plain payment ("To",
   * "Sent") and a config change ("Added signer", "Sent", "Received").
   */
  const changeItems = useMemo(() => {
    const ctx: StateChangeItemContext = {
      onSelectDataEntry: (nextSelection) => {
        setSelection(nextSelection);
        setView("dataEntry");
      },
    };

    // Credits-only means the funds came to us, so the counterparty is a
    // sender. Mirrors v1's `isReceiving` derivation from its asset diffs.
    const isReceiving =
      details.balanceChanges.length > 0 &&
      details.balanceChanges.every((row) => row.direction === "credit");

    const counterpartyItem: ListItemProps[] = details.counterparty
      ? [
          {
            key: "counterparty",
            icon: <Icon.User01 size={16} themeColor="gray" />,
            titleComponent: (
              <Text md secondary>
                {isReceiving
                  ? t("history.transactionDetails.from")
                  : t("history.transactionDetails.to")}
              </Text>
            ),
            value: truncateAddress(details.counterparty),
          },
        ]
      : [];

    const stateChangeItems = details.stateChangeCards.flatMap((card) =>
      buildStateChangeItems(card, ctx),
    );

    // Same treatment as v1's AssetDiffRow: a direction arrow, the verb as the
    // label, and the signed amount — with success/error colour carrying the
    // direction on both the label and the amount, as the design shows.
    const balanceItems: ListItemProps[] = details.balanceChanges.map(
      (row, index) => {
        const isCredit = row.direction === "credit";
        const color = isCredit
          ? themeColors.status.success
          : themeColors.status.error;

        return {
          key: `${row.token.contractId ?? row.token.code}-${index}`,
          icon: isCredit ? (
            <Icon.ArrowCircleDown size={16} color={color} />
          ) : (
            <Icon.ArrowCircleUp size={16} color={color} />
          ),
          titleComponent: (
            <Text md medium color={color}>
              {isCredit
                ? t("history.transactionHistory.received")
                : t("history.transactionHistory.sent")}
            </Text>
          ),
          // A null amount means the token's decimal scale was never resolved,
          // so the sign would be the only truthful part of a formatted number.
          value:
            row.amount === null
              ? row.token.code
              : `${isCredit ? "+" : "-"}${formatTokenForDisplay(row.amount, row.token.code)}`,
          valueColor: color,
        };
      },
    );

    return [...counterpartyItem, ...stateChangeItems, ...balanceItems];
  }, [details, t, themeColors.status.success, themeColors.status.error]);

  /** Status, rate, fee — v1's metadata card minus the rows the design moves
   * into the advanced view (XDR) or the changes card (counterparty). */
  const metaItems = useMemo(
    () =>
      [
        {
          key: "status",
          icon: <Icon.ClockCheck size={16} themeColor="gray" />,
          titleComponent: (
            <Text md secondary>
              {t("history.transactionDetails.status")}
            </Text>
          ),
          value: isSuccess
            ? t("history.transactionDetails.statusSuccess")
            : t("history.transactionDetails.statusFailed"),
        },
        details.rate && {
          key: "rate",
          icon: <Icon.Divide03 size={16} themeColor="gray" />,
          titleComponent: (
            <Text md secondary>
              {t("history.transactionDetails.rate")}
            </Text>
          ),
          value: details.rate,
        },
        {
          key: "fee",
          icon: <Icon.Route size={16} themeColor="gray" />,
          titleComponent: (
            <Text md secondary>
              {t("history.transactionDetails.fee")}
            </Text>
          ),
          value: formatTokenForDisplay(details.fee, NATIVE_TOKEN_CODE),
        },
        // filter out the absent rate row to keep the remaining order.
      ].filter(Boolean) as ListItemProps[],
    [details.rate, details.fee, isSuccess, t],
  );

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
    <View className="gap-6">
      <DetailHeader entry={entry} />

      {changeItems.length > 0 && (
        <List items={changeItems} variant="secondary" />
      )}

      <List items={metaItems} variant="secondary" />

      <List
        variant="secondary"
        items={[
          {
            key: "advanced",
            testID: "advanced-details-link",
            icon: <Icon.Dotpoints01 size={16} color={themeColors.lilac[11]} />,
            titleComponent: (
              <Text md medium color={themeColors.lilac[11]}>
                {t("history.v2.detail.advancedTitle")}
              </Text>
            ),
            onPress: () => setView("advanced"),
          },
        ]}
      />
    </View>
  );
};
