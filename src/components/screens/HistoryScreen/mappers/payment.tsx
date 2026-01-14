/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import BigNumber from "bignumber.js";
import { TokenIcon } from "components/TokenIcon";
import TransactionDetailsContent from "components/screens/HistoryScreen/TransactionDetailsContent";
import {
  TransactionDetails,
  TransactionType,
  TransactionStatus,
  HistoryItemData,
  AssetDiffSummary,
} from "components/screens/HistoryScreen/types";
import { Avatar, AvatarSizes } from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  NATIVE_TOKEN_CODE,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { normalizePaymentToAssetDiffs } from "helpers/assetBalanceChanges";
import { formatTokenForDisplay } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import useColors, { ThemeColors } from "hooks/useColors";
import { t } from "i18next";
import React from "react";
import { View } from "react-native";

interface PaymentHistoryItemData {
  operation: any;
  publicKey: string;
  stellarExpertUrl: string;
  date: string;
  fee: string;
  memo?: string;
  themeColors: ThemeColors;
  xdr: string;
  network?: string;
  assetDiffs?: AssetDiffSummary[];
}

/**
 * Maps payment operation data to history item data
 */
export const mapPaymentHistoryItem = async ({
  operation,
  publicKey,
  stellarExpertUrl,
  date,
  fee,
  memo,
  themeColors,
  xdr,
  network,
  assetDiffs = [],
}: PaymentHistoryItemData): Promise<HistoryItemData> => {
  const {
    id,
    amount,
    asset_code: destTokenCode = NATIVE_TOKEN_CODE,
    asset_type: tokenType = "native",
    asset_issuer: tokenIssuer = "",
    to,
    to_muxed: toMuxed,
    from,
  } = operation;

  const actualDestination = toMuxed || to;

  // Payment mapper handles classic/native tokens only (Soroban payments go to soroban mapper)
  // Classic tokens support M address + memo, so preserve memo even for M addresses
  const finalMemo = memo;

  const isRecipient = actualDestination === publicKey;
  const paymentDifference = isRecipient ? "+" : "-";
  const formattedAmount = `${paymentDifference}${formatTokenForDisplay(
    new BigNumber(amount).toString(),
    destTokenCode,
  )}`;

  // Normalize payment to asset diffs if not already present
  let finalAssetDiffs = assetDiffs;
  if (finalAssetDiffs.length === 0 && network) {
    finalAssetDiffs = await normalizePaymentToAssetDiffs({
      amount,
      assetCode: destTokenCode,
      assetIssuer: tokenIssuer || null,
      isCredit: isRecipient,
      destination: isRecipient ? from : actualDestination,
      networkDetails: mapNetworkToNetworkDetails(network as any),
    });
  }

  // Use asset diffs for amount display if present
  let amountText: string | null = formattedAmount;
  let displayIsAddingFunds: boolean | null = isRecipient;

  if (finalAssetDiffs && finalAssetDiffs.length === 1) {
    const diff = finalAssetDiffs[0];
    const prefix = diff.isCredit ? "+" : "-";
    amountText = `${prefix}${formatTokenForDisplay(diff.amount, diff.assetCode)}`;
    displayIsAddingFunds = diff.isCredit;
  } else if (finalAssetDiffs && finalAssetDiffs.length > 1) {
    amountText = t("history.transactionHistory.multiple");
    displayIsAddingFunds = null; // Remove color styling for "Multiple"
  }

  const IconComponent = (
    <TokenIcon
      token={{
        code: destTokenCode,
        type: tokenType,
        issuer: {
          key: tokenIssuer,
        },
      }}
      size="lg"
    />
  );

  const ActionIconComponent = isRecipient ? (
    <Icon.ArrowCircleDown size={16} color={themeColors.foreground.primary} />
  ) : (
    <Icon.ArrowCircleUp size={16} color={themeColors.foreground.primary} />
  );

  const transactionTitle = `${isRecipient ? t("history.transactionHistory.received") : t("history.transactionHistory.sent")} ${destTokenCode}`;

  const transactionDetails: TransactionDetails = {
    operation,
    transactionTitle,
    transactionType: TransactionType.PAYMENT,
    status: TransactionStatus.SUCCESS,
    fee,
    memo: finalMemo,
    xdr,
    IconComponent,
    ActionIconComponent,
    externalUrl: `${stellarExpertUrl}/op/${id}`,
    paymentDetails: {
      tokenCode: destTokenCode,
      tokenIssuer: tokenIssuer || "",
      tokenType,
      amount,
      from,
      to: actualDestination, // Use actual destination from XDR (may be M address)
    },
    assetDiffs: finalAssetDiffs,
  };

  return {
    transactionDetails,
    rowText: destTokenCode,
    actionText: isRecipient
      ? t("history.transactionHistory.received")
      : t("history.transactionHistory.sent"),
    dateText: date,
    amountText,
    IconComponent,
    isAddingFunds: displayIsAddingFunds,
    ActionIconComponent,
    transactionStatus: TransactionStatus.SUCCESS,
  };
};

/**
 * Renders payment transaction details
 */
export const PaymentTransactionDetailsContent: React.FC<{
  transactionDetails: TransactionDetails;
}> = ({ transactionDetails }) => {
  const { themeColors } = useColors();

  return (
    <TransactionDetailsContent>
      <View className="flex-row items-center">
        <TokenIcon
          token={{
            code: transactionDetails.paymentDetails?.tokenCode ?? "",
            issuer: {
              key: transactionDetails.paymentDetails?.tokenIssuer ?? "",
            },
            type: transactionDetails.paymentDetails
              ?.tokenType as TokenTypeWithCustomToken,
          }}
        />
        <View className="ml-[16px]">
          <Text xl primary medium numberOfLines={1}>
            {formatTokenForDisplay(
              transactionDetails.paymentDetails?.amount ?? "",
              transactionDetails.paymentDetails?.tokenCode ?? "",
            )}
          </Text>
        </View>
      </View>

      <View className="w-[40px] flex items-center py-1">
        <Icon.ChevronDownDouble
          size={20}
          color={themeColors.foreground.primary}
        />
      </View>

      <View className="flex-row items-center">
        <Avatar
          hasDarkBackground
          publicAddress={transactionDetails.paymentDetails?.to ?? ""}
          size={AvatarSizes.LARGE}
        />
        <View className="ml-[16px]">
          <Text xl primary medium numberOfLines={1}>
            {truncateAddress(transactionDetails.paymentDetails?.to ?? "")}
          </Text>
        </View>
      </View>
    </TransactionDetailsContent>
  );
};
