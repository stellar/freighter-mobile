/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import BigNumber from "bignumber.js";
import { AssetIcon } from "components/AssetIcon";
import TransactionDetailsContent from "components/screens/HistoryScreen/TransactionDetailsContent";
import { createOperationString } from "components/screens/HistoryScreen/helpers";
import {
  TransactionDetails,
  TransactionType,
  TransactionStatus,
  HistoryItemData,
} from "components/screens/HistoryScreen/types";
import Avatar, { AvatarSizes } from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE, NetworkDetails, NETWORKS } from "config/constants";
import {
  AssetTypeWithCustomToken,
  BalanceMap,
  CustomToken,
} from "config/types";
import { formatAssetAmount } from "helpers/formatAmount";
import {
  SorobanTokenInterface,
  formatTokenAmount,
  getBalanceByKey,
} from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import useColors, { ThemeColors } from "hooks/useColors";
import { t } from "i18next";
import { capitalize } from "lodash";
import React from "react";
import { View } from "react-native";
import { getTokenDetails } from "services/backend";

interface SorobanHistoryItemData {
  operation: any;
  sorobanAttributes: any;
  accountBalances: BalanceMap;
  publicKey: string;
  networkDetails: NetworkDetails;
  network: NETWORKS;
  stellarExpertUrl: string;
  date: string;
  fee: string;
  themeColors: ThemeColors;
}

interface ProcessSorobanMintData {
  operation: any;
  sorobanAttributes: any;
  accountBalances: BalanceMap;
  publicKey: string;
  networkDetails: NetworkDetails;
  network: NETWORKS;
  stellarExpertUrl: string;
  fee: string;
  themeColors: ThemeColors;
  baseHistoryItemData: Partial<HistoryItemData>;
}

interface ProcessSorobanTransferData {
  operation: any;
  sorobanAttributes: any;
  publicKey: string;
  network: NETWORKS;
  stellarExpertUrl: string;
  fee: string;
  themeColors: ThemeColors;
  baseHistoryItemData: Partial<HistoryItemData>;
  operationString: string;
}

/**
 * Process Soroban Token mint operations
 */
const processSorobanMint = async ({
  operation,
  sorobanAttributes,
  accountBalances,
  publicKey,
  networkDetails,
  network,
  stellarExpertUrl,
  fee,
  themeColors,
  baseHistoryItemData,
}: ProcessSorobanMintData): Promise<HistoryItemData> => {
  const { id } = operation;
  const isReceiving = sorobanAttributes.to === publicKey;

  const assetBalance = getBalanceByKey(
    sorobanAttributes.contractId,
    Object.values(accountBalances),
    networkDetails,
  );

  const IconComponent = isReceiving ? (
    <Icon.ArrowDown size={26} circle color={themeColors.foreground.primary} />
  ) : (
    <Icon.ArrowUp size={26} circle color={themeColors.foreground.primary} />
  );

  const ActionIconComponent = (
    <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
  );

  const historyItemData: Partial<HistoryItemData> = {
    ...baseHistoryItemData,
    rowText: t("history.transactionHistory.contract"),
    actionText: t("history.transactionHistory.minted"),
    IconComponent,
    ActionIconComponent,
    isAddingFunds: isReceiving,
  };

  // If user doesn't have this token in their balances yet
  if (!assetBalance) {
    try {
      const tokenDetailsResponse = await getTokenDetails({
        contractId: sorobanAttributes.contractId,
        publicKey,
        network,
      });

      if (!tokenDetailsResponse) {
        // Generic contract info if token details not available
        historyItemData.rowText = capitalize(sorobanAttributes.fnName);
        const transactionDetails: TransactionDetails = {
          operation,
          transactionTitle: t("history.transactionHistory.contract"),
          transactionType: TransactionType.CONTRACT,
          status: TransactionStatus.SUCCESS,
          fee,
          IconComponent: historyItemData.IconComponent,
          ActionIconComponent: historyItemData.ActionIconComponent,
          externalUrl: `${stellarExpertUrl}/op/${id}`,
        };

        historyItemData.transactionDetails = transactionDetails;
      } else {
        const token = {
          contractId: sorobanAttributes.contractId,
          decimals: tokenDetailsResponse.decimals,
          name: tokenDetailsResponse.name,
          symbol: tokenDetailsResponse.symbol,
        };

        const isNative = token.symbol === "native";
        const code = isNative ? NATIVE_TOKEN_CODE : token.symbol;

        const transactionTitle = isReceiving
          ? t("history.transactionHistory.mintedToSelf", {
              tokenSymbol: code,
            })
          : `${t("history.transactionHistory.minted")} ${code}`;

        const formattedTokenAmount = formatTokenAmount(
          new BigNumber(sorobanAttributes.amount),
          token.decimals,
        );

        const formattedAmount = `${isReceiving ? "+" : ""}${formatAssetAmount(
          formattedTokenAmount,
          code,
        )}`;

        historyItemData.amountText = formattedAmount;
        historyItemData.IconComponent = isNative ? (
          <AssetIcon
            token={{
              type: AssetTypeWithCustomToken.NATIVE,
              code: NATIVE_TOKEN_CODE,
            }}
            size="lg"
          />
        ) : (
          <AssetIcon
            token={{
              type: AssetTypeWithCustomToken.CUSTOM_TOKEN,
              code: token.symbol,
              issuer: {
                key: "",
              },
            }}
            size="lg"
          />
        );

        historyItemData.rowText = isNative
          ? NATIVE_TOKEN_CODE
          : (token.name ?? token.symbol);

        const transactionDetails: TransactionDetails = {
          operation,
          transactionTitle,
          transactionType: TransactionType.CONTRACT,
          status: TransactionStatus.SUCCESS,
          fee,
          IconComponent: historyItemData.IconComponent,
          ActionIconComponent: historyItemData.ActionIconComponent,
          externalUrl: `${stellarExpertUrl}/op/${id}`,
          contractDetails: {
            contractAddress: sorobanAttributes.contractId,
            contractName: token.name,
            contractSymbol: code,
            contractDecimals: token.decimals,
            sorobanTokenInterface: SorobanTokenInterface.mint,
          },
        };

        historyItemData.transactionDetails = transactionDetails;
      }
    } catch (error) {
      historyItemData.rowText = capitalize(sorobanAttributes.fnName);
      historyItemData.actionText = t("history.transactionHistory.minted");

      const transactionDetails: TransactionDetails = {
        operation,
        transactionTitle: t("history.transactionHistory.contract"),
        transactionType: TransactionType.CONTRACT,
        status: TransactionStatus.SUCCESS,
        fee,
        IconComponent: historyItemData.IconComponent,
        ActionIconComponent: historyItemData.ActionIconComponent,
        externalUrl: `${stellarExpertUrl}/op/${id}`,
      };

      historyItemData.transactionDetails = transactionDetails;
    }
  } else {
    // User already has this token in their balances
    const { decimals, symbol } = assetBalance as CustomToken;
    const isNative = symbol === "native";
    const code = isNative ? NATIVE_TOKEN_CODE : symbol;

    const formattedTokenAmount = formatTokenAmount(
      new BigNumber(sorobanAttributes.amount),
      Number(decimals),
    );

    const formattedAmount = `${isReceiving ? "+" : ""}${formatAssetAmount(
      formattedTokenAmount,
      code,
    )}`;

    historyItemData.amountText = formattedAmount;
    historyItemData.rowText = capitalize(sorobanAttributes.fnName);

    const transactionDetails: TransactionDetails = {
      operation,
      transactionTitle: t("history.transactionHistory.minted"),
      transactionType: TransactionType.CONTRACT,
      status: TransactionStatus.SUCCESS,
      fee,
      IconComponent,
      ActionIconComponent,
      externalUrl: `${stellarExpertUrl}/op/${id}`,
      contractDetails: {
        contractAddress: sorobanAttributes.contractId,
        contractSymbol: code,
        contractDecimals: decimals,
        sorobanTokenInterface: SorobanTokenInterface.mint,
      },
    };

    historyItemData.transactionDetails = transactionDetails;
  }

  return historyItemData as HistoryItemData;
};

/**
 * Process Soroban Token transfer operations
 */
const processSorobanTransfer = async ({
  operation,
  sorobanAttributes,
  publicKey,
  network,
  stellarExpertUrl,
  fee,
  themeColors,
  baseHistoryItemData,
  operationString,
}: ProcessSorobanTransferData): Promise<HistoryItemData> => {
  const { id } = operation;
  const historyItemData: Partial<HistoryItemData> = { ...baseHistoryItemData };

  try {
    const tokenDetailsResponse = await getTokenDetails({
      contractId: sorobanAttributes.contractId,
      publicKey,
      network,
    });

    if (!tokenDetailsResponse) {
      historyItemData.rowText = operationString;
      const transactionDetails: TransactionDetails = {
        operation,
        transactionTitle: t("history.transactionHistory.contract"),
        transactionType: TransactionType.CONTRACT_TRANSFER,
        status: TransactionStatus.SUCCESS,
        fee,
        IconComponent: historyItemData.IconComponent,
        ActionIconComponent: historyItemData.ActionIconComponent,
        externalUrl: `${stellarExpertUrl}/op/${id}`,
        contractDetails: {
          contractAddress: sorobanAttributes.contractId,
          contractSymbol: "",
          contractDecimals: 0,
          sorobanTokenInterface: SorobanTokenInterface.transfer,
          transferDetails: {
            from: sorobanAttributes.from,
            to: sorobanAttributes.to,
            amount: sorobanAttributes.amount,
          },
        },
      };

      historyItemData.transactionDetails = transactionDetails;
      return historyItemData as HistoryItemData;
    }

    const { symbol, decimals, name } = tokenDetailsResponse;
    const isNative = symbol === "native";
    const code = isNative ? NATIVE_TOKEN_CODE : symbol;
    const formattedTokenAmount = formatTokenAmount(
      new BigNumber(sorobanAttributes.amount),
      decimals,
    );

    const isRecipient =
      sorobanAttributes.to === publicKey &&
      sorobanAttributes.from !== publicKey;

    const paymentDifference = isRecipient ? "+" : "-";
    const formattedAmount = `${paymentDifference}${formatAssetAmount(
      formattedTokenAmount,
      code,
    )}`;

    historyItemData.amountText = formattedAmount;
    historyItemData.IconComponent = isNative ? (
      <AssetIcon
        token={{
          type: AssetTypeWithCustomToken.NATIVE,
          code: NATIVE_TOKEN_CODE,
        }}
        size="lg"
      />
    ) : (
      <AssetIcon
        token={{
          type: AssetTypeWithCustomToken.CUSTOM_TOKEN,
          code: symbol,
          issuer: {
            key: "",
          },
        }}
        size="lg"
      />
    );

    historyItemData.ActionIconComponent = isRecipient ? (
      <Icon.ArrowCircleDown size={16} color={themeColors.foreground.primary} />
    ) : (
      <Icon.ArrowCircleUp size={16} color={themeColors.foreground.primary} />
    );

    historyItemData.isAddingFunds = isRecipient;
    historyItemData.rowText = isNative ? NATIVE_TOKEN_CODE : (name ?? symbol);
    historyItemData.actionText = isRecipient
      ? t("history.transactionHistory.received")
      : t("history.transactionHistory.sent");

    const transactionDetails: TransactionDetails = {
      operation,
      transactionTitle: `${isRecipient ? t("history.transactionHistory.received") : t("history.transactionHistory.sent")} ${code}`,
      transactionType: TransactionType.CONTRACT_TRANSFER,
      status: TransactionStatus.SUCCESS,
      fee,
      IconComponent: historyItemData.IconComponent,
      ActionIconComponent: historyItemData.ActionIconComponent,
      externalUrl: `${stellarExpertUrl}/op/${id}`,
      contractDetails: {
        contractAddress: sorobanAttributes.contractId,
        contractSymbol: code,
        contractDecimals: decimals,
        sorobanTokenInterface: SorobanTokenInterface.transfer,
        transferDetails: {
          from: sorobanAttributes.from,
          to: sorobanAttributes.to,
          amount: sorobanAttributes.amount,
        },
      },
    };

    historyItemData.transactionDetails = transactionDetails;
  } catch (error) {
    historyItemData.rowText = operationString;
    const transactionDetails: TransactionDetails = {
      operation,
      transactionTitle: t("history.transactionHistory.contract"),
      transactionType: TransactionType.CONTRACT_TRANSFER,
      status: TransactionStatus.SUCCESS,
      fee,
      IconComponent: historyItemData.IconComponent,
      ActionIconComponent: historyItemData.ActionIconComponent,
      externalUrl: `${stellarExpertUrl}/op/${id}`,
      contractDetails: {
        contractAddress: sorobanAttributes.contractId,
        contractSymbol: "",
        contractDecimals: 0,
        sorobanTokenInterface: SorobanTokenInterface.transfer,
        transferDetails: {
          from: sorobanAttributes.from,
          to: sorobanAttributes.to,
          amount: sorobanAttributes.amount,
        },
      },
    };

    historyItemData.transactionDetails = transactionDetails;
  }

  return historyItemData as HistoryItemData;
};

/**
 * Maps Soroban contract operations to history item data
 */
export const mapSorobanHistoryItem = async ({
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
}: SorobanHistoryItemData): Promise<HistoryItemData> => {
  const {
    id,
    transaction_attr: { operation_count: operationCount } = {
      operation_count: 1,
    },
    type,
  } = operation;

  const operationString = createOperationString(type, operationCount);

  // Default history item data for unidentified Soroban operations
  const baseHistoryItemData: Partial<HistoryItemData> = {
    rowText: t("history.transactionHistory.contract"),
    actionText: t("history.transactionHistory.interacted"),
    dateText: date,
    amountText: null,
    IconComponent: (
      <Icon.FileCode02
        size={26}
        color={themeColors.foreground.primary}
        circle
      />
    ),
    ActionIconComponent: (
      <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
    ),
    isAddingFunds: null,
    transactionStatus: TransactionStatus.SUCCESS,
  };

  // If no Soroban attributes, return a generic contract interaction
  if (!sorobanAttributes) {
    const transactionDetails: TransactionDetails = {
      operation,
      transactionTitle: t("history.transactionHistory.interacted"),
      transactionType: TransactionType.CONTRACT,
      status: TransactionStatus.SUCCESS,
      fee,
      IconComponent: baseHistoryItemData.IconComponent,
      ActionIconComponent: baseHistoryItemData.ActionIconComponent,
      externalUrl: `${stellarExpertUrl}/op/${id}`,
    };

    return {
      ...baseHistoryItemData,
      transactionDetails,
    } as HistoryItemData;
  }

  // Handle token mint operation
  if (sorobanAttributes.fnName === SorobanTokenInterface.mint) {
    return processSorobanMint({
      operation,
      sorobanAttributes,
      accountBalances,
      publicKey,
      networkDetails,
      network,
      stellarExpertUrl,
      fee,
      themeColors,
      baseHistoryItemData,
    });
  }

  // Handle token transfer operation
  if (sorobanAttributes.fnName === SorobanTokenInterface.transfer) {
    return processSorobanTransfer({
      operation,
      sorobanAttributes,
      publicKey,
      network,
      stellarExpertUrl,
      fee,
      themeColors,
      baseHistoryItemData,
      operationString,
    });
  }

  // Default case for other Soroban operations
  const transactionDetails: TransactionDetails = {
    operation,
    transactionTitle: t("history.transactionHistory.contract"),
    transactionType: TransactionType.CONTRACT,
    status: TransactionStatus.SUCCESS,
    fee,
    IconComponent: baseHistoryItemData.IconComponent,
    ActionIconComponent: baseHistoryItemData.ActionIconComponent,
    externalUrl: `${stellarExpertUrl}/op/${id}`,
  };

  return {
    ...baseHistoryItemData,
    rowText: operationString,
    transactionDetails,
  } as HistoryItemData;
};

/**
 * Renders Soroban transfer transaction details
 */
export const SorobanTransferTransactionDetailsContent: React.FC<{
  transactionDetails: TransactionDetails;
}> = ({ transactionDetails }) => {
  const { themeColors } = useColors();
  const tokenAmount = formatTokenAmount(
    new BigNumber(
      transactionDetails.contractDetails?.transferDetails?.amount ?? "",
    ),
    transactionDetails.contractDetails?.contractDecimals ?? 0,
  );

  const contractSymbol =
    transactionDetails.contractDetails?.contractSymbol ?? "";
  const isNative = contractSymbol === NATIVE_TOKEN_CODE;

  return (
    <TransactionDetailsContent>
      <View className="flex-row justify-between items-center">
        <View>
          <Text xl primary medium numberOfLines={1}>
            {formatAssetAmount(tokenAmount, contractSymbol)}
          </Text>
        </View>
        <AssetIcon
          token={
            isNative
              ? {
                  type: AssetTypeWithCustomToken.NATIVE,
                  code: NATIVE_TOKEN_CODE,
                }
              : {
                  type: AssetTypeWithCustomToken.CUSTOM_TOKEN,
                  code: contractSymbol,
                  issuer: {
                    key: "",
                  },
                }
          }
          size="lg"
        />
      </View>

      <Icon.ChevronDownDouble
        size={20}
        color={themeColors.foreground.primary}
        circle
        circleBackground={themeColors.background.tertiary}
      />

      <View className="flex-row justify-between items-center">
        <Text xl primary medium numberOfLines={1}>
          {truncateAddress(
            transactionDetails.contractDetails?.transferDetails?.to as string,
          )}
        </Text>
        <Avatar
          publicAddress={
            transactionDetails.contractDetails?.transferDetails?.to ?? ""
          }
          hasBorder
          size={AvatarSizes.LARGE}
        />
      </View>
    </TransactionDetailsContent>
  );
};
