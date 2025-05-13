/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import BigNumber from "bignumber.js";
import { AssetIcon } from "components/AssetIcon";
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

/**
 * Maps change trust operation data to history item data
 */
export const mapChangeTrustHistoryItem = (
  operation: any,
  stellarExpertUrl: string,
  date: string,
  fee: string,
  themeColors: ThemeColors,
): HistoryItemData => {
  const {
    asset_code: destAssetCode,
    asset_type: assetType,
    asset_issuer: assetIssuer,
    id,
  } = operation;

  const isRemovingTrustline = BigNumber(operation?.limit).eq(0);

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

  const actionText = isRemovingTrustline
    ? t("history.transactionHistory.removedTrustline")
    : t("history.transactionHistory.addedTrustline");

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
    rowText: destAssetCode,
    actionText,
    dateText: date,
    IconComponent,
    ActionIconComponent,
    amountText: null,
    transactionStatus: TransactionStatus.SUCCESS,
    isAddingFunds: null,
  };
};
