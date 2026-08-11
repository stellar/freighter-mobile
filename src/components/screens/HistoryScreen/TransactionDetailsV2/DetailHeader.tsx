import { renderRowIcon } from "components/screens/HistoryScreen/helpers";
import { Text } from "components/sds/Typography";
import { formatDetailTimestamp } from "helpers/date";
import { HistoryEntry } from "helpers/history/v2/model";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

/**
 * Leading header of the v2 transaction detail sheet: the row icon, the
 * entry's title, and the formatted timestamp — a left-aligned row laid out
 * exactly like v1's header in TransactionDetailsBottomSheetCustomContent, so
 * a v1 and a v2 sheet open to the same shape. A failed transaction gets a
 * marker ahead of the timestamp, since the v2 row's own failure icon isn't
 * repeated here.
 */
export const DetailHeader: React.FC<{ entry: HistoryEntry }> = ({ entry }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const isFailed = entry.details.status === "failed";

  return (
    <View className="flex-row items-center">
      {renderRowIcon(entry.rowIcon, themeColors)}
      <View className="ml-4 flex-1 mr-2">
        <Text md primary medium numberOfLines={1}>
          {entry.details.title}
        </Text>
        <View className="flex-row items-center gap-1">
          {isFailed && (
            <Text sm medium color={themeColors.status.error}>
              {t("history.transactionDetails.statusFailed")} ·
            </Text>
          )}
          <Text sm secondary numberOfLines={1}>
            {formatDetailTimestamp(entry.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
};
