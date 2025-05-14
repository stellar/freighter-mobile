/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import { Horizon } from "@stellar/stellar-sdk";
import Icon from "components/sds/Icon";
import { OPERATION_TYPES } from "config/constants";
import { SorobanTokenInterface } from "helpers/soroban";
import { ThemeColors } from "hooks/useColors";
import { t } from "i18next";
import { camelCase } from "lodash";
import React from "react";

/**
 * Renders icon component for history items
 */
export const renderIconComponent = ({
  iconComponent,
  themeColors,
}: {
  iconComponent?: React.ReactElement | null;
  themeColors: ThemeColors;
}) => {
  if (iconComponent) {
    return iconComponent;
  }

  return (
    <Icon.User01 circle color={themeColors.foreground.primary} size={26} />
  );
};

/**
 * Renders action icon for history items
 */
export const renderActionIcon = ({
  actionIcon,
  themeColors,
}: {
  actionIcon?: React.ReactElement | null;
  themeColors: ThemeColors;
}) => {
  if (actionIcon) {
    return actionIcon;
  }

  return <Icon.Wallet03 color={themeColors.foreground.primary} size={16} />;
};

/**
 * Formats date for transaction history
 */
export const formatTransactionDate = (createdAt: string): string =>
  new Date(Date.parse(createdAt))
    .toDateString()
    .split(" ")
    .slice(1, 3)
    .join(" ");

/**
 * Creates operation description string
 */
export const createOperationString = (
  type: string,
  operationCount: number,
): string => {
  const operationType = camelCase(type) as keyof typeof OPERATION_TYPES;
  const opTypeStr =
    OPERATION_TYPES[operationType] ||
    t("history.transactionHistory.transaction");

  return `${opTypeStr}${
    operationCount > 1
      ? ` + ${operationCount - 1} ${t("history.transactionHistory.ops")}`
      : ""
  }`;
};

/**
 * Determines if the operation is a create account operation
 */
export const isCreateAccountOperation = (type: string): boolean =>
  type === Horizon.HorizonApi.OperationResponseType.createAccount;

/**
 * Determines if the operation is a change trust operation
 */
export const isChangeTrustOperation = (type: string): boolean =>
  type === Horizon.HorizonApi.OperationResponseType.changeTrust;

/**
 * Determines if the operation is a Soroban invoke host function
 */
export const isSorobanInvokeHostFunction = (typeI: number): boolean =>
  typeI === 24;

/**
 * Determines if the Soroban operation is a token mint
 */
export const isSorobanTokenMint = (fnName: string | undefined): boolean =>
  fnName === SorobanTokenInterface.mint;

/**
 * Determines if the Soroban operation is a token transfer
 */
export const isSorobanTokenTransfer = (fnName: string | undefined): boolean =>
  fnName === SorobanTokenInterface.transfer;

export const calculateSwapRate = (
  sourceAmount: number,
  destinationAmount: number,
): number => {
  if (sourceAmount === 0 || destinationAmount === 0) {
    return 0;
  }

  return destinationAmount / sourceAmount;
};
