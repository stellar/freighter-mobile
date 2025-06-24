/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { logos } from "assets/logos";
import { AssetIcon } from "components/AssetIcon";
import TransactionDetailsContent from "components/screens/HistoryScreen/TransactionDetailsContent";
import {
  TransactionDetails,
  TransactionType,
  TransactionStatus,
  HistoryItemData,
} from "components/screens/HistoryScreen/types";
import { Asset } from "components/sds/Asset";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE, NETWORK_URLS } from "config/constants";
import { AssetTypeWithCustomToken } from "config/types";
import { formatAssetAmount } from "helpers/formatAmount";
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
    asset_code: destAssetCode,
    asset_issuer: assetIssuer,
    source_asset_code: sourceAssetCode,
    source_asset_issuer: sourceAssetIssuer,
  } = operation;

  const srcAssetCode = sourceAssetCode || NATIVE_TOKEN_CODE;
  const destAssetCodeFinal = destAssetCode || NATIVE_TOKEN_CODE;
  const formattedAmount = `+${formatAssetAmount(amount, destAssetCodeFinal)}`;

  // Get token icons
  const destIcon =
    destAssetCodeFinal === NATIVE_TOKEN_CODE
      ? logos.stellar
      : await getIconUrlFromIssuer({
          issuerKey: assetIssuer || "",
          assetCode: destAssetCodeFinal || "",
          networkUrl,
        });

  const sourceIcon =
    srcAssetCode === NATIVE_TOKEN_CODE
      ? logos.stellar
      : await getIconUrlFromIssuer({
          issuerKey: sourceAssetIssuer || "",
          assetCode: srcAssetCode || "",
          networkUrl,
        });

  const ActionIconComponent = (
    <Icon.RefreshCw05 size={16} color={themeColors.foreground.primary} />
  );

  const IconComponent = (
    <Asset
      size="lg"
      variant="swap"
      sourceOne={{
        image: sourceIcon,
        altText: "Swap source token logo",
        renderContent: !sourceIcon
          ? () => (
              <Text xs secondary semiBold>
                {srcAssetCode.substring(0, 2)}
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
                {destAssetCodeFinal.substring(0, 2)}
              </Text>
            )
          : undefined,
      }}
    />
  );

  const transactionDetails: TransactionDetails = {
    operation,
    transactionTitle: t("history.transactionHistory.swappedTwoAssets", {
      srcAssetCode,
      destAssetCode: destAssetCodeFinal,
    }),
    transactionType: TransactionType.SWAP,
    status: TransactionStatus.SUCCESS,
    IconComponent,
    ActionIconComponent,
    fee,
    externalUrl: `${stellarExpertUrl}/op/${id}`,
    swapDetails: {
      sourceAssetIssuer: operation.source_asset_issuer || "",
      destinationAssetIssuer: operation.asset_issuer || "",
      sourceAssetCode: srcAssetCode || "",
      destinationAssetCode: destAssetCodeFinal || "",
      sourceAmount: operation.source_amount || "",
      destinationAmount: operation.amount || "",
      sourceAssetType: operation.source_asset_type || "",
      destinationAssetType: operation.asset_type || "",
    },
  };

  return {
    transactionDetails,
    rowText: t("history.transactionHistory.swapTwoAssets", {
      srcAssetCode,
      destAssetCode: destAssetCodeFinal,
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
            {formatAssetAmount(
              transactionDetails.swapDetails?.sourceAmount ?? "",
              transactionDetails.swapDetails?.sourceAssetCode ?? "",
            )}
          </Text>
        </View>
        <AssetIcon
          token={{
            code: transactionDetails.swapDetails?.sourceAssetCode ?? "",
            issuer: {
              key: transactionDetails.swapDetails?.sourceAssetIssuer ?? "",
            },
            type: transactionDetails.swapDetails
              ?.sourceAssetType as AssetTypeWithCustomToken,
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
            {formatAssetAmount(
              transactionDetails.swapDetails?.destinationAmount ?? "",
              transactionDetails.swapDetails?.destinationAssetCode ?? "",
            )}
          </Text>
        </View>
        <AssetIcon
          token={{
            code: transactionDetails.swapDetails?.destinationAssetCode ?? "",
            issuer: {
              key: transactionDetails.swapDetails?.destinationAssetIssuer ?? "",
            },
            type: transactionDetails.swapDetails
              ?.destinationAssetType as AssetTypeWithCustomToken,
          }}
        />
      </View>
    </TransactionDetailsContent>
  );
};
