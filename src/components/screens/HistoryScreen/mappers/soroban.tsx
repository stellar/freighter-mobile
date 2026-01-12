/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import BigNumber from "bignumber.js";
import { CollectibleImage } from "components/CollectibleImage";
import { TokenIcon } from "components/TokenIcon";
import TransactionDetailsContent from "components/screens/HistoryScreen/TransactionDetailsContent";
import { createOperationString } from "components/screens/HistoryScreen/helpers";
import {
  TransactionDetails,
  TransactionType,
  TransactionStatus,
  HistoryItemData,
  AssetDiffSummary,
} from "components/screens/HistoryScreen/types";
import Avatar, { AvatarSizes } from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE, NetworkDetails, NETWORKS } from "config/constants";
import {
  TokenTypeWithCustomToken,
  BalanceMap,
  CustomToken,
} from "config/types";
import { isSacContract } from "helpers/balances";
import { transformBackendCollections } from "helpers/collectibles";
import { formatTokenForDisplay } from "helpers/formatAmount";
import {
  SorobanTokenInterface,
  getBalanceByKey,
  formatTokenForDisplay as formatSorobanTokenAmount,
} from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import useColors, { ThemeColors } from "hooks/useColors";
import { t } from "i18next";
import { capitalize } from "lodash";
import React from "react";
import { View } from "react-native";
import { fetchCollectibles, getTokenDetails } from "services/backend";

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
  xdr: string;
  assetDiffs?: AssetDiffSummary[];
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
  xdr: string;
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
  xdr: string;
}

interface ProcessCollectibleTransferData {
  operation: any;
  sorobanAttributes: Record<string, string>;
  publicKey: string;
  network: NETWORKS;
  stellarExpertUrl: string;
  fee: string;
  themeColors: ThemeColors;
  baseHistoryItemData: Partial<HistoryItemData>;
  operationString: string;
  xdr: string;
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
  xdr,
  themeColors,
  baseHistoryItemData,
}: ProcessSorobanMintData): Promise<HistoryItemData> => {
  const { id } = operation;
  const isReceiving = sorobanAttributes.to === publicKey;

  const tokenBalance = getBalanceByKey(
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
  if (!tokenBalance) {
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
          xdr,
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

        const amountString = String(sorobanAttributes.amount);
        const formattedTokenAmount = formatSorobanTokenAmount(
          new BigNumber(amountString),
          token.decimals,
        );

        const formattedAmount = `${isReceiving ? "+" : ""}${formatTokenForDisplay(
          formattedTokenAmount,
          code,
        )}`;

        historyItemData.amountText = formattedAmount;
        historyItemData.IconComponent = isNative ? (
          <TokenIcon
            token={{
              type: TokenTypeWithCustomToken.NATIVE,
              code: NATIVE_TOKEN_CODE,
            }}
            size="lg"
          />
        ) : (
          <TokenIcon
            token={{
              type: TokenTypeWithCustomToken.CUSTOM_TOKEN,
              code: token.symbol,
              issuer: {
                key: sorobanAttributes.contractId,
              },
            }}
            size="lg"
          />
        );

        // Check if it's a SAC and show appropriate text
        let displayName;
        let tokenIconDetails;

        if (isNative) {
          displayName = NATIVE_TOKEN_CODE;
          tokenIconDetails = {
            code: NATIVE_TOKEN_CODE,
            issuer: { key: "" },
            type: TokenTypeWithCustomToken.NATIVE,
          };
        } else if (token.name && isSacContract(token.name)) {
          displayName = token.symbol; // Show only symbol for SACs
          tokenIconDetails = {
            code: token.symbol,
            issuer: { key: token.name.split(":")[1] },
            // No type for SACs (classic token)
            type: undefined,
          };
        } else {
          displayName = token.name ?? token.symbol; // Show name for Custom Tokens
          tokenIconDetails = {
            type: TokenTypeWithCustomToken.CUSTOM_TOKEN,
            code: token.symbol,
            issuer: {
              key: sorobanAttributes.contractId,
            },
          };
        }

        historyItemData.rowText = displayName;
        historyItemData.IconComponent = (
          <TokenIcon token={tokenIconDetails} size="lg" />
        );

        const transactionDetails: TransactionDetails = {
          operation,
          transactionTitle,
          transactionType: TransactionType.CONTRACT,
          status: TransactionStatus.SUCCESS,
          fee,
          xdr,
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
        xdr,
        IconComponent: historyItemData.IconComponent,
        ActionIconComponent: historyItemData.ActionIconComponent,
        externalUrl: `${stellarExpertUrl}/op/${id}`,
      };

      historyItemData.transactionDetails = transactionDetails;
    }
  } else {
    // User already has this token in their balances
    const { decimals, symbol } = tokenBalance as CustomToken;
    const isNative = symbol === "native";
    const code = isNative ? NATIVE_TOKEN_CODE : symbol;

    const amountString = String(sorobanAttributes.amount);

    const formattedTokenAmount = formatSorobanTokenAmount(
      new BigNumber(amountString),
      decimals,
    );

    const formattedAmount = `${isReceiving ? "+" : ""}${formatTokenForDisplay(
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
      xdr,
      IconComponent: historyItemData.IconComponent,
      ActionIconComponent: historyItemData.ActionIconComponent,
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
  xdr,
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
        xdr,
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
    const amountString = String(sorobanAttributes.amount);

    const formattedTokenAmount = formatSorobanTokenAmount(
      new BigNumber(amountString),
      Number(decimals),
    );

    const isRecipient =
      sorobanAttributes.to === publicKey &&
      sorobanAttributes.from !== publicKey;

    const paymentDifference = isRecipient ? "+" : "-";
    const formattedAmount = `${paymentDifference}${formatTokenForDisplay(
      formattedTokenAmount,
      code,
    )}`;

    let displayName = code;
    let tokenIconDetails;
    if (isNative) {
      displayName = NATIVE_TOKEN_CODE;
      tokenIconDetails = {
        code: NATIVE_TOKEN_CODE,
        issuer: { key: "" },
        type: TokenTypeWithCustomToken.NATIVE,
      };
    } else if (name && isSacContract(name)) {
      displayName = code;
      tokenIconDetails = {
        code,
        issuer: { key: name.split(":")[1] },
        type: undefined,
      };
    } else {
      displayName = name ?? code;
      tokenIconDetails = {
        type: TokenTypeWithCustomToken.CUSTOM_TOKEN,
        code,
        issuer: { key: sorobanAttributes.contractId },
      };
    }

    historyItemData.amountText = formattedAmount;
    historyItemData.IconComponent = (
      <TokenIcon token={tokenIconDetails} size="lg" />
    );
    historyItemData.ActionIconComponent = isRecipient ? (
      <Icon.ArrowCircleDown size={16} color={themeColors.foreground.primary} />
    ) : (
      <Icon.ArrowCircleUp size={16} color={themeColors.foreground.primary} />
    );
    historyItemData.isAddingFunds = isRecipient;
    historyItemData.rowText = displayName;
    historyItemData.actionText = isRecipient
      ? t("history.transactionHistory.received")
      : t("history.transactionHistory.sent");

    const transactionDetails: TransactionDetails = {
      operation,
      transactionTitle: `${isRecipient ? t("history.transactionHistory.received") : t("history.transactionHistory.sent")} ${code}`,
      transactionType: TransactionType.CONTRACT_TRANSFER,
      status: TransactionStatus.SUCCESS,
      fee,
      xdr,
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
      xdr,
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
 * Process Collectible transfer operations
 */
const processCollectibleTransfer = async ({
  operation,
  sorobanAttributes,
  publicKey,
  stellarExpertUrl,
  fee,
  xdr,
  themeColors,
  baseHistoryItemData,
  operationString,
}: ProcessCollectibleTransferData): Promise<HistoryItemData> => {
  const { id } = operation;
  const historyItemData: Partial<HistoryItemData> = { ...baseHistoryItemData };
  const tokenId = sorobanAttributes.tokenId.toString();

  const defaultCollectibleTransferDetails: TransactionDetails = {
    operation,
    transactionTitle: t("history.transactionHistory.contract"),
    transactionType: TransactionType.CONTRACT_TRANSFER,
    status: TransactionStatus.SUCCESS,
    fee,
    xdr,
    IconComponent: historyItemData.IconComponent,
    ActionIconComponent: historyItemData.ActionIconComponent,
    externalUrl: `${stellarExpertUrl}/op/${id}`,
    contractDetails: {
      contractAddress: sorobanAttributes.contractId,
      sorobanTokenInterface: SorobanTokenInterface.transfer,
      collectibleTransferDetails: {
        from: sorobanAttributes.from,
        to: sorobanAttributes.to,
        tokenId: sorobanAttributes.tokenId,
        collectibleName: t(
          "history.transactionHistory.collectibleTransfer.unknownCollectible",
        ),
        collectionName: t(
          "history.transactionHistory.collectibleTransfer.unknownCollection",
          {
            contractId: truncateAddress(sorobanAttributes.contractId),
          },
        ),
      },
    },
  };

  try {
    const collections = await fetchCollectibles({
      owner: publicKey,
      contracts: [
        {
          id: sorobanAttributes.contractId,
          token_ids: [tokenId],
        },
      ],
    });
    const backendCollections = collections.filter(
      (collection) => "collection" in collection,
    );

    if (!backendCollections.length) {
      historyItemData.rowText = operationString;
      historyItemData.transactionDetails = defaultCollectibleTransferDetails;
      return historyItemData as HistoryItemData;
    }

    const transformedCollections =
      await transformBackendCollections(backendCollections);

    const collectionDetails = transformedCollections.find(
      (collection) =>
        collection.collectionAddress === sorobanAttributes.contractId,
    );

    if (!collectionDetails) {
      throw new Error("Collection not found");
    }

    const transferedCollectible = collectionDetails.items.find(
      (collectible) => collectible.tokenId === tokenId,
    );

    if (!transferedCollectible) {
      throw new Error("Collectible not found");
    }

    historyItemData.IconComponent = (
      <View className="w-[40px] h-[40px] rounded-[8px] bg-background-tertiary overflow-hidden">
        <CollectibleImage
          imageUri={transferedCollectible.image}
          placeholderIconSize={25}
        />
      </View>
    );
    historyItemData.ActionIconComponent = (
      <Icon.ArrowCircleUp size={16} color={themeColors.foreground.primary} />
    );
    historyItemData.rowText = transferedCollectible.name;
    historyItemData.actionText = t("history.transactionHistory.sent");

    const transactionDetails: TransactionDetails = {
      operation,
      transactionTitle: t("transactionDetailsBottomSheet.sentCollectible"),
      transactionType: TransactionType.CONTRACT_TRANSFER,
      status: TransactionStatus.SUCCESS,
      fee,
      xdr,
      IconComponent: historyItemData.IconComponent,
      ActionIconComponent: historyItemData.ActionIconComponent,
      externalUrl: `${stellarExpertUrl}/op/${id}`,
      contractDetails: {
        contractAddress: sorobanAttributes.contractId,
        sorobanTokenInterface: SorobanTokenInterface.transfer,
        collectibleTransferDetails: {
          from: sorobanAttributes.from,
          to: sorobanAttributes.to,
          tokenId: sorobanAttributes.tokenId,
          collectibleName:
            transferedCollectible.name ||
            t(
              "history.transactionHistory.collectibleTransfer.unknownCollectible",
            ),
          collectionName: transferedCollectible.collectionName,
        },
      },
    };

    historyItemData.transactionDetails = transactionDetails;
  } catch (error) {
    historyItemData.rowText = operationString;
    historyItemData.transactionDetails = defaultCollectibleTransferDetails;
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
  xdr,
  assetDiffs = [],
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
    // Use asset diffs for amount display if present
    let amountText: string | null = null;
    let isAddingFunds: boolean | null = null;

    if (assetDiffs && assetDiffs.length === 1) {
      const diff = assetDiffs[0];
      const prefix = diff.isCredit ? "+" : "-";
      amountText = `${prefix}${formatTokenForDisplay(diff.amount, diff.assetCode)}`;
      isAddingFunds = diff.isCredit;
    } else if (assetDiffs && assetDiffs.length > 1) {
      amountText = t("history.transactionHistory.multiple");
      isAddingFunds = null; // Remove color styling for "Multiple"
    }

    const transactionDetails: TransactionDetails = {
      operation,
      transactionTitle: t("history.transactionHistory.interacted"),
      transactionType: TransactionType.CONTRACT,
      status: TransactionStatus.SUCCESS,
      fee,
      xdr,
      IconComponent: baseHistoryItemData.IconComponent,
      ActionIconComponent: baseHistoryItemData.ActionIconComponent,
      externalUrl: `${stellarExpertUrl}/op/${id}`,
      assetDiffs,
    };

    return {
      ...baseHistoryItemData,
      amountText,
      isAddingFunds,
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
      xdr,
      themeColors,
      baseHistoryItemData,
    });
  }

  // Handle token transfer operation
  if (sorobanAttributes.fnName === SorobanTokenInterface.transfer) {
    if (sorobanAttributes.amount) {
      return processSorobanTransfer({
        operation,
        sorobanAttributes,
        publicKey,
        network,
        stellarExpertUrl,
        fee,
        xdr,
        themeColors,
        baseHistoryItemData,
        operationString,
      });
    }
    return processCollectibleTransfer({
      operation,
      sorobanAttributes,
      publicKey,
      network,
      stellarExpertUrl,
      fee,
      xdr,
      themeColors,
      baseHistoryItemData,
      operationString,
    });
  }

  // Default case for other Soroban operations
  // Use asset diffs for amount display if present
  let amountText: string | null = null;
  let isAddingFunds: boolean | null = null;

  if (assetDiffs && assetDiffs.length === 1) {
    const diff = assetDiffs[0];
    const prefix = diff.isCredit ? "+" : "-";
    amountText = `${prefix}${formatTokenForDisplay(diff.amount, diff.assetCode)}`;
    isAddingFunds = diff.isCredit;
  } else if (assetDiffs && assetDiffs.length > 1) {
    amountText = t("history.transactionHistory.multiple");
    isAddingFunds = null; // Remove color styling for "Multiple"
  }

  const transactionDetails: TransactionDetails = {
    operation,
    transactionTitle: t("history.transactionHistory.contract"),
    transactionType: TransactionType.CONTRACT,
    status: TransactionStatus.SUCCESS,
    fee,
    xdr,
    IconComponent: baseHistoryItemData.IconComponent,
    ActionIconComponent: baseHistoryItemData.ActionIconComponent,
    externalUrl: `${stellarExpertUrl}/op/${id}`,
    assetDiffs,
  };

  return {
    ...baseHistoryItemData,
    rowText: operationString,
    amountText,
    isAddingFunds,
    transactionDetails,
  } as HistoryItemData;
};

/**
 * Renders Soroban token transfer transaction details
 */
export const SorobanTokenTransferTransactionDetailsContent: React.FC<{
  transactionDetails: TransactionDetails;
}> = ({ transactionDetails }) => {
  const { themeColors } = useColors();
  const rawAmount: string | number | bigint = transactionDetails
    .contractDetails!.transferDetails!.amount as string | number | bigint;
  const amountString = String(rawAmount);

  const contractDecimals =
    transactionDetails.contractDetails!.contractDecimals!;
  const tokenAmount = formatSorobanTokenAmount(
    new BigNumber(amountString),
    contractDecimals,
  );

  const contractSymbol =
    transactionDetails.contractDetails?.contractSymbol ?? "";
  const toAddress =
    transactionDetails.contractDetails?.transferDetails?.to ?? "";

  return (
    <TransactionDetailsContent>
      <View className="flex-row items-center">
        {transactionDetails.IconComponent}
        <View className="ml-[16px]">
          <Text xl primary medium numberOfLines={1}>
            {formatTokenForDisplay(tokenAmount, contractSymbol)}
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
        <Avatar
          publicAddress={toAddress}
          hasDarkBackground
          size={AvatarSizes.LARGE}
        />
        <View className="ml-[16px]">
          <Text xl primary medium numberOfLines={1}>
            {truncateAddress(toAddress)}
          </Text>
        </View>
      </View>
    </TransactionDetailsContent>
  );
};

/**
 * Renders Soroban collectible transfer transaction details
 */
export const SorobanCollectibleTransferTransactionDetailsContent: React.FC<{
  transactionDetails: TransactionDetails;
}> = ({ transactionDetails }) => {
  const { themeColors } = useColors();
  const collectibleTransferDetails =
    transactionDetails.contractDetails!.collectibleTransferDetails!;
  const toAddress = collectibleTransferDetails.to;

  return (
    <TransactionDetailsContent>
      <View className="flex-row items-center">
        {transactionDetails.IconComponent}
        <View className="ml-[16px]">
          <View className="flex-1">
            <Text xl medium>
              {collectibleTransferDetails.collectibleName}
            </Text>
            <Text md medium secondary>
              {`${collectibleTransferDetails.collectionName} #${collectibleTransferDetails.tokenId}`}
            </Text>
          </View>
        </View>
      </View>

      <View className="w-[40px] flex items-center py-1">
        <Icon.ChevronDownDouble
          size={20}
          color={themeColors.foreground.primary}
        />
      </View>

      <View className="flex-row items-center">
        <Avatar
          publicAddress={toAddress}
          hasDarkBackground
          size={AvatarSizes.LARGE}
        />
        <View className="ml-[16px]">
          <Text xl primary medium numberOfLines={1}>
            {truncateAddress(toAddress)}
          </Text>
        </View>
      </View>
    </TransactionDetailsContent>
  );
};
