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
} from "components/screens/HistoryScreen/types";
import Icon from "components/sds/Icon";
import { Token } from "components/sds/Token";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE, NETWORK_URLS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { formatTokenAmount } from "helpers/formatAmount";
import { getIconUrlFromIssuer } from "helpers/getIconUrlFromIssuer";
import useColors, { ThemeColors } from "hooks/useColors";
import { t } from "i18next";
import React from "react";
import { View } from "react-native";

interface SwapHistoryItemData {
  operation: any;
  stellarExpertUrl: string;
  date: string;
  fee: string;
  networkUrl: NETWORK_URLS;
  themeColors: ThemeColors;
}

/**
 * Maps swap operation data to history item data
 */
export const mapSwapHistoryItem = async ({
  operation,
  stellarExpertUrl,
  date,
  fee,
  networkUrl,
  themeColors,
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
  const formattedAmount = `+${formatTokenAmount(amount, destTokenCodeFinal)}`;

  // Get token icons
  const destIcon =
    destTokenCodeFinal === NATIVE_TOKEN_CODE
      ? logos.stellar
      : await getIconUrlFromIssuer({
          issuerKey: tokenIssuer || "",
          tokenCode: destTokenCodeFinal || "",
          networkUrl,
        });

  const sourceIcon =
    srcTokenCode === NATIVE_TOKEN_CODE
      ? logos.stellar
      : await getIconUrlFromIssuer({
          issuerKey: sourceTokenIssuer || "",
          tokenCode: srcTokenCode || "",
          networkUrl,
        });

  const ActionIconComponent = (
    <Icon.RefreshCw05 size={16} color={themeColors.foreground.primary} />
  );

  const IconComponent = (
    <Token
      size="lg"
      variant="swap"
      sourceOne={{
        image: sourceIcon,
        altText: "Swap source token logo",
        renderContent: !sourceIcon
          ? () => (
              <Text xs secondary semiBold>
                {srcTokenCode.substring(0, 2)}
              </Text>
            )
          : undefined,
      }}
      sourceTwo={{
        image: destIcon,
        altText: "Swap destination token logo",
        renderContent: !destIcon
          ? () => (
              <Text xs secondary semiBold>
                {destTokenCodeFinal.substring(0, 2)}
              </Text>
            )
          : undefined,
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
      <View className="flex-row justify-between items-center">
        <View>
          <Text xl primary medium numberOfLines={1}>
            {formatTokenAmount(
              transactionDetails.swapDetails?.sourceAmount ?? "",
              transactionDetails.swapDetails?.sourceTokenCode ?? "",
            )}
          </Text>
        </View>
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
      </View>

      <Icon.ChevronDownDouble
        size={20}
        color={themeColors.foreground.primary}
        circle
        circleBackground={themeColors.background.tertiary}
      />

      <View className="flex-row justify-between items-center">
        <View>
          <Text xl primary medium numberOfLines={1}>
            {formatTokenAmount(
              transactionDetails.swapDetails?.destinationAmount ?? "",
              transactionDetails.swapDetails?.destinationTokenCode ?? "",
            )}
          </Text>
        </View>
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
      </View>
    </TransactionDetailsContent>
  );
};
