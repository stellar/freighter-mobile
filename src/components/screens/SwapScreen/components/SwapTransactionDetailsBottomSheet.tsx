import StellarLogo from "assets/logos/stellar-logo.svg";
import { List } from "components/List";
import { TokenIcon } from "components/TokenIcon";
import {
  calculateMinimumReceived,
  formatConversionRate,
  calculateTokenFiatAmount,
} from "components/screens/SwapScreen/helpers";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { logger } from "config/logger";
import { THEME } from "config/theme";
import { NonNativeToken, NativeToken } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { calculateSwapRate } from "helpers/balances";
import { formatTransactionDate } from "helpers/date";
import {
  formatTokenDisplayAmount,
  formatFiatAmount,
} from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useMemo } from "react";
import { View } from "react-native";
import { TransactionDetail } from "services/stellar";

type SwapTransactionDetailsBottomSheetProps = {
  sourceAmount: string;
  sourceToken: NonNativeToken | NativeToken;
  destinationAmount: string;
  destinationToken: NonNativeToken | NativeToken;
  transactionDetails?: TransactionDetail | null;
};

const SwapTransactionDetailsBottomSheet: React.FC<
  SwapTransactionDetailsBottomSheetProps
> = ({
  sourceAmount,
  sourceToken,
  destinationAmount,
  destinationToken,
  transactionDetails,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();
  const { network } = useAuthenticationStore();
  const { account } = useGetActiveAccount();
  const { open: openInAppBrowser } = useInAppBrowser();

  const { swapFee, swapSlippage } = useSwapSettingsStore();

  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
  });
  const {
    transactionXDR,
    transactionHash,
    error: transactionError,
    isSubmitting,
  } = useTransactionBuilderStore();

  const getTransactionStatus = () => {
    if (transactionHash) {
      return {
        text: t("transactionDetailsBottomSheet.statusSuccess"),
        color: themeColors.status.success,
      };
    }
    if (transactionError) {
      return {
        text: t("transactionDetailsBottomSheet.statusFailed"),
        color: themeColors.status.error,
      };
    }
    if (isSubmitting) {
      return {
        text: t("transactionDetailsBottomSheet.statusPending"),
        color: themeColors.status.warning,
      };
    }
    return {
      text: t("transactionDetailsBottomSheet.statusSuccess"),
      color: themeColors.status.success,
    };
  };

  const transactionStatus = getTransactionStatus();
  const { text: statusText, color: statusColor } = transactionStatus;

  const dateTimeDisplay = formatTransactionDate(transactionDetails?.createdAt);

  const handleCopyXdr = () => {
    if (transactionXDR) {
      copyToClipboard(transactionXDR, {
        notificationMessage: t("common.copied"),
      });
    }
  };

  const handleViewOnExplorer = () => {
    if (!transactionHash) return;

    const explorerUrl = `${getStellarExpertUrl(network)}/tx/${transactionHash}`;

    openInAppBrowser(explorerUrl).catch((err) =>
      logger.error(
        "[Linking - openURL]",
        "Error opening transaction explorer:",
        err,
      ),
    );
  };

  // Use actual transaction amounts when available, fallback to props
  const actualSourceAmount =
    transactionDetails?.swapDetails?.sourceAmount || sourceAmount;
  const actualDestinationAmount =
    transactionDetails?.swapDetails?.destinationAmount || destinationAmount;

  const displayConversionRate = useMemo(
    () => calculateSwapRate(actualSourceAmount, actualDestinationAmount),
    [actualSourceAmount, actualDestinationAmount],
  );

  const displayMinimumReceived = calculateMinimumReceived({
    destinationAmount: actualDestinationAmount,
    allowedSlippage: swapSlippage.toString(),
    minimumReceived: undefined,
  });

  const sourceTokenFiatAmountValue = calculateTokenFiatAmount({
    token: sourceToken,
    amount: actualSourceAmount,
    balanceItems,
  });
  const sourceTokenFiatAmount =
    sourceTokenFiatAmountValue !== "--"
      ? formatFiatAmount(sourceTokenFiatAmountValue)
      : "--";

  const destinationTokenFiatAmountValue = calculateTokenFiatAmount({
    token: destinationToken,
    amount: actualDestinationAmount,
    balanceItems,
  });
  const destinationTokenFiatAmount =
    destinationTokenFiatAmountValue !== "--"
      ? formatFiatAmount(destinationTokenFiatAmountValue)
      : "--";

  return (
    <View className="gap-[24px]">
      <View className="flex-row gap-[16px]">
        <TokenIcon token={sourceToken} size="lg" />
        <View>
          <Text md medium primary>
            {t("swapTransactionDetails.swapped")}
          </Text>
          <View className="flex-row items-center gap-[4px]">
            <Icon.ArrowCircleUp size={16} color={themeColors.text.secondary} />
            <Text sm medium secondary>
              {dateTimeDisplay}
            </Text>
          </View>
        </View>
      </View>

      <View className="bg-background-secondary rounded-[16px] p-[24px] gap-[12px]">
        <View className="flex-row items-center justify-between">
          <View>
            <Text xl medium primary>
              {formatTokenDisplayAmount(actualSourceAmount, sourceToken.code)}
            </Text>
            <Text md medium secondary>
              {sourceTokenFiatAmount}
            </Text>
          </View>
          <TokenIcon token={sourceToken} size="lg" />
        </View>

        <View>
          <Icon.ChevronDownDouble
            size={20}
            color={themeColors.foreground.primary}
            circle
            circleBackground={themeColors.background.tertiary}
          />
        </View>

        <View className="flex-row items-center justify-between">
          <View>
            <Text xl medium primary>
              {formatTokenDisplayAmount(
                actualDestinationAmount,
                destinationToken.code,
              )}
            </Text>
            <Text md medium secondary>
              {destinationTokenFiatAmount}
            </Text>
          </View>
          <TokenIcon token={destinationToken} size="lg" />
        </View>
      </View>

      <List
        variant="secondary"
        items={[
          {
            icon: (
              <Icon.ClockCheck
                size={16}
                color={themeColors.foreground.primary}
              />
            ),
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("transactionDetailsBottomSheet.status")}
              </Text>
            ),
            trailingContent: (
              <Text md medium color={statusColor}>
                {statusText}
              </Text>
            ),
          },
          {
            icon: (
              <Icon.Divide03 size={16} color={themeColors.foreground.primary} />
            ),
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("swapScreen.review.rate")}
              </Text>
            ),
            trailingContent: (
              <Text md medium>
                {formatConversionRate({
                  rate: displayConversionRate,
                  sourceSymbol: sourceToken.code,
                  destinationSymbol: destinationToken.code,
                })}
              </Text>
            ),
          },
          {
            icon: (
              <Icon.Shield01 size={16} color={themeColors.foreground.primary} />
            ),
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("swapScreen.review.minimum")}
              </Text>
            ),
            trailingContent: (
              <Text md medium>
                {formatTokenDisplayAmount(
                  displayMinimumReceived,
                  destinationToken.code,
                )}
              </Text>
            ),
          },
          {
            icon: (
              <Icon.Route size={16} color={themeColors.foreground.primary} />
            ),
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("swapScreen.review.fee")}
              </Text>
            ),
            trailingContent: (
              <View className="flex-row items-center gap-[4px]">
                <StellarLogo width={16} height={16} />
                <Text md medium>
                  {formatTokenDisplayAmount(swapFee, NATIVE_TOKEN_CODE)}
                </Text>
              </View>
            ),
          },
          {
            icon: (
              <Icon.FileCode02
                size={16}
                color={themeColors.foreground.primary}
              />
            ),
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("swapScreen.review.xdr")}
              </Text>
            ),
            trailingContent: (
              <View
                className="flex-row items-center gap-[8px]"
                onTouchEnd={handleCopyXdr}
              >
                <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
                <Text md medium>
                  {transactionXDR
                    ? truncateAddress(transactionXDR, 10, 4)
                    : t("common.none")}
                </Text>
              </View>
            ),
          },
        ]}
      />

      {transactionHash && (
        <Button
          tertiary
          onPress={handleViewOnExplorer}
          icon={
            <Icon.LinkExternal01
              size={16}
              color={themeColors.foreground.primary}
            />
          }
          iconPosition={IconPosition.RIGHT}
        >
          {t("transactionDetailsBottomSheet.viewOnExpert")}
        </Button>
      )}
    </View>
  );
};

export default SwapTransactionDetailsBottomSheet;
