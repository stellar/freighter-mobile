import BigNumber from "bignumber.js";
import { List, ListItemProps } from "components/List";
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
import { AnalyticsEvent } from "config/analyticsConfig";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { THEME } from "config/theme";
import { calculateSwapRate } from "helpers/balances";
import { formatDate } from "helpers/date";
import { formatTokenAmount, stroopToXlm } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { Linking, View } from "react-native";
import { analytics } from "services/analytics";

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
  const swapRate =
    transactionDetails.transactionType === TransactionType.SWAP
      ? calculateSwapRate(
          transactionDetails.swapDetails?.sourceAmount ?? "0",
          transactionDetails.swapDetails?.destinationAmount ?? "0",
        )
      : "0";
  const formattedSwapRate = new BigNumber(swapRate).toFixed(2, 1);
  const swapRateText = `1 ${transactionDetails.swapDetails?.sourceTokenCode} ≈ ${formatTokenAmount(formattedSwapRate, transactionDetails.swapDetails?.destinationTokenCode ?? "")}`;
  const detailItems = [
    {
      icon: (
        <Icon.ClockCheck size={16} color={themeColors.foreground.primary} />
      ),
      titleComponent: (
        <Text md secondary>
          {t("history.transactionDetails.status")}
        </Text>
      ),
      trailingContent: (
        <Text
          md
          secondary
          color={
            isSuccess ? themeColors.status.success : themeColors.status.error
          }
        >
          {isSuccess
            ? t("history.transactionDetails.statusSuccess")
            : t("history.transactionDetails.statusFailed")}
        </Text>
      ),
    },
    transactionDetails.transactionType === TransactionType.SWAP
      ? {
          icon: (
            <Icon.Divide03 size={16} color={themeColors.foreground.primary} />
          ),
          titleComponent: (
            <Text md secondary>
              {t("history.transactionDetails.rate")}
            </Text>
          ),
          trailingContent: (
            <Text md secondary color={THEME.colors.text.primary}>
              {swapRateText}
            </Text>
          ),
        }
      : undefined,
    {
      icon: <Icon.Route size={16} color={themeColors.foreground.primary} />,
      titleComponent: (
        <Text md secondary color={THEME.colors.text.secondary}>
          {t("history.transactionDetails.fee")}
        </Text>
      ),
      trailingContent: (
        <Text md secondary color={THEME.colors.text.primary}>
          {formatTokenAmount(fee, NATIVE_TOKEN_CODE)}
        </Text>
      ),
    },
    // filter out undefined entries for non-swaps in order to keep detail order.
  ].filter(Boolean) as ListItemProps[];

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

      <List items={detailItems} />
      <Button
        isFullWidth
        tertiary
        lg
        icon={<Icon.LinkExternal01 size={16} color={themeColors.base[0]} />}
        onPress={() => {
          analytics.track(AnalyticsEvent.HISTORY_OPEN_FULL_HISTORY);

          Linking.openURL(transactionDetails.externalUrl);
        }}
      >
        {t("history.transactionDetails.viewOnStellarExpert")}
      </Button>
    </View>
  );
};
