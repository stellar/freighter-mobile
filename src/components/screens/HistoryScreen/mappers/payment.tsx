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
import { formatTokenForDisplay } from "helpers/formatAmount";
import { truncateAddress, isMuxedAccount } from "helpers/stellar";
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
}

/**
 * Extracts the actual destination address from transaction XDR
 * This is needed because Horizon API returns base G address for M addresses
 */
const extractDestinationFromXDR = (
  xdr: string,
  network: string | undefined,
  fallbackTo: string,
): string => {
  if (!xdr || !network) {
    return fallbackTo;
  }

  try {
    const networkDetails = mapNetworkToNetworkDetails(network as any);
    const transaction = TransactionBuilder.fromXDR(
      xdr,
      networkDetails.networkPassphrase,
    );

    // Find payment operation and extract destination
    const paymentOp = transaction.operations.find(
      (op) => op.type === "payment" && "destination" in op,
    );

    if (paymentOp && "destination" in paymentOp) {
      const { destination } = paymentOp;
      // Return the destination from XDR (could be M address)
      return destination;
    }
  } catch (error) {
    logger.error(
      "mapPaymentHistoryItem",
      "Failed to parse XDR for destination address",
      error,
    );
  }

  return fallbackTo;
};

/**
 * Maps payment operation data to history item data
 */
export const mapPaymentHistoryItem = ({
  operation,
  publicKey,
  stellarExpertUrl,
  date,
  fee,
  memo,
  themeColors,
  xdr,
  network,
}: PaymentHistoryItemData): HistoryItemData => {
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
  const actualDestination = extractDestinationFromXDR(xdr, network, to);

  // If destination is an M address, clear memo (memo is encoded in the address)
  const isDestinationMuxed = isMuxedAccount(actualDestination);
  const finalMemo = isDestinationMuxed ? "" : memo;

  const isRecipient = actualDestination === publicKey && from !== publicKey;
  const paymentDifference = isRecipient ? "+" : "-";
  const formattedAmount = `${paymentDifference}${formatTokenForDisplay(
    new BigNumber(amount).toString(),
    destTokenCode,
  )}`;

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
  };

  return {
    transactionDetails,
    rowText: destTokenCode,
    actionText: isRecipient
      ? t("history.transactionHistory.received")
      : t("history.transactionHistory.sent"),
    dateText: date,
    amountText: formattedAmount,
    IconComponent,
    isAddingFunds: isRecipient,
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
