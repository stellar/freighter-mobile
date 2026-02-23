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
  AssetDiffSummary,
} from "components/screens/HistoryScreen/types";
import { Avatar, AvatarSizes } from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { DEFAULT_PADDING, NATIVE_TOKEN_CODE } from "config/constants";
import { THEME } from "config/theme";
import { calculateSwapRate } from "helpers/balances";
import { formatDate } from "helpers/date";
import { pxValue } from "helpers/dimensions";
import { formatTokenForDisplay, stroopToXlm } from "helpers/formatAmount";
import { truncateAddress, isMuxedAccount } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors, { ThemeColors } from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useCallback, useMemo } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { analytics } from "services/analytics";

interface TransactionDetailsBottomSheetCustomContentProps {
  transactionDetails: TransactionDetails;
}

/**
 * Component for rendering individual asset diff rows
 */
const AssetDiffRow: React.FC<{
  diff: AssetDiffSummary;
  themeColors: ThemeColors;
  isLast: boolean;
}> = ({ diff, themeColors, isLast }) => {
  const { t } = useAppTranslation();
  const prefix = diff.isCredit ? "+" : "-";
  const formattedAmount = `${prefix}${formatTokenForDisplay(diff.amount, diff.assetCode)}`;

  return (
    <View
      className={`flex-row items-center justify-between ${
        !isLast ? "mb-3 pb-3 border-b border-border-primary" : ""
      }`}
    >
      <View className="flex-row items-center gap-2">
        {diff.isCredit ? (
          <Icon.ArrowCircleDown size={20} color={themeColors.status.success} />
        ) : (
          <Icon.ArrowCircleUp size={20} color={themeColors.status.error} />
        )}
        <Text md color={themeColors.white}>
          {diff.isCredit
            ? t("history.transactionHistory.received")
            : t("history.transactionHistory.sent")}
        </Text>
      </View>
      <Text
        md
        medium
        color={
          diff.isCredit ? themeColors.status.success : themeColors.status.error
        }
      >
        {formattedAmount}
      </Text>
    </View>
  );
};

/**
 * Renders the transaction details in the bottom sheet
 */
export const TransactionDetailsBottomSheetCustomContent: React.FC<
  TransactionDetailsBottomSheetCustomContentProps
> = ({ transactionDetails }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
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

  // Extract asset diffs and determine counterparty display logic
  const assetDiffs = transactionDetails.assetDiffs || [];
  const credits = assetDiffs.filter((d) => d.isCredit);
  const debits = assetDiffs.filter((d) => !d.isCredit);
  const shouldShowCounterparty =
    (credits.length === 1 && debits.length === 0) ||
    (debits.length === 1 && credits.length === 0);
  let counterpartyAddress: string | undefined;

  if (shouldShowCounterparty) {
    counterpartyAddress =
      credits.length === 1 ? credits[0].destination : debits[0].destination;
  }
  const isReceiving = credits.length === 1;

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
            <Text md secondary color={themeColors.white}>
              {isSuccess
                ? t("history.transactionDetails.statusSuccess")
                : t("history.transactionDetails.statusFailed")}
            </Text>
          ),
        },
        // Hide memo line for M addresses (memo is encoded in the address)
        !isDestinationMuxed
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
      transactionDetails.transactionType,
      handleCopyXdr,
      themeColors.foreground.primary,
      transactionDetails.memo,
      transactionDetails.xdr,
      isDestinationMuxed,
      themeColors.white,
    ],
  ) as ListItemProps[];

  return (
    <View className="gap-6">
      <View className="flex-row items-center">
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

      {assetDiffs.length > 0 ? (
        <View className="bg-background-tertiary rounded-[16px] p-4">
          {assetDiffs.map((diff, index) => (
            <AssetDiffRow
              key={`${diff.isCredit ? "credit" : "debit"}:${diff.assetCode}:${diff.assetIssuer ?? "native"}:${diff.amount}`}
              diff={diff}
              themeColors={themeColors}
              isLast={index === assetDiffs.length - 1}
            />
          ))}

          {shouldShowCounterparty && counterpartyAddress && (
            <View className="flex-row items-center justify-between pt-3 mt-3 border-t border-border-primary">
              <View className="flex-row items-center gap-2">
                <Icon.User01 size={20} color={themeColors.gray[9]} />
                <Text md color={themeColors.white}>
                  {isReceiving
                    ? t("history.transactionDetails.from")
                    : t("history.transactionDetails.to")}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Avatar
                  hasDarkBackground
                  publicAddress={counterpartyAddress}
                  size={AvatarSizes.SMALL}
                />
                <Text md primary medium>
                  {truncateAddress(counterpartyAddress)}
                </Text>
              </View>
            </View>
          )}
        </View>
      ) : (
        <>
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
        </>
      )}

      <List variant="secondary" items={detailItems} />
    </View>
  );
};

interface TransactionDetailsFooterProps {
  externalUrl: string;
}

export const TransactionDetailsFooter: React.FC<
  TransactionDetailsFooterProps
> = ({ externalUrl }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { open: openInAppBrowser } = useInAppBrowser();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-background-primary w-full px-6 py-6 mt-6"
      style={{
        paddingBottom: insets.bottom + pxValue(DEFAULT_PADDING),
      }}
    >
      <Button
        isFullWidth
        tertiary
        icon={<Icon.LinkExternal01 size={16} color={themeColors.base[0]} />}
        onPress={() => {
          analytics.track(AnalyticsEvent.HISTORY_OPEN_FULL_HISTORY);
          openInAppBrowser(externalUrl);
        }}
      >
        {t("history.transactionDetails.viewOnStellarExpert")}
      </Button>
    </View>
  );
};
