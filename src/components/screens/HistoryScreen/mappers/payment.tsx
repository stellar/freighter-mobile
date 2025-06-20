/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import BigNumber from "bignumber.js";
import { AssetIcon } from "components/AssetIcon";
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
import { AssetTypeWithCustomToken } from "config/types";
import { formatAssetAmount } from "helpers/formatAmount";
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
    asset_code: destAssetCode = NATIVE_TOKEN_CODE,
    asset_type: assetType = "native",
    asset_issuer: assetIssuer = "",
    to,
    from,
  } = operation;

  const isRecipient = to === publicKey && from !== publicKey;
  const paymentDifference = isRecipient ? "+" : "-";
  const formattedAmount = `${paymentDifference}${formatAssetAmount(
    new BigNumber(amount).toString(),
    destAssetCode,
  )}`;

  const IconComponent = (
    <AssetIcon
      token={{
        code: destAssetCode,
        type: assetType,
        issuer: {
          key: assetIssuer,
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

  const transactionTitle = `${isRecipient ? t("history.transactionHistory.received") : t("history.transactionHistory.sent")} ${destAssetCode}`;

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
      assetCode: destAssetCode,
      assetIssuer: assetIssuer || "",
      assetType,
      amount,
      from,
      to,
    },
  };

  return {
    transactionDetails,
    rowText: destAssetCode,
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
      <View className="flex-row justify-between">
        <View>
          <Text xl primary medium numberOfLines={1}>
            {formatAssetAmount(
              transactionDetails.paymentDetails?.amount ?? "",
              transactionDetails.paymentDetails?.assetCode ?? "",
            )}
          </Text>
        </View>
        <AssetIcon
          token={{
            code: transactionDetails.paymentDetails?.assetCode ?? "",
            issuer: {
              key: transactionDetails.paymentDetails?.assetIssuer ?? "",
            },
            type: transactionDetails.paymentDetails
              ?.assetType as AssetTypeWithCustomToken,
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
          publicAddress={transactionDetails.paymentDetails?.to ?? ""}
          hasBorder
          size={AvatarSizes.LARGE}
        />
      </View>
    </TransactionDetailsContent>
  );
};
