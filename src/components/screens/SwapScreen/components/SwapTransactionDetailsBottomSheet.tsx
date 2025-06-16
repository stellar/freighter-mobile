import React, { useEffect, useState } from "react";
import { View, Linking } from "react-native";

import StellarLogo from "assets/logos/stellar-logo.svg";
import { BigNumber } from "bignumber.js";
import { AssetIcon } from "components/AssetIcon";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { logger } from "config/logger";
import { AssetToken, NativeToken } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { formatAssetAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import { getTransactionDetails, TransactionDetail } from "services/stellar";

/**
 * SwapTransactionDetailsBottomSheet props
 */
type SwapTransactionDetailsBottomSheetProps = {
  fromAmount: string;
  fromToken: AssetToken | NativeToken;
  toAmount: string;
  toToken: AssetToken | NativeToken;
  conversionRate?: string;
  minimumReceived?: string;
  allowedSlippage?: string;
};

/**
 * SwapTransactionDetailsBottomSheet Component
 *
 * A bottom sheet displaying swap transaction details, including amounts,
 * conversion rate, slippage, fee, and other swap metadata.
 *
 * Uses the same visual layout as the history screen's SwapTransactionDetailsContent
 * but with comprehensive transaction details.
 */
const SwapTransactionDetailsBottomSheet: React.FC<
  SwapTransactionDetailsBottomSheetProps
> = ({
  fromAmount,
  fromToken,
  toAmount,
  toToken,
  conversionRate,
  minimumReceived,
  allowedSlippage = "1",
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();
  const { network } = useAuthenticationStore();

  const { transactionMemo, transactionFee } = useTransactionSettingsStore();

  const {
    transactionXDR,
    transactionHash,
    error: transactionError,
    isSubmitting,
  } = useTransactionBuilderStore();

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

  const formatTransactionDate = () => {
    let dateObj: Date;

    if (transactionDetails?.createdAt) {
      dateObj = new Date(transactionDetails.createdAt);
    } else {
      dateObj = new Date();
    }

    const formattedDate = dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const formattedTime = dateObj
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase();

    return `${formattedDate} · ${formattedTime}`;
  };

  const dateTimeDisplay = formatTransactionDate();

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

  // Calculate conversion rate if not provided
  const calculateConversionRate = () => {
    if (conversionRate) return conversionRate;
    
    const fromAmountBN = new BigNumber(fromAmount);
    const toAmountBN = new BigNumber(toAmount);
    
    if (fromAmountBN.isZero()) return "0";
    
    const rate = toAmountBN.dividedBy(fromAmountBN);
    return rate.toFixed(2);
  };

  // Calculate minimum received if not provided
  const calculateMinimumReceived = () => {
    if (minimumReceived) return minimumReceived;
    
    const toAmountBN = new BigNumber(toAmount);
    const slippageMultiplier = new BigNumber(1).minus(
      new BigNumber(allowedSlippage).dividedBy(100)
    );
    
    return toAmountBN.multipliedBy(slippageMultiplier).toFixed(7);
  };

  return (
    <View className="gap-[24px]">
      {/* Header Section */}
      <View className="flex-row gap-[16px]">
        <AssetIcon token={fromToken} size="lg" />
        <View>
          <Text md medium primary>
            {t("swapTransactionDetails.swapped", {
              defaultValue: "Swapped",
            })}
          </Text>
          <View className="flex-row items-center gap-[4px]">
            <Icon.ArrowCircleUp size={16} color={themeColors.text.secondary} />
            <Text sm medium secondary>
              {dateTimeDisplay}
            </Text>
          </View>
        </View>
      </View>

      {/* Swap Summary - Following History Screen Pattern */}
      <View className="bg-background-secondary rounded-[16px] p-[24px] gap-[12px]">
        {/* From Asset */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text xl medium primary>
              {formatAssetAmount(fromAmount, fromToken.code)}
            </Text>
            <Text md medium secondary>
              --
            </Text>
          </View>
          <AssetIcon token={fromToken} size="lg" />
        </View>

        {/* Swap Direction - Using downward chevron like history screen */}
        <View className="items-center">
          <Icon.ChevronDownDouble
            size={20}
            color={themeColors.foreground.primary}
            circle
            circleBackground={themeColors.background.tertiary}
          />
        </View>

        {/* To Asset */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text xl medium primary>
              {formatAssetAmount(toAmount, toToken.code)}
            </Text>
            <Text md medium secondary>
              --
            </Text>
          </View>
          <AssetIcon token={toToken} size="lg" />
        </View>
      </View>

      {/* Transaction Details */}
      <View className="rounded-[16px] p-[24px] gap-[12px] bg-background-primary border-gray-6 border">
        {/* Status */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.ClockCheck size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionDetailsBottomSheet.status")}
            </Text>
          </View>
          <Text md medium color={transactionStatus.color}>
            {transactionStatus.text}
          </Text>
        </View>

        {/* Conversion Rate */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Divide03 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapTransactionDetails.conversionRate", {
                defaultValue: "Conversion rate",
              })}
            </Text>
          </View>
          <Text md medium secondary>
            1 {fromToken.code} ≈ {formatAssetAmount(calculateConversionRate(), toToken.code)}
          </Text>
        </View>

        {/* Minimum Received */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Shield01 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("swapTransactionDetails.minimumReceived", {
                defaultValue: "Minimum received",
              })}
            </Text>
          </View>
          <Text md medium secondary>
            {formatAssetAmount(calculateMinimumReceived(), toToken.code)}
          </Text>
        </View>

        {/* Memo (if exists) */}
        {transactionMemo && (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-[8px]">
              <Icon.File02 size={16} color={themeColors.foreground.primary} />
              <Text md medium secondary>
                {t("transactionAmountScreen.details.memo")}
              </Text>
            </View>
            <Text md medium secondary>
              {transactionMemo}
            </Text>
          </View>
        )}

        {/* Transaction Fee */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Route size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionAmountScreen.details.fee")}
            </Text>
          </View>
          <View className="flex-row items-center gap-[4px]">
            <StellarLogo width={16} height={16} />
            <Text md medium>
              {formatAssetAmount(transactionFee, NATIVE_TOKEN_CODE)}
            </Text>
          </View>
        </View>

        {/* XDR */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionAmountScreen.details.xdr")}
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

      {/* View on Explorer Button */}
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