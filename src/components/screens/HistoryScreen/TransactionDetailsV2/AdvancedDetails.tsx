import { Operation, OperationRecord, xdr } from "@stellar/stellar-sdk";
import { List, ListItemProps } from "components/List";
import Operations from "components/screens/SignTransactionDetails/components/Operations";
import SignTransactionAuthorizations from "components/screens/SignTransactionDetails/components/SignTransactionAuthorizations";
import { AuthEntryDisplay } from "components/screens/SignTransactionDetails/types";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { HistoryEntry, HistoryOperation } from "helpers/history/v2/model";
import { getAuthEntryBoundAddress } from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import React, { useMemo } from "react";
import { TouchableOpacity, View } from "react-native";

/**
 * Decode the base64 xdr.Operation each HistoryOperation carries.
 *
 * A failure drops that one operation from `records` rather than failing the
 * view — the same discipline the history page needed when a single malformed
 * amount could throw and blank the whole list.
 *
 * Failures are *reported* in `failedIds` rather than merely dropped, because
 * the XDR list below deliberately keeps a row for every operation including
 * the ones that failed (see the comment on `xdrItems`). Returning both from
 * one pass is what keeps that list from having to decode everything a second
 * time just to learn which ids failed.
 *
 * Note: `Operation.fromXDRObject` is typed to return `OperationRecord` (the
 * parsed-operation union), not the `Operation` class itself — `Operation` is
 * the builder/static-methods surface, `OperationRecord` is what parsing one
 * back out actually produces. `records` is `OperationRecord[]` accordingly,
 * matching what `Operations`' `operations` prop expects.
 */
export const decodeOperations = (
  operations: HistoryOperation[],
): { records: OperationRecord[]; failedIds: Set<string> } => {
  const records: OperationRecord[] = [];
  const failedIds = new Set<string>();

  operations.forEach((op) => {
    try {
      records.push(
        Operation.fromXDRObject(xdr.Operation.fromXDR(op.xdr, "base64")),
      );
    } catch {
      failedIds.add(op.id);
    }
  });

  return { records, failedIds };
};

/**
 * The "advanced" view of the v2 transaction detail sheet: decoded operations
 * (via the shared sign-flow `Operations` renderer), any Soroban authorization
 * entries those operations carry, and a copyable XDR affordance.
 *
 * `Operations`' prop type (`OperationRecord[]`) is the parsed-operation union
 * from `@stellar/stellar-sdk`, not Horizon JSON, so what `decodeOperations`
 * returns drops straight in — no adaptation layer needed.
 *
 * Note: the v2 history model (`HistoryEntry`) carries no full-envelope
 * transaction XDR, only a per-operation base64 blob on each `HistoryOperation`
 * — unlike the sign flow, which has the whole signed `Transaction` on hand.
 * So the XDR section below renders one copyable row per operation instead of
 * a single transaction-level row, titled by each operation's raw `type` (and
 * flagged when that operation failed to decode) rather than a repeated "XDR"
 * label, so the rows correlate with the operation cards above them.
 */
export const AdvancedDetails: React.FC<{
  entry: HistoryEntry;
  onBack: () => void;
}> = ({ entry, onBack }) => {
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();

  const { records, failedIds } = useMemo(
    () => decodeOperations(entry.details.operations),
    [entry.details.operations],
  );

  // Replicates buildAuthEntries from
  // components/screens/SignTransactionDetails/hooks/useSignTransactionDetails.ts:55-70.
  // That helper isn't exported and operates on a Transaction/FeeBumpTransaction;
  // this view only has the already-decoded OperationRecord[] above, so the five-line
  // mapping (filter invokeHostFunction ops -> flatten their auth entries -> map
  // to { invocation, boundAddress }) is duplicated here rather than reused.
  const authEntries: AuthEntryDisplay[] = useMemo(() => {
    const allAuthEntries = records
      .filter(
        (operation): operation is Operation.InvokeHostFunction =>
          operation.type === "invokeHostFunction",
      )
      .flatMap((operation) => operation.auth ?? []);

    if (!allAuthEntries.length) return [];

    return allAuthEntries.map((authEntry) => ({
      invocation: authEntry.rootInvocation(),
      boundAddress: getAuthEntryBoundAddress(authEntry),
    }));
  }, [records]);

  // Built from the raw (not decoded) operations, deliberately: an operation
  // that failed to decode is precisely the one whose XDR a user most needs to
  // copy (to inspect it elsewhere, file a bug, etc.), so dropping it here
  // would remove the most useful row rather than the least useful one.
  //
  // Because this list can therefore be longer than `records` (one row goes
  // missing from `Operations` per failure, none go missing here), each row
  // is titled by the operation's own raw `type` — present regardless of
  // decode success — so it still correlates with the matching card above,
  // and rows whose operation failed to decode are explicitly marked rather
  // than silently outnumbering the operation cards with no explanation.
  const xdrItems: ListItemProps[] = entry.details.operations.map(
    (operation) => {
      const decodeFailed = failedIds.has(operation.id);

      return {
        key: `xdr-${operation.id}`,
        testID: `xdr-row-${operation.id}`,
        title: decodeFailed
          ? `${operation.type} · ${t("history.v2.detail.xdrDecodeFailed")}`
          : operation.type,
        onPress: () => copyToClipboard(operation.xdr),
        trailingContent: (
          <View className="flex-row items-center gap-[8px]">
            <Icon.Copy01 size={16} themeColor="gray" />
            <Text md medium>
              {truncateAddress(operation.xdr, 10, 4)}
            </Text>
          </View>
        ),
      };
    },
  );

  return (
    <View testID="advanced-details" className="gap-[24px]">
      <View className="flex-row items-center gap-[12px]">
        <TouchableOpacity
          testID="detail-sheet-back"
          onPress={onBack}
          accessibilityLabel={t("history.v2.detail.back")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="w-[40px] h-[40px] items-center justify-center"
        >
          <Icon.ArrowLeft size={24} themeColor="gray" />
        </TouchableOpacity>
        <Text lg primary medium>
          {t("history.v2.detail.advancedTitle")}
        </Text>
      </View>

      <View className="gap-[12px]">
        <Text sm secondary>
          {t("history.v2.detail.operations")}
        </Text>
        {/* deferInitialRender={false}: `records` is decoded synchronously
            above, before this mounts, so the shared component's 500ms
            spinner would be waiting on nothing. */}
        <Operations operations={records} deferInitialRender={false} />
      </View>

      {authEntries.length > 0 && (
        <SignTransactionAuthorizations authEntries={authEntries} />
      )}

      {xdrItems.length > 0 && (
        <View className="gap-[12px]">
          <Text sm secondary>
            {t("transactionAmountScreen.details.xdr")}
          </Text>
          <List items={xdrItems} variant="secondary" />
        </View>
      )}
    </View>
  );
};
