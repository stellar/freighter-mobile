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
 * entry's title, a failed marker when the transaction did not succeed, and
 * the formatted timestamp. Consumes `formatDetailTimestamp` from
 * `helpers/date`, ported in Phase A and otherwise unused until now.
 */
export const DetailHeader: React.FC<{ entry: HistoryEntry }> = ({ entry }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const isFailed = entry.details.status === "failed";

  return (
    <View className="items-center gap-4">
      {renderRowIcon(entry.rowIcon)}
      <View className="items-center gap-1">
        <Text lg primary medium numberOfLines={1}>
          {entry.details.title}
        </Text>
        <View className="flex-row items-center gap-1">
          {isFailed && (
            <Text sm medium color={themeColors.status.error}>
              {t("history.v2.detail.statusFailed")} ·
            </Text>
          )}
          <Text sm secondary>
            {formatDetailTimestamp(entry.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
};
