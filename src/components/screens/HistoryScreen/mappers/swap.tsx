/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { logos } from "assets/logos";
import { TokenIcon } from "components/TokenIcon";
import TransactionDetailsContent from "components/screens/HistoryScreen/TransactionDetailsContent";
import {
  TransactionDetails,
  TransactionType,
  TransactionStatus,
  HistoryItemData,
  AssetDiffSummary,
} from "components/screens/HistoryScreen/types";
import Icon from "components/sds/Icon";
import { Token } from "components/sds/Token";
import { Text } from "components/sds/Typography";
import {
  DEFAULT_DECIMALS,
  NATIVE_TOKEN_CODE,
  NETWORKS,
} from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { formatTokenForDisplay } from "helpers/formatAmount";
import { getIconUrl } from "helpers/getIconUrl";
import useColors, { ThemeColors } from "hooks/useColors";
import { t } from "i18next";
import React from "react";
import { View } from "react-native";

interface SwapHistoryItemData {
  operation: any;
  stellarExpertUrl: string;
  date: string;
  fee: string;
  memo?: string;
  network: NETWORKS;
  themeColors: ThemeColors;
  xdr: string;
}

/**
 * Maps swap operation data to history item data
 */
export const mapSwapHistoryItem = async ({
  operation,
  stellarExpertUrl,
  date,
  fee,
  memo,
  network,
  themeColors,
  xdr,
}: SwapHistoryItemData): Promise<HistoryItemData> => {
  const {
    id,
    amount,
    asset_code: destTokenCode,
    asset_issuer: tokenIssuer,
    source_asset_code: sourceTokenCode,
    source_asset_issuer: sourceTokenIssuer,
  } = operation;

  const srcTokenCode = sourceTokenCode || NATIVE_TOKEN_CODE;
  const destTokenCodeFinal = destTokenCode || NATIVE_TOKEN_CODE;
  const formattedAmount = `+${formatTokenForDisplay(amount, destTokenCodeFinal)}`;

  // Get token icons for assetDiffs (for detailed views)
  const destIcon =
    destTokenCodeFinal === NATIVE_TOKEN_CODE
      ? undefined
      : await getIconUrl({
          asset: {
            code: destTokenCodeFinal || "",
            issuer: tokenIssuer || "",
          },
          network,
        });

  const sourceIcon =
    srcTokenCode === NATIVE_TOKEN_CODE
      ? undefined
      : await getIconUrl({
          asset: {
            code: srcTokenCode || "",
            issuer: sourceTokenIssuer || "",
          },
          network,
        });

  // Create asset diffs for swap: one debit (sent) and one credit (received)
  const assetDiffs: AssetDiffSummary[] = [
    // Debit: Source asset being sold
    {
      assetCode: srcTokenCode,
      assetIssuer: sourceTokenIssuer || null,
      decimals: DEFAULT_DECIMALS,
      amount: operation.source_amount || "",
      isCredit: false,
      icon: sourceIcon,
    },
    // Credit: Destination asset being bought
    {
      assetCode: destTokenCodeFinal,
      assetIssuer: tokenIssuer || null,
      decimals: DEFAULT_DECIMALS,
      amount,
      isCredit: true,
      icon: destIcon,
    },
  ];

  const ActionIconComponent = (
    <Icon.RefreshCw05 size={16} color={themeColors.foreground.primary} />
  );

  const IconComponent = (
    <Token
      size="lg"
      variant="swap"
      sourceOne={{
        altText: "Swap source token logo",
        // For native XLM, use the Stellar logo directly
        image: srcTokenCode === NATIVE_TOKEN_CODE ? logos.stellar : undefined,
        token:
          srcTokenCode === NATIVE_TOKEN_CODE
            ? undefined
            : {
                code: srcTokenCode,
                issuer: sourceTokenIssuer || "",
              },
        // Fallback: show token initials if the icon is not available
        renderContent: () => (
          <Text xs secondary semiBold>
            {srcTokenCode.substring(0, 2)}
          </Text>
        ),
      }}
      sourceTwo={{
        altText: "Swap destination token logo",
        // For native XLM, use the Stellar logo directly
        image:
          destTokenCodeFinal === NATIVE_TOKEN_CODE ? logos.stellar : undefined,
        token:
          destTokenCodeFinal === NATIVE_TOKEN_CODE
            ? undefined
            : {
                code: destTokenCodeFinal,
                issuer: tokenIssuer || "",
              },
        // Fallback: show token initials if the icon is not available
        renderContent: () => (
          <Text xs secondary semiBold>
            {destTokenCodeFinal.substring(0, 2)}
          </Text>
        ),
      }}
    />
  );

  const transactionDetails: TransactionDetails = {
    operation,
    transactionTitle: t("history.transactionHistory.swappedTwoTokens", {
      srcTokenCode,
      destTokenCode: destTokenCodeFinal,
    }),
    transactionType: TransactionType.SWAP,
    status: TransactionStatus.SUCCESS,
    IconComponent,
    ActionIconComponent,
    fee,
    memo,
    xdr,
    externalUrl: `${stellarExpertUrl}/op/${id}`,
    swapDetails: {
      sourceTokenIssuer: operation.source_asset_issuer || "",
      destinationTokenIssuer: operation.asset_issuer || "",
      sourceTokenCode: srcTokenCode || "",
      destinationTokenCode: destTokenCodeFinal || "",
      sourceAmount: operation.source_amount || "",
      destinationAmount: operation.amount || "",
      sourceTokenType: operation.source_asset_type || "",
      destinationTokenType: operation.asset_type || "",
    },
    assetDiffs,
  };

  return {
    transactionDetails,
    rowText: t("history.transactionHistory.swapTwoTokens", {
      srcTokenCode,
      destTokenCode: destTokenCodeFinal,
    }),
    actionText: t("history.transactionHistory.swapped"),
    dateText: date,
    amountText: formattedAmount,
    isAddingFunds: true,
    ActionIconComponent,
    IconComponent,
    transactionStatus: TransactionStatus.SUCCESS,
  };
};

/**
 * Renders swap transaction details
 */
export const SwapTransactionDetailsContent: React.FC<{
  transactionDetails: TransactionDetails;
}> = ({ transactionDetails }) => {
  const { themeColors } = useColors();

  return (
    <TransactionDetailsContent>
      <View className="flex-row items-center">
        <TokenIcon
          token={{
            code: transactionDetails.swapDetails?.sourceTokenCode ?? "",
            issuer: {
              key: transactionDetails.swapDetails?.sourceTokenIssuer ?? "",
            },
            type: transactionDetails.swapDetails
              ?.sourceTokenType as TokenTypeWithCustomToken,
          }}
        />
        <View className="ml-[16px]">
          <Text xl primary medium numberOfLines={1}>
            {formatTokenForDisplay(
              transactionDetails.swapDetails?.sourceAmount ?? "",
              transactionDetails.swapDetails?.sourceTokenCode ?? "",
            )}
          </Text>
        </View>
      </View>

      <View className="w-[40px] flex items-center py-1">
        <Icon.ChevronDownDouble
          size={20}
          color={themeColors.foreground.primary}
        />
      </View>

      <View className="flex-row items-center">
        <TokenIcon
          token={{
            code: transactionDetails.swapDetails?.destinationTokenCode ?? "",
            issuer: {
              key: transactionDetails.swapDetails?.destinationTokenIssuer ?? "",
            },
            type: transactionDetails.swapDetails
              ?.destinationTokenType as TokenTypeWithCustomToken,
          }}
        />
        <View className="ml-[16px]">
          <Text xl primary medium numberOfLines={1}>
            {formatTokenForDisplay(
              transactionDetails.swapDetails?.destinationAmount ?? "",
              transactionDetails.swapDetails?.destinationTokenCode ?? "",
            )}
          </Text>
        </View>
      </View>
    </TransactionDetailsContent>
  );
};
