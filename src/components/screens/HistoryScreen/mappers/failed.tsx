/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  TransactionDetails,
  TransactionType,
  TransactionStatus,
  HistoryItemData,
} from "components/screens/HistoryScreen/types";
import Icon from "components/sds/Icon";
import { ThemeColors } from "hooks/useColors";
import { t } from "i18next";
import React from "react";

interface FailedTransactionHistoryItemData {
  operation: any;
  stellarExpertUrl: string;
  date: string;
  fee: string;
  themeColors: ThemeColors;
}

/**
 * Maps failed transaction data to history item data
 */
export const mapFailedTransactionHistoryItem = ({
  operation,
  stellarExpertUrl,
  date,
  fee,
  themeColors,
}: FailedTransactionHistoryItemData): HistoryItemData => {
  const { id } = operation;

  const IconComponent = (
    <Icon.Wallet03 size={26} circle color={themeColors.foreground.primary} />
  );

  const ActionIconComponent = (
    <Icon.XCircle size={16} color={themeColors.status.error} />
  );

  const transactionDetails: TransactionDetails = {
    operation,
    transactionTitle: t("history.transactionHistory.transactionFailed"),
    transactionType: TransactionType.UNKNOWN,
    status: TransactionStatus.FAILED,
    IconComponent,
    ActionIconComponent,
    fee,
    externalUrl: `${stellarExpertUrl}/op/${id}`,
  };

  return {
    transactionDetails,
    rowText: t("history.transactionHistory.transactionFailed"),
    actionText: t("history.transactionHistory.failed"),
    dateText: date,
    amountText: null,
    IconComponent,
    ActionIconComponent,
    transactionStatus: TransactionStatus.FAILED,
    isAddingFunds: null,
  };
};
