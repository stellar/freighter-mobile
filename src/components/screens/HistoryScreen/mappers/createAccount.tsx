/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import TransactionDetailsContent from "components/screens/HistoryScreen/TransactionDetailsContent";
import {
  TransactionDetails,
  TransactionType,
  TransactionStatus,
  HistoryItemData,
} from "components/screens/HistoryScreen/types";
import Avatar, { AvatarSizes } from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { formatAssetAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import { ThemeColors } from "hooks/useColors";
import { t } from "i18next";
import React from "react";
import { View } from "react-native";

interface CreateAccountHistoryItemData {
  operation: any;
  stellarExpertUrl: string;
  date: string;
  fee: string;
  themeColors: ThemeColors;
  isCreateExternalAccount: boolean;
}

/**
 * Maps create account operation data to history item data
 */
export const mapCreateAccountHistoryItem = ({
  operation,
  stellarExpertUrl,
  date,
  fee,
  themeColors,
  isCreateExternalAccount,
}: CreateAccountHistoryItemData): HistoryItemData => {
  const { account, starting_balance: startingBalance } = operation;
  const isRecipient = !isCreateExternalAccount;
  const paymentDifference = isRecipient ? "+" : "-";
  const formattedAmount = `${paymentDifference}${formatAssetAmount(
    startingBalance,
    NATIVE_TOKEN_CODE,
  )}`;

  const ActionIconComponent = isRecipient ? (
    <Icon.PlusCircle size={16} color={themeColors.foreground.primary} />
  ) : (
    <Icon.ArrowCircleUp size={16} color={themeColors.foreground.primary} />
  );

  const transactionDetails: TransactionDetails = {
    operation,
    transactionTitle: t("history.transactionHistory.createAccount"),
    transactionType: TransactionType.CREATE_ACCOUNT,
    fee,
    status: TransactionStatus.SUCCESS,
    IconComponent: null,
    ActionIconComponent,
    externalUrl: `${stellarExpertUrl}/op/${operation.id}`,
    createAccountDetails: {
      isCreatingExternalAccount: isCreateExternalAccount,
      accountPublicKey: account,
      startingBalance,
    },
  };

  return {
    transactionDetails,
    rowText: t("history.transactionHistory.createAccount"),
    dateText: date,
    amountText: formattedAmount,
    actionText: isRecipient
      ? t("history.transactionHistory.received")
      : t("history.transactionHistory.sent"),
    ActionIconComponent,
    IconComponent: null,
    transactionStatus: TransactionStatus.SUCCESS,
    isAddingFunds: isRecipient,
  };
};

/**
 * Renders create account transaction details
 */
export const CreateAccountTransactionDetailsContent: React.FC<{
  transactionDetails: TransactionDetails;
}> = ({ transactionDetails }) => (
  <TransactionDetailsContent className="justify-center">
    <View className="flex-row justify-between items-center">
      <View>
        <Text xl primary medium numberOfLines={1}>
          {truncateAddress(
            transactionDetails.createAccountDetails?.accountPublicKey ?? "",
          )}
        </Text>
        <Text sm secondary numberOfLines={1}>
          {t("history.transactionDetails.startingBalance")}{" "}
          {formatAssetAmount(
            transactionDetails.createAccountDetails?.startingBalance ?? "",
            NATIVE_TOKEN_CODE,
          )}
        </Text>
      </View>
      <Avatar
        publicAddress={
          transactionDetails.createAccountDetails?.accountPublicKey ?? ""
        }
        hasBorder
        size={AvatarSizes.LARGE}
      />
    </View>
  </TransactionDetailsContent>
);
