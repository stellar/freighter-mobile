import TransactionDetailsContent from "components/screens/HistoryScreen/TransactionDetailsContent";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { decodeDataValue } from "helpers/history/v2/decodeDataValue";
import { DataEntrySelection } from "helpers/history/v2/model";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { TouchableOpacity, View } from "react-native";

/**
 * The expanded view of a single account data entry, opened from a tappable
 * key row in a "dataEntry" state-change card. On-chain, a data entry value is
 * `opaque<64>` — arbitrary bytes with no declared charset — so
 * `decodeDataValue` renders it as text when the bytes are valid, printable
 * UTF-8, and falls back to the raw base64 otherwise.
 *
 * Guarded on the fields (`valueOldB64`/`valueNewB64`), not `selection.verb`:
 * an "added" entry is expected to carry only a new value and a "removed"
 * entry only an old one, but a model/verb mismatch must degrade to omitting
 * the missing field rather than rendering an empty value or crashing.
 *
 * Unlike the tappable row it expands from (which truncates the key to fit a
 * list row), this view exists specifically to show the untruncated key.
 */
export const DataEntryDetails: React.FC<{
  selection: DataEntrySelection;
  onBack: () => void;
}> = ({ selection, onBack }) => {
  const { t } = useAppTranslation();
  const { entry } = selection;

  const previousValue =
    entry.valueOldB64 !== null ? decodeDataValue(entry.valueOldB64) : null;
  const newValue =
    entry.valueNewB64 !== null ? decodeDataValue(entry.valueNewB64) : null;

  return (
    <View testID="data-entry-details" className="gap-[24px]">
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
      </View>

      <TransactionDetailsContent>
        <Text md primary medium>
          {entry.key}
        </Text>

        {entry.valueOldB64 !== null && (
          <View className="gap-[4px]">
            <Text sm secondary>
              {t("history.v2.detail.dataEntryPreviousValue")}
            </Text>
            <Text md primary medium>
              {previousValue}
            </Text>
          </View>
        )}

        {entry.valueNewB64 !== null && (
          <View className="gap-[4px]">
            <Text sm secondary>
              {t("history.v2.detail.dataEntryValue")}
            </Text>
            <Text md primary medium>
              {newValue}
            </Text>
          </View>
        )}
      </TransactionDetailsContent>
    </View>
  );
};
