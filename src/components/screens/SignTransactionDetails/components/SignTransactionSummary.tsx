import { List } from "components/List";
import { SignTransactionSummaryInterface } from "components/screens/SignTransactionDetails/types";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { formatTokenAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

const mapMemoLabel = {
  id: "MEMO_ID",
  hash: "MEMO_HASH",
  text: "MEMO_TEXT",
  return: "MEMO_RETURN",
  none: "MEMO_NONE",
};

interface SignTransactionSummaryProps {
  summary: SignTransactionSummaryInterface;
}

const SignTransactionSummary = ({ summary }: SignTransactionSummaryProps) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();

  const { memo, xdr, sequenceNumber, feeXlm, operationsCount } = summary;

  const summaryItems = [
    {
      title: t("signTransactionDetails.summary.operationsCount"),
      trailingContent: <Text>{operationsCount}</Text>,
      titleColor: themeColors.text.secondary,
    },
    {
      title: t("signTransactionDetails.summary.fee"),
      trailingContent: (
        <Text>{formatTokenAmount(feeXlm, NATIVE_TOKEN_CODE)}</Text>
      ),
      titleColor: themeColors.text.secondary,
    },
    {
      title: t("signTransactionDetails.summary.sequence"),
      trailingContent: (
        <View className="flex-row items-center gap-[8px]">
          <Icon.Copy01
            size={16}
            themeColor="gray"
            onPress={() => copyToClipboard(sequenceNumber)}
          />
          <Text>{truncateAddress(String(sequenceNumber), 11, 0)}</Text>
        </View>
      ),
      titleColor: themeColors.text.secondary,
    },
    ...(memo?.value
      ? [
          {
            title: t("signTransactionDetails.summary.memo"),
            trailingContent: (
              <View className="flex-row items-center gap-[8px]">
                <Icon.Copy01
                  size={16}
                  themeColor="gray"
                  onPress={() => copyToClipboard(String(memo.value))}
                />
                <Text>{`${memo.value} (${mapMemoLabel[memo.type]})`}</Text>
              </View>
            ),
            titleColor: themeColors.text.secondary,
          },
        ]
      : []),
    {
      title: t("signTransactionDetails.summary.xdr"),
      trailingContent: (
        <View className="flex-row items-center gap-[8px]">
          <Icon.Copy01
            size={16}
            themeColor="gray"
            onPress={() => copyToClipboard(xdr)}
          />
          <Text>{truncateAddress(String(xdr), 10, 0)}</Text>
        </View>
      ),
      titleColor: themeColors.text.secondary,
    },
  ];

  return <List variant="secondary" items={summaryItems} />;
};

export default SignTransactionSummary;
