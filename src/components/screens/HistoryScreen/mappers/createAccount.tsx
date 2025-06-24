/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { AssetIcon } from "components/AssetIcon";
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
import { AssetTypeWithCustomToken } from "config/types";
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
  const { account, starting_balance: startingBalance, funder } = operation;
  const isRecipient = !isCreateExternalAccount;

  // SENDER's view: Treat as a regular XLM payment
  if (!isRecipient) {
    const senderActionIcon = (
      <Icon.ArrowCircleUp size={16} color={themeColors.foreground.primary} />
    );
    const senderIcon = (
      <AssetIcon
        token={{
          type: AssetTypeWithCustomToken.NATIVE,
          code: NATIVE_TOKEN_CODE,
        }}
        size="lg"
      />
    );
    const transactionDetails: TransactionDetails = {
      operation,
      transactionTitle: NATIVE_TOKEN_CODE,
      transactionType: TransactionType.PAYMENT,
      fee,
      status: TransactionStatus.SUCCESS,
      IconComponent: senderIcon,
      ActionIconComponent: senderActionIcon,
      externalUrl: `${stellarExpertUrl}/op/${operation.id}`,
      paymentDetails: {
        to: account,
        from: funder,
        amount: startingBalance,
        assetCode: NATIVE_TOKEN_CODE,
        assetType: "native",
      },
    };

    return {
      transactionDetails,
      rowText: NATIVE_TOKEN_CODE,
      dateText: date,
      amountText: `-${formatAssetAmount(startingBalance, NATIVE_TOKEN_CODE)}`,
      actionText: t("history.transactionHistory.sent"),
      ActionIconComponent: senderActionIcon,
      IconComponent: senderIcon,
      transactionStatus: TransactionStatus.SUCCESS,
      isAddingFunds: false,
    };
  }

  // RECIPIENT's view: Show as "Account Funded"
  const formattedAmount = `+${formatAssetAmount(
    startingBalance,
    NATIVE_TOKEN_CODE,
  )}`;

  const recipientActionIcon = (
    <Icon.PlusCircle size={16} color={themeColors.foreground.primary} />
  );

  const transactionDetails: TransactionDetails = {
    operation,
    transactionTitle: t("history.transactionHistory.accountFunded"),
    transactionType: TransactionType.CREATE_ACCOUNT,
    fee,
    status: TransactionStatus.SUCCESS,
    IconComponent: null,
    ActionIconComponent: recipientActionIcon,
    externalUrl: `${stellarExpertUrl}/op/${operation.id}`,
    createAccountDetails: {
      accountPublicKey: account,
      startingBalance,
    },
  };

  return {
    transactionDetails,
    rowText: t("history.transactionHistory.accountFunded"),
    dateText: date,
    amountText: formattedAmount,
    actionText: t("history.transactionHistory.received"),
    ActionIconComponent: recipientActionIcon,
    IconComponent: null,
    transactionStatus: TransactionStatus.SUCCESS,
    isAddingFunds: true,
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
