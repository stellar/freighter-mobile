/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import BigNumber from "bignumber.js";
import { TokenIcon } from "components/TokenIcon";
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

interface ChangeTrustHistoryItemData {
  operation: any;
  stellarExpertUrl: string;
  date: string;
  fee: string;
  themeColors: ThemeColors;
}

/**
 * Maps change trust operation data to history item data
 */
export const mapChangeTrustHistoryItem = ({
  operation,
  stellarExpertUrl,
  date,
  fee,
  themeColors,
}: ChangeTrustHistoryItemData): HistoryItemData => {
  const {
    asset_code: destTokenCode,
    asset_type: tokenType,
    asset_issuer: tokenIssuer,
    id,
  } = operation;

  const isRemovingTrustline = BigNumber(operation?.limit).eq(0);

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

  const actionText = isRemovingTrustline
    ? t("history.transactionHistory.removedToken")
    : t("history.transactionHistory.addedToken");

  const ActionIconComponent = isRemovingTrustline ? (
    <Icon.MinusCircle size={16} color={themeColors.foreground.primary} />
  ) : (
    <Icon.PlusCircle size={16} color={themeColors.foreground.primary} />
  );

  const transactionDetails: TransactionDetails = {
    operation,
    transactionTitle: actionText,
    transactionType: TransactionType.CHANGE_TRUST,
    status: TransactionStatus.SUCCESS,
    IconComponent,
    ActionIconComponent,
    fee,
    externalUrl: `${stellarExpertUrl}/op/${id}`,
  };

  return {
    transactionDetails,
    rowText: destTokenCode || capitalize(tokenType).replaceAll("_", " "),
    actionText,
    dateText: date,
    IconComponent,
    ActionIconComponent,
    amountText: null,
    transactionStatus: TransactionStatus.SUCCESS,
    isAddingFunds: null,
  };
};
