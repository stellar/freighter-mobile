import StellarLogo from "assets/logos/stellar-logo.svg";
import { AssetIcon } from "components/AssetIcon";
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
import { AssetToken, NativeToken } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { calculateSwapRate } from "helpers/balances";
import { formatTransactionDate } from "helpers/date";
import { formatAssetAmount, formatFiatAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect, useState, useMemo } from "react";
import { View, Linking } from "react-native";
import { getTransactionDetails, TransactionDetail } from "services/stellar";

type SwapTransactionDetailsBottomSheetProps = {
  sourceAmount: string;
  sourceToken: AssetToken | NativeToken;
  destinationAmount: string;
  destinationToken: AssetToken | NativeToken;
};

const SwapTransactionDetailsBottomSheet: React.FC<
  SwapTransactionDetailsBottomSheetProps
> = ({ sourceAmount, sourceToken, destinationAmount, destinationToken }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();
  const { network } = useAuthenticationStore();
  const { account } = useGetActiveAccount();

  const { pathResult } = useSwapStore();
  const { swapFee, swapSlippage } = useSwapSettingsStore();

  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    shouldPoll: false,
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

  const [transactionDetails, setTransactionDetails] =
    useState<TransactionDetail | null>(null);

  useEffect(() => {
    if (transactionHash) {
      getTransactionDetails(transactionHash, network)
        .then((details) => {
          if (details) {
            setTransactionDetails(details);
          }
        })
        .catch((error) => {
          logger.error(
            "SwapTransactionDetailsBottomSheet",
            "Failed to get transaction details",
            error,
          );
        });
    }
  }, [transactionHash, network]);

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

    Linking.openURL(explorerUrl).catch((err) =>
      logger.error("Error opening transaction explorer:", String(err)),
    );
  };

  const displayConversionRate = useMemo(() => {
    // First try to use pathResult conversion rate if available
    if (pathResult?.conversionRate) {
      return pathResult.conversionRate;
    }

    // Validate that we have valid amounts before calculating
    if (
      !sourceAmount ||
      !destinationAmount ||
      sourceAmount === "0" ||
      destinationAmount === "0" ||
      sourceAmount === "" ||
      destinationAmount === ""
    ) {
      return "0";
    }

    const calculatedRate = calculateSwapRate(sourceAmount, destinationAmount);

    // Additional validation for the calculated rate
    if (calculatedRate === "NaN" || !calculatedRate || calculatedRate === "") {
      return "0";
    }

    return calculatedRate;
  }, [pathResult?.conversionRate, sourceAmount, destinationAmount]);

  const displayMinimumReceived =
    pathResult?.destinationAmountMin ||
    calculateMinimumReceived({
      destinationAmount,
      allowedSlippage: swapSlippage.toString(),
      minimumReceived: undefined,
    });

  const sourceTokenFiatAmountValue = calculateTokenFiatAmount({
    token: sourceToken,
    amount: sourceAmount,
    balanceItems,
  });
  const sourceTokenFiatAmount =
    sourceTokenFiatAmountValue !== "--"
      ? formatFiatAmount(sourceTokenFiatAmountValue)
      : "--";

  const destinationTokenFiatAmountValue = calculateTokenFiatAmount({
    token: destinationToken,
    amount: destinationAmount,
    balanceItems,
  });
  const destinationTokenFiatAmount =
    destinationTokenFiatAmountValue !== "--"
      ? formatFiatAmount(destinationTokenFiatAmountValue)
      : "--";

  return (
    <View className="gap-[24px]">
      <View className="flex-row gap-[16px]">
        <AssetIcon token={sourceToken} size="lg" />
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
              {formatAssetAmount(sourceAmount, sourceToken.code)}
            </Text>
            <Text md medium secondary>
              {sourceTokenFiatAmount}
            </Text>
          </View>
          <AssetIcon token={sourceToken} size="lg" />
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
              {formatAssetAmount(destinationAmount, destinationToken.code)}
            </Text>
            <Text md medium secondary>
              {destinationTokenFiatAmount}
            </Text>
          </View>
          <AssetIcon token={destinationToken} size="lg" />
        </View>
      </View>

      <View className="rounded-[16px] p-[24px] gap-[12px] bg-background-primary border-gray-6 border">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.ClockCheck size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionDetailsBottomSheet.status")}
            </Text>
          </View>
          <Text md medium color={statusColor}>
            {statusText}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Divide03 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapScreen.review.rate")}
            </Text>
          </View>
          <Text md medium>
            {formatConversionRate({
              rate: displayConversionRate,
              sourceSymbol: sourceToken.code,
              destinationSymbol: destinationToken.code,
            })}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Shield01 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapScreen.review.minimum")}
            </Text>
          </View>
          <Text md medium>
            {formatAssetAmount(displayMinimumReceived, destinationToken.code)}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Route size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapScreen.review.fee")}
            </Text>
          </View>
          <View className="flex-row items-center gap-[4px]">
            <StellarLogo width={16} height={16} />
            <Text md medium>
              {formatAssetAmount(swapFee, NATIVE_TOKEN_CODE)}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapScreen.review.xdr")}
            </Text>
          </View>
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
        </View>
      </View>

      {transactionHash && (
        <Button
          tertiary
          lg
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
