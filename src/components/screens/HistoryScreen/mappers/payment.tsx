/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { TransactionBuilder } from "@stellar/stellar-sdk";
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
import { logger } from "config/logger";
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
 * Extracts the actual destination address from transaction XDR for a specific operation
 * This is needed because Horizon API returns base G address for M addresses
 *
 * @param xdr Transaction envelope XDR
 * @param network Network identifier
 * @param fallbackTo Fallback destination if extraction fails
 * @param operationId Horizon operation ID (format: "txid-index")
 * @returns Actual destination address (may be M address)
 */
const extractDestinationFromXDR = (
  xdr: string,
  network: string | undefined,
  fallbackTo: string,
  operationId: string,
): string => {
  if (!xdr || !network) {
    return fallbackTo;
  }

  try {
    // Extract operation index from Horizon operation ID
    // Format: "123456789012345-1" where 1 is the index
    const operationIndex = parseInt(operationId.split("-").pop() || "0", 10);

    const networkDetails = mapNetworkToNetworkDetails(network as any);
    const transaction = TransactionBuilder.fromXDR(
      xdr,
      networkDetails.networkPassphrase,
    );

    // Get the specific operation at this index
    if (operationIndex >= transaction.operations.length) {
      logger.warn(
        "extractDestinationFromXDR",
        `Operation index ${operationIndex} out of range (${transaction.operations.length} operations)`,
      );
      return fallbackTo;
    }

    const targetOp = transaction.operations[operationIndex];

    // Check if it's a payment operation with a destination
    if (
      targetOp &&
      (targetOp.type === "payment" ||
        targetOp.type === "pathPaymentStrictReceive" ||
        targetOp.type === "pathPaymentStrictSend") &&
      "destination" in targetOp
    ) {
      const { destination } = targetOp;
      // Return the destination from XDR (could be M address)
      return destination;
    }
  } catch (error) {
    logger.error(
      "extractDestinationFromXDR",
      "Failed to parse XDR for destination address",
      error,
    );
  }

  return fallbackTo;
};

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
    from,
  } = operation;

  // Extract actual destination from XDR (may be M address)
  // Horizon API returns base G address, but XDR contains the actual address used
  const actualDestination = extractDestinationFromXDR(xdr, network, to, id);

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
