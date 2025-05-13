import {
  renderActionIcon,
  renderIconComponent,
} from "components/screens/HistoryScreen/helpers";
import { CreateAccountTransactionDetailsContent } from "components/screens/HistoryScreen/mappers/createAccount";
import { PaymentTransactionDetailsContent } from "components/screens/HistoryScreen/mappers/payment";
import { SorobanTransferTransactionDetailsContent } from "components/screens/HistoryScreen/mappers/soroban";
import { SwapTransactionDetailsContent } from "components/screens/HistoryScreen/mappers/swap";
import {
  TransactionDetails,
  TransactionStatus,
  TransactionType,
} from "components/screens/HistoryScreen/types";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { formatDate } from "helpers/date";
import { stroopToXlm } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { Linking, View } from "react-native";

interface TransactionDetailsBottomSheetCustomContentProps {
  transactionDetails: TransactionDetails | null;
}

/**
 * Renders the transaction details in the bottom sheet
 */
export const TransactionDetailsBottomSheetCustomContent: React.FC<
  TransactionDetailsBottomSheetCustomContentProps
> = ({ transactionDetails }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

  if (!transactionDetails) {
    return null;
  }

  const fee = stroopToXlm(transactionDetails.fee).toString();
  const formattedDate = formatDate({
    date: transactionDetails?.operation.created_at ?? "",
    includeTime: true,
  });
  const isSuccess = transactionDetails.status === TransactionStatus.SUCCESS;

  return (
    <View className="flex-1 justify-center gap-6">
      <View className="flex-row items-center flex-1">
        {renderIconComponent({
          iconComponent: transactionDetails.IconComponent as React.ReactElement,
          themeColors,
        })}
        <View className="ml-4 flex-1 mr-2">
          <Text md primary medium numberOfLines={1}>
            {transactionDetails.transactionTitle}
          </Text>
          <View className="flex-row items-center gap-1">
            {renderActionIcon({
              actionIcon:
                transactionDetails.ActionIconComponent as React.ReactElement,
              themeColors,
            })}
            <Text sm secondary numberOfLines={1}>
              {formattedDate}
            </Text>
          </View>
        </View>
      </View>

      {transactionDetails.transactionType ===
        TransactionType.CREATE_ACCOUNT && (
        <CreateAccountTransactionDetailsContent
          transactionDetails={transactionDetails}
        />
      )}

      {transactionDetails.transactionType === TransactionType.SWAP && (
        <SwapTransactionDetailsContent
          transactionDetails={transactionDetails}
        />
      )}

      {transactionDetails.transactionType === TransactionType.PAYMENT && (
        <PaymentTransactionDetailsContent
          transactionDetails={transactionDetails}
        />
      )}

      {transactionDetails.transactionType ===
        TransactionType.CONTRACT_TRANSFER && (
        <SorobanTransferTransactionDetailsContent
          transactionDetails={transactionDetails}
        />
      )}

      <View className="flex-1 justify-center bg-background-primary rounded-2xl p-6 gap-3 border border-border-primary">
        <View className="flex-row justify-between">
          <View className="flex-row items-center justify-center gap-2">
            <Icon.ClockCheck size={16} color={themeColors.foreground.primary} />
            <Text md secondary medium numberOfLines={1}>
              {t("history.transactionDetails.status")}
            </Text>
          </View>
          <Text
            md
            primary
            numberOfLines={1}
            color={
              isSuccess ? themeColors.status.success : themeColors.status.error
            }
          >
            {isSuccess
              ? t("history.transactionDetails.statusSuccess")
              : t("history.transactionDetails.statusFailed")}
          </Text>
        </View>

        <View className="flex-row justify-between">
          <View className="flex-row items-center justify-center gap-2">
            <Icon.Divide03 size={16} color={themeColors.foreground.primary} />
            <Text md secondary medium numberOfLines={1}>
              {t("history.transactionDetails.rate")}
            </Text>
          </View>
          <Text md primary numberOfLines={1}>
            {/* TODO: format rate */}-
          </Text>
        </View>

        <View className="flex-row justify-between">
          <View className="flex-row items-center justify-center gap-2">
            <Icon.Route size={16} color={themeColors.foreground.primary} />
            <Text md secondary medium numberOfLines={1}>
              {t("history.transactionDetails.fee")}
            </Text>
          </View>
          <Text md primary numberOfLines={1}>
            {fee} XLM
          </Text>
        </View>
      </View>
      <Button
        isFullWidth
        tertiary
        lg
        icon={<Icon.LinkExternal01 size={16} color={themeColors.base[0]} />}
        onPress={() => {
          Linking.openURL(transactionDetails.externalUrl);
        }}
      >
        {t("history.transactionDetails.viewOnStellarExpert")}
      </Button>
    </View>
  );
};
