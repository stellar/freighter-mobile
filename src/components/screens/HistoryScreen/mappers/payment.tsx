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
} from "components/screens/HistoryScreen/types";
import { Avatar, AvatarSizes } from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { formatTokenDisplayAmount } from "helpers/formatAmount";
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
  themeColors: ThemeColors;
}

/**
 * Maps payment operation data to history item data
 */
export const mapPaymentHistoryItem = ({
  operation,
  publicKey,
  stellarExpertUrl,
  date,
  fee,
  themeColors,
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

  const isRecipient = to === publicKey && from !== publicKey;
  const paymentDifference = isRecipient ? "+" : "-";
  const formattedAmount = `${paymentDifference}${formatTokenDisplayAmount(
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
    IconComponent,
    ActionIconComponent,
    externalUrl: `${stellarExpertUrl}/op/${id}`,
    paymentDetails: {
      tokenCode: destTokenCode,
      tokenIssuer: tokenIssuer || "",
      tokenType,
      amount,
      from,
      to,
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
      <View className="flex-row justify-between items-center">
        <View>
          <Text xl primary medium numberOfLines={1}>
            {formatTokenDisplayAmount(
              transactionDetails.paymentDetails?.amount ?? "",
              transactionDetails.paymentDetails?.tokenCode ?? "",
            )}
          </Text>
        </View>
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
      </View>

      <Icon.ChevronDownDouble
        size={20}
        color={themeColors.foreground.primary}
        circle
        circleBackground={themeColors.background.tertiary}
      />

      <View className="flex-row justify-between items-center">
        <Text xl primary medium numberOfLines={1}>
          {truncateAddress(transactionDetails.paymentDetails?.to ?? "")}
        </Text>
        <Avatar
          hasDarkBackground
          publicAddress={transactionDetails.paymentDetails?.to ?? ""}
          size={AvatarSizes.LARGE}
        />
      </View>
    </TransactionDetailsContent>
  );
};
