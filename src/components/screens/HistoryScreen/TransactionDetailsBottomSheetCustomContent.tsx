import BigNumber from "bignumber.js";
import { List, ListItemProps } from "components/List";
import {
  renderActionIcon,
  renderIconComponent,
} from "components/screens/HistoryScreen/helpers";
import { CreateAccountTransactionDetailsContent } from "components/screens/HistoryScreen/mappers/createAccount";
import { PaymentTransactionDetailsContent } from "components/screens/HistoryScreen/mappers/payment";
import {
  SorobanTokenTransferTransactionDetailsContent,
  SorobanCollectibleTransferTransactionDetailsContent,
} from "components/screens/HistoryScreen/mappers/soroban";
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
import { formatTokenForDisplay, stroopToXlm } from "helpers/formatAmount";
import { truncateAddress, isMuxedAccount } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useCallback, useMemo } from "react";
import { View } from "react-native";
import { analytics } from "services/analytics";

interface TransactionDetailsBottomSheetCustomContentProps {
  transactionDetails: TransactionDetails;
}

/**
 * Renders the transaction details in the bottom sheet
 */
export const TransactionDetailsBottomSheetCustomContent: React.FC<
  TransactionDetailsBottomSheetCustomContentProps
> = ({ transactionDetails }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { open: openInAppBrowser } = useInAppBrowser();
  const { copyToClipboard } = useClipboard();

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
  const swapRateText = `1 ${transactionDetails.swapDetails?.sourceTokenCode} ≈ ${formatTokenForDisplay(formattedSwapRate, transactionDetails.swapDetails?.destinationTokenCode ?? "")}`;

  const handleCopyXdr = useCallback(() => {
    if (transactionDetails.xdr) {
      copyToClipboard(transactionDetails.xdr, {
        notificationMessage: t("common.copied"),
      });
    }
  }, [transactionDetails.xdr, copyToClipboard, t]);

  // Check if destination is a muxed address (M- address)
  // For payment transactions, check paymentDetails.to
  // For contract transfers, check contractDetails.transferDetails.to or collectibleTransferDetails.to
  const destinationAddress =
    transactionDetails.paymentDetails?.to ||
    transactionDetails.contractDetails?.transferDetails?.to ||
    transactionDetails.contractDetails?.collectibleTransferDetails?.to;
  const isDestinationMuxed = destinationAddress
    ? isMuxedAccount(destinationAddress)
    : false;

  // Check if this is a Soroban transaction (custom token or collectible transfer)
  // Soroban transactions to M addresses don't support separate memo (memo is encoded in address)
  // Soroban transactions to G addresses support memo
  // Normal transactions (payments) support M address + memo
  const isSorobanTransaction =
    transactionDetails.transactionType === TransactionType.CONTRACT_TRANSFER ||
    transactionDetails.transactionType === TransactionType.CONTRACT;

  const detailItems = useMemo(
    () =>
      [
        {
          icon: <Icon.ClockCheck size={16} themeColor="gray" />,
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
                isSuccess
                  ? themeColors.status.success
                  : themeColors.status.error
              }
            >
              {isSuccess
                ? t("history.transactionDetails.statusSuccess")
                : t("history.transactionDetails.statusFailed")}
            </Text>
          ),
        },
        // Hide memo line only for Soroban transactions (custom tokens or collectibles) to M addresses
        // Soroban transactions to G addresses support memo
        // Normal transactions support M address + memo
        !(isDestinationMuxed && isSorobanTransaction)
          ? {
              icon: (
                <Icon.File02 size={16} color={themeColors.foreground.primary} />
              ),
              titleComponent: (
                <Text md secondary color={THEME.colors.text.secondary}>
                  {t("transactionAmountScreen.details.memo")}
                </Text>
              ),
              trailingContent: (
                <Text md medium secondary={!transactionDetails.memo}>
                  {transactionDetails.memo || t("common.none")}
                </Text>
              ),
            }
          : undefined,
        transactionDetails.transactionType === TransactionType.SWAP
          ? {
              icon: <Icon.Divide03 size={16} themeColor="gray" />,
              titleComponent: (
                <Text md secondary>
                  {t("history.transactionDetails.rate")}
                </Text>
              ),
              trailingContent: <Text>{swapRateText}</Text>,
            }
          : undefined,
        {
          icon: <Icon.Route size={16} themeColor="gray" />,
          titleComponent: (
            <Text md secondary>
              {t("history.transactionDetails.fee")}
            </Text>
          ),
          trailingContent: (
            <Text>{formatTokenForDisplay(fee, NATIVE_TOKEN_CODE)}</Text>
          ),
        },
        {
          icon: (
            <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
          ),
          titleComponent: (
            <Text md secondary color={THEME.colors.text.secondary}>
              {t("transactionAmountScreen.details.xdr")}
            </Text>
          ),
          trailingContent: (
            <View
              className="flex-row items-center gap-[8px]"
              onTouchEnd={handleCopyXdr}
            >
              <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
              <Text md medium>
                {transactionDetails.xdr
                  ? truncateAddress(transactionDetails.xdr, 10, 4)
                  : t("common.none")}
              </Text>
            </View>
          ),
        },
        // filter out undefined entries for non-swaps in order to keep detail order.
      ].filter(Boolean),
    [
      fee,
      isSuccess,
      swapRateText,
      t,
      themeColors.status.error,
      themeColors.status.success,
      transactionDetails.transactionType,
      handleCopyXdr,
      themeColors.foreground.primary,
      transactionDetails.memo,
      transactionDetails.xdr,
      isDestinationMuxed,
      isSorobanTransaction,
    ],
  ) as ListItemProps[];

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
        TransactionType.CONTRACT_TRANSFER &&
        transactionDetails.contractDetails?.transferDetails && (
          <SorobanTokenTransferTransactionDetailsContent
            transactionDetails={transactionDetails}
          />
        )}

      {transactionDetails.transactionType ===
        TransactionType.CONTRACT_TRANSFER &&
        transactionDetails.contractDetails?.collectibleTransferDetails && (
          <SorobanCollectibleTransferTransactionDetailsContent
            transactionDetails={transactionDetails}
          />
        )}

      <List variant="secondary" items={detailItems} />
      <Button
        isFullWidth
        tertiary
        icon={<Icon.LinkExternal01 size={16} color={themeColors.base[0]} />}
        onPress={() => {
          analytics.track(AnalyticsEvent.HISTORY_OPEN_FULL_HISTORY);

          openInAppBrowser(transactionDetails.externalUrl);
        }}
      >
        {t("history.transactionDetails.viewOnStellarExpert")}
      </Button>
    </View>
  );
};
