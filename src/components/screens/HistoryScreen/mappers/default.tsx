/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
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
import { capitalize } from "lodash";
import React from "react";

/**
 * Creates a default history item data for unrecognized transaction types
 */
export const createDefaultHistoryItemData = (
  operation: any,
  stellarExpertUrl: string,
  date: string,
  fee: string,
  xdr: string,
  memo: string | undefined,
  themeColors: ThemeColors,
): HistoryItemData => {
  const { type, id, amount = null } = operation;

  const rowText = capitalize(type).replaceAll("_", " ");

  const transactionDetails: TransactionDetails = {
    operation,
    transactionTitle: rowText,
    transactionType: TransactionType.UNKNOWN,
    status: TransactionStatus.SUCCESS,
    fee,
    xdr,
    memo,
    IconComponent: null,
    ActionIconComponent: null,
    externalUrl: `${stellarExpertUrl}/op/${id}`,
  };

  return {
    transactionDetails,
    dateText: date,
    rowText,
    amountText: amount,
    IconComponent: null,
    actionText: t("history.transactionHistory.transaction"),
    ActionIconComponent: (
      <Icon.Wallet03 size={16} color={themeColors.foreground.primary} />
    ),
    transactionStatus: TransactionStatus.SUCCESS,
    isAddingFunds: null,
  };
};
