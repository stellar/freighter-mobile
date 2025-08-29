/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  isCreateAccountOperation,
  isChangeTrustOperation,
  isSorobanInvokeHostFunction,
} from "components/screens/HistoryScreen/helpers";
import { mapChangeTrustHistoryItem } from "components/screens/HistoryScreen/mappers/changeTrust";
import { mapCreateAccountHistoryItem } from "components/screens/HistoryScreen/mappers/createAccount";
import { createDefaultHistoryItemData } from "components/screens/HistoryScreen/mappers/default";
import { mapFailedTransactionHistoryItem } from "components/screens/HistoryScreen/mappers/failed";
import { mapPaymentHistoryItem } from "components/screens/HistoryScreen/mappers/payment";
import { mapSorobanHistoryItem } from "components/screens/HistoryScreen/mappers/soroban";
import { mapSwapHistoryItem } from "components/screens/HistoryScreen/mappers/swap";
import { HistoryItemData } from "components/screens/HistoryScreen/types";
import { NetworkDetails, NETWORKS } from "config/constants";
import { BalanceMap } from "config/types";
import { formatTransactionDate } from "helpers/date";
import { getAttrsFromSorobanHorizonOp } from "helpers/soroban";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import { ThemeColors } from "hooks/useColors";

interface MapHistoryItemDataProps {
  operation: any;
  accountBalances: BalanceMap;
  publicKey: string;
  networkDetails: NetworkDetails;
  network: NETWORKS;
  themeColors: ThemeColors;
}

/**
 * Main mapper function to convert operation data into history item data
 */
export const mapHistoryItemData = async ({
  operation,
  accountBalances,
  publicKey,
  networkDetails,
  network,
  themeColors,
}: MapHistoryItemDataProps): Promise<HistoryItemData> => {
  const {
    created_at: createdAt,
    transaction_attr: { fee_charged: fee },
    transaction_successful: transactionSuccessful,
    type,
    type_i: typeI,
    isPayment = false,
    isSwap = false,
    isCreateExternalAccount = false,
  } = operation;

  // Format date for display
  const date = formatTransactionDate(createdAt, false);

  // Get URL for transaction viewing
  const stellarExpertUrl = getStellarExpertUrl(network);

  // Handle failed transaction
  if (transactionSuccessful === false) {
    return mapFailedTransactionHistoryItem({
      operation,
      stellarExpertUrl,
      date,
      fee,
      themeColors,
    });
  }

  // Handle create account
  if (isCreateAccountOperation(type)) {
    return mapCreateAccountHistoryItem({
      operation,
      stellarExpertUrl,
      date,
      fee,
      themeColors,
      isCreateExternalAccount,
    });
  }

  // Handle change trust
  if (isChangeTrustOperation(type)) {
    return mapChangeTrustHistoryItem({
      operation,
      stellarExpertUrl,
      date,
      fee,
      themeColors,
    });
  }

  // Handle swap
  if (isSwap) {
    return mapSwapHistoryItem({
      operation,
      stellarExpertUrl,
      date,
      fee,
      network: networkDetails.network,
      themeColors,
    });
  }

  // Handle payment
  if (isPayment) {
    return mapPaymentHistoryItem({
      operation,
      publicKey,
      stellarExpertUrl,
      date,
      fee,
      themeColors,
    });
  }

  // Handle Soroban invoke host function
  if (isSorobanInvokeHostFunction(typeI)) {
    // Get Soroban operation attributes if available
    const sorobanAttributes = getAttrsFromSorobanHorizonOp(
      operation,
      networkDetails,
    );

    return mapSorobanHistoryItem({
      operation,
      sorobanAttributes,
      accountBalances,
      publicKey,
      networkDetails,
      network,
      stellarExpertUrl,
      date,
      fee,
      themeColors,
    });
  }

  // Default case for unrecognized transaction types
  return createDefaultHistoryItemData(
    operation,
    stellarExpertUrl,
    date,
    fee,
    themeColors,
  );
};
