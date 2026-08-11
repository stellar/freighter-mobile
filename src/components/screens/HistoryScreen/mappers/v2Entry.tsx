/**
 * THROWAWAY ADAPTER — delete in Phase B.
 *
 * Bridges the pure v2 view model (HistoryEntry) onto the shape the existing
 * v1 HistoryItem renders (HistoryItemData), so Phase A ships the whole data
 * layer without touching the row UI. Phase B renders HistoryEntry directly
 * (a real row component reading rowIcon/primaryText/secondaryText/amounts
 * itself) and this file — along with the renderRowIcon/renderSecondaryIcon
 * helpers in HistoryScreen/helpers.tsx it depends on — goes away. Do not add
 * logic here that belongs in the mappers under helpers/history/v2 instead.
 */
import {
  renderRowIcon,
  renderSecondaryIcon,
} from "components/screens/HistoryScreen/helpers";
import {
  HistoryItemData,
  TransactionStatus,
} from "components/screens/HistoryScreen/types";
import { formatMonthDay } from "helpers/date";
import { HistoryEntry } from "helpers/history/v2/model";
import { ThemeColors } from "hooks/useColors";
import { t } from "i18next";

export const mapV2EntryToHistoryItemData = (
  entry: HistoryEntry,
  themeColors: ThemeColors,
): HistoryItemData => {
  const { amounts } = entry;

  // Swaps carry credit first, and the row shows a single line — so the
  // credit is what the user sees, matching the v1 swap row (v1's swap
  // mapper always shows the destination/credit amount too).
  const primaryAmount = Array.isArray(amounts) ? amounts[0] : null;

  const amountText = (() => {
    if (amounts === "multiple") {
      return t("history.v2.amounts.multiple");
    }
    return primaryAmount?.text ?? null;
  })();

  return {
    rowText: entry.primaryText,
    actionText: entry.secondaryText || null,
    dateText: formatMonthDay(entry.createdAt),
    amountText,
    isAddingFunds: primaryAmount ? primaryAmount.direction === "credit" : false,
    IconComponent: renderRowIcon(entry.rowIcon, themeColors),
    ActionIconComponent: renderSecondaryIcon(entry.secondaryIcon, themeColors),
    transactionStatus:
      entry.details.status === "failed"
        ? TransactionStatus.FAILED
        : TransactionStatus.SUCCESS,
    // The v1 detail sheet reads a Horizon operation this model does not
    // carry, so v2 rows never populate this field. `historyEntry` below is
    // what HistoryItem's press handler uses instead (see the
    // handleV2TransactionDetails branch in HistoryItem.tsx).
    transactionDetails: undefined,
    // Carries the raw entry through so HistoryItem's press handler can open
    // the v2 sheet (Task 8) with it, without needing to change this
    // function's signature. Goes away with the rest of this adapter in
    // Phase B.
    historyEntry: entry,
  };
};
