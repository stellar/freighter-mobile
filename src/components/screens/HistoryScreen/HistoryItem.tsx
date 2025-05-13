/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Horizon } from "@stellar/stellar-sdk";
import { logos } from "assets/logos";
import BigNumber from "bignumber.js";
import { AssetIcon } from "components/AssetIcon";
import Spinner from "components/Spinner";
import {
  TransactionDetails,
  TransactionStatus,
  TransactionType,
} from "components/screens/HistoryScreen";
import {
  renderIconComponent,
  renderActionIcon,
} from "components/screens/HistoryScreen/helpers";
import { Asset } from "components/sds/Asset";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NetworkDetails, NETWORKS, OPERATION_TYPES } from "config/constants";
import {
  AssetTypeWithCustomToken,
  BalanceMap,
  CustomToken,
} from "config/types";
import { formatAssetAmount } from "helpers/formatAmount";
import { getIconUrlFromIssuer } from "helpers/getIconUrlFromIssuer";
import {
  formatTokenAmount,
  getAttrsFromSorobanHorizonOp,
  getBalanceByKey,
  SorobanTokenInterface,
} from "helpers/soroban";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useColors, { ThemeColors } from "hooks/useColors";
import { t } from "i18next";
import { camelCase, capitalize } from "lodash";
import React, { useEffect, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { getTokenDetails } from "services/backend";

interface HistoryItemProps {
  accountBalances: BalanceMap;
  operation: any;
  publicKey: string;
  networkDetails: NetworkDetails;
  handleTransactionDetails: (transactionDetail: TransactionDetails) => void;
}

// This is the data that is used to render the history item.
interface HistoryItemData {
  // The details of the transaction. Shown in the transaction details bottom sheet.
  transactionDetails: TransactionDetails;
  // The text to display in the history item. e.g. "ContractFunction"
  rowText: string;
  // The text to display in the history item, below the row text. e.g. "Interacted"
  actionText: string | null;
  // Action Icon to display in the history item. Displayed on the left side of the action text.
  ActionIconComponent: React.ReactElement | null;
  // The date of the transaction. e.g. "May 12"
  dateText: string | null;
  // The amount of the transaction. e.g. "100 XLM"
  amountText: string | null;
  // The icon to display in the history item.
  IconComponent: React.ReactElement | null;
  // The status of the transaction.
  transactionStatus: TransactionStatus;
  // Whether the transaction adds funds to the account.
  isAddingFunds: boolean | null;
}

// Function to map the transaction data to the history item data.
const mapHistoryItemData = async (
  operation: any,
  accountBalances: BalanceMap,
  publicKey: string,
  networkDetails: NetworkDetails,
  network: NETWORKS,
  themeColors: ThemeColors,
): Promise<HistoryItemData> => {
  const {
    account,
    amount,
    asset_code: assetCode,
    asset_type: assetType,
    asset_issuer: assetIssuer,
    created_at: createdAt,
    id,
    to,
    from,
    starting_balance: startingBalance,
    type,
    type_i: typeI,
    transaction_attr: { operation_count: operationCount, fee_charged: fee },
    isCreateExternalAccount = false,
    isPayment = false,
    isSwap = false,
    transaction_successful: transactionSuccessful,
  } = operation;
  let sourceAssetCode: string | undefined;
  let sourceAssetIssuer: string | undefined;

  if ("source_asset_code" in operation) {
    sourceAssetCode = operation.source_asset_code || "";
  }

  if ("source_asset_issuer" in operation) {
    sourceAssetIssuer = operation.source_asset_issuer || "";
  }

  const operationType = camelCase(type) as keyof typeof OPERATION_TYPES;
  const opTypeStr =
    OPERATION_TYPES[operationType] || t("transactionHistory.transaction");
  const operationString = `${opTypeStr}${
    operationCount > 1 ? ` + ${operationCount - 1} ops` : ""
  }`;
  const date = new Date(Date.parse(createdAt))
    .toDateString()
    .split(" ")
    .slice(1, 3)
    .join(" ");
  const srcAssetCode = sourceAssetCode || "XLM";
  const destAssetCode = assetCode || "XLM";
  const isInvokeHostFn = typeI === 24;

  const stellarExpertUrl = getStellarExpertUrl(network);

  // This is a base object that should be returned if the operation is not mapped to a history item.
  const transactionDetailsBase: TransactionDetails = {
    operation,
    fee,
    transactionTitle: capitalize(type).replaceAll("_", " "),
    transactionType: TransactionType.UNKNOWN,
    status: TransactionStatus.SUCCESS,
    IconComponent: null,
    ActionIconComponent: null,
    externalUrl: `${stellarExpertUrl}/op/${id}`,
  };

  // This is a base object that should be returned if the operation is not mapped to a history item.
  const defaultHistoryItemData: HistoryItemData = {
    transactionDetails: transactionDetailsBase,
    dateText: date,
    rowText: capitalize(type).replaceAll("_", " "),
    amountText: amount,
    IconComponent: null,
    actionText: t("history.transactionHistory.transaction"),
    ActionIconComponent: (
      <Icon.Wallet03 size={16} color={themeColors.foreground.primary} />
    ),
    transactionStatus: TransactionStatus.SUCCESS,
    isAddingFunds: null,
  };

  // Transaction failed
  if (transactionSuccessful === false) {
    const IconComponent = (
      <Icon.Wallet03 size={26} circle color={themeColors.foreground.primary} />
    );
    const ActionIconComponent = (
      <Icon.XCircle size={16} color={themeColors.status.error} />
    );

    const transactionDetails: TransactionDetails = {
      ...transactionDetailsBase,
      transactionTitle: t("history.transactionHistory.transactionFailed"),
      transactionType: TransactionType.UNKNOWN,
      status: TransactionStatus.FAILED,
      IconComponent,
      ActionIconComponent,
    };
    const historyItemData: Partial<HistoryItemData> = {
      rowText: t("history.transactionHistory.transactionFailed"),
      actionText: t("history.transactionHistory.failed"),
      dateText: date,
      amountText: null,
      transactionDetails,
      transactionStatus: TransactionStatus.FAILED,
      isAddingFunds: null,
      IconComponent,
      ActionIconComponent,
    };

    return historyItemData as HistoryItemData;
  }

  // Create Account
  if (type === Horizon.HorizonApi.OperationResponseType.createAccount) {
    const isRecipient = !isCreateExternalAccount;
    const paymentDifference = isRecipient ? "+" : "-";
    const formattedAmount = `${paymentDifference}${formatAssetAmount(
      startingBalance,
      destAssetCode,
    )}`;

    const historyItemData: Partial<HistoryItemData> = {
      rowText: t("history.transactionHistory.createAccount"),
      dateText: date,
      amountText: formattedAmount,
      actionText: isRecipient
        ? t("history.transactionHistory.received")
        : t("history.transactionHistory.sent"),
      ActionIconComponent: isRecipient ? (
        <Icon.PlusCircle size={16} color={themeColors.foreground.primary} />
      ) : (
        <Icon.ArrowCircleUp size={16} color={themeColors.foreground.primary} />
      ),
      isAddingFunds: isRecipient,
    };

    historyItemData.transactionDetails = {
      ...transactionDetailsBase,
      transactionTitle: t("history.transactionHistory.createAccount"),
      transactionType: TransactionType.CREATE_ACCOUNT,
      fee,
      status: TransactionStatus.SUCCESS,
      IconComponent: historyItemData.IconComponent,
      ActionIconComponent: historyItemData.ActionIconComponent,
      createAccountDetails: {
        isCreatingExternalAccount: isCreateExternalAccount,
        accountPublicKey: account,
        startingBalance,
      },
    };

    return historyItemData as HistoryItemData;
  }

  // Change Trust
  if (type === Horizon.HorizonApi.OperationResponseType.changeTrust) {
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

    const historyItemData: Partial<HistoryItemData> = {
      rowText: destAssetCode,
      actionText,
      dateText: date,
      IconComponent,
      ActionIconComponent,
      amountText: null,
    };

    const transactionDetails: TransactionDetails = {
      ...transactionDetailsBase,
      transactionTitle: actionText,
      transactionType: TransactionType.CHANGE_TRUST,
      status: TransactionStatus.SUCCESS,
      IconComponent,
      ActionIconComponent,
      fee,
    };

    historyItemData.transactionDetails = transactionDetails;

    return historyItemData as HistoryItemData;
  }

  // Swap
  if (isSwap) {
    const formattedAmount = `+${formatAssetAmount(amount, destAssetCode)}`;

    const destIcon =
      destAssetCode === "XLM"
        ? logos.stellar
        : await getIconUrlFromIssuer({
            issuerKey: assetIssuer || "",
            assetCode: destAssetCode || "",
            networkUrl: networkDetails.networkUrl,
          });
    const sourceIcon =
      srcAssetCode === "XLM"
        ? logos.stellar
        : await getIconUrlFromIssuer({
            issuerKey: sourceAssetIssuer || "",
            assetCode: srcAssetCode || "",
            networkUrl: networkDetails.networkUrl,
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
                  {destAssetCode.substring(0, 2)}
                </Text>
              )
            : undefined,
        }}
      />
    );

    const historyItemData: Partial<HistoryItemData> = {
      rowText: t("history.transactionHistory.swapTwoAssets", {
        srcAssetCode,
        destAssetCode,
      }),
      actionText: t("history.transactionHistory.swapped"),
      dateText: date,
      amountText: formattedAmount,
      isAddingFunds: true,
      ActionIconComponent,
      IconComponent,
    };

    const transactionDetails: TransactionDetails = {
      ...transactionDetailsBase,
      transactionTitle: t("history.transactionHistory.swappedTwoAssets", {
        srcAssetCode,
        destAssetCode,
      }),
      transactionType: TransactionType.SWAP,
      status: TransactionStatus.SUCCESS,
      IconComponent,
      ActionIconComponent,
      swapDetails: {
        sourceAssetIssuer: operation.source_asset_issuer || "",
        destinationAssetIssuer: operation.asset_issuer || "",
        sourceAssetCode: srcAssetCode || "",
        destinationAssetCode: destAssetCode || "",
        sourceAmount: operation.source_amount || "",
        destinationAmount: operation.amount || "",
        sourceAssetType: operation.source_asset_type || "",
        destinationAssetType: operation.asset_type || "",
      },
      fee,
    };

    historyItemData.transactionDetails = transactionDetails;

    return historyItemData as HistoryItemData;
  }

  // Payment
  if (isPayment) {
    const isRecipient = to === publicKey && from !== publicKey;
    const paymentDifference = isRecipient ? "+" : "-";
    const formattedAmount = `${paymentDifference}${formatAssetAmount(
      new BigNumber(amount).toString(),
      destAssetCode,
    )}`;
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
    const ActionIconComponent = isRecipient ? (
      <Icon.ArrowCircleDown size={16} color={themeColors.foreground.primary} />
    ) : (
      <Icon.ArrowCircleUp size={16} color={themeColors.foreground.primary} />
    );

    const historyItemData: Partial<HistoryItemData> = {
      rowText: destAssetCode,
      actionText: isRecipient
        ? t("history.transactionHistory.received")
        : t("history.transactionHistory.sent"),
      dateText: date,
      amountText: formattedAmount,
      IconComponent,
      isAddingFunds: isRecipient,
      ActionIconComponent,
    };

    const transactionDetails: TransactionDetails = {
      ...transactionDetailsBase,
      transactionTitle: `${isRecipient ? t("history.transactionHistory.received") : t("history.transactionHistory.sent")} ${destAssetCode}`,
      transactionType: TransactionType.PAYMENT,
      status: TransactionStatus.SUCCESS,
      fee,
      IconComponent,
      ActionIconComponent,
      paymentDetails: {
        assetCode: destAssetCode,
        assetIssuer: assetIssuer || "",
        assetType,
        amount,
        from,
        to,
      },
    };

    historyItemData.transactionDetails = transactionDetails;

    return historyItemData as HistoryItemData;
  }

  // Invoke Host Function (Soroban)
  if (isInvokeHostFn) {
    // Get Soroban operation attributes if available
    const sorobanAttributes = getAttrsFromSorobanHorizonOp(
      operation,
      networkDetails,
    );

    if (!sorobanAttributes) {
      const historyItemData: Partial<HistoryItemData> = {
        ...defaultHistoryItemData,
        rowText: t("history.transactionHistory.contract"),
        actionText: t("history.transactionHistory.interacted"),
        ActionIconComponent: (
          <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
        ),
        isAddingFunds: null,
        IconComponent: (
          <Icon.FileCode02
            size={26}
            color={themeColors.foreground.primary}
            circle
          />
        ),
        dateText: date,
        amountText: null,
      };

      historyItemData.transactionDetails = {
        ...transactionDetailsBase,
        transactionTitle: t("history.transactionHistory.interacted"),
        transactionType: TransactionType.CONTRACT,
        status: TransactionStatus.SUCCESS,
        fee,
        IconComponent: historyItemData.IconComponent,
        ActionIconComponent: historyItemData.ActionIconComponent,
      };

      return historyItemData as HistoryItemData;
    }

    // Handle Soroban token operations
    if (sorobanAttributes.fnName === SorobanTokenInterface.mint) {
      const assetBalance = getBalanceByKey(
        sorobanAttributes.contractId,
        Object.values(accountBalances),
        networkDetails,
      );
      const isReceiving = sorobanAttributes.to === publicKey;
      const IconComponent = isReceiving ? (
        <Icon.ArrowDown
          size={26}
          circle
          color={themeColors.foreground.primary}
        />
      ) : (
        <Icon.ArrowUp size={26} circle color={themeColors.foreground.primary} />
      );
      const ActionIconComponent = (
        <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
      );

      const historyItemData: Partial<HistoryItemData> = {
        rowText: t("history.transactionHistory.contract"),
        actionText: t("history.transactionHistory.minted"),
        dateText: date,
        amountText: null,
        IconComponent,
        ActionIconComponent,
        isAddingFunds: isReceiving,
      };

      // Minter does not need to have tokens to mint, and
      // they are not neccessarily minted to themselves.
      // If user has minted to self, add token to their token list.
      if (!assetBalance) {
        try {
          const tokenDetailsResponse = await getTokenDetails({
            contractId: sorobanAttributes.contractId,
            publicKey,
            network,
          });

          if (!tokenDetailsResponse) {
            historyItemData.rowText = operationString;
            historyItemData.transactionDetails = {
              ...transactionDetailsBase,
              transactionTitle: t("history.transactionHistory.contract"),
              transactionType: TransactionType.CONTRACT,
              status: TransactionStatus.SUCCESS,
              fee,
              IconComponent: historyItemData.IconComponent,
              ActionIconComponent: historyItemData.ActionIconComponent,
            };
          } else {
            const token = {
              contractId: sorobanAttributes.contractId,
              decimals: tokenDetailsResponse.decimals,
              name: tokenDetailsResponse.name,
              symbol: tokenDetailsResponse.symbol,
            };
            const transactionTitle = isReceiving
              ? t("history.transactionHistory.mintedToSelf", {
                  tokenSymbol: token.symbol,
                })
              : `${t("history.transactionHistory.minted")} ${token.symbol}`;

            const formattedTokenAmount = formatTokenAmount(
              new BigNumber(sorobanAttributes.amount),
              token.decimals,
            );

            const formattedAmount = `${isReceiving ? "+" : ""}${formattedTokenAmount} ${token.symbol}`;
            historyItemData.amountText = formattedAmount;
            historyItemData.IconComponent = (
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
            historyItemData.rowText = token.name ?? token.symbol;
            historyItemData.transactionDetails = {
              ...transactionDetailsBase,
              transactionTitle,
              transactionType: TransactionType.CONTRACT,
              status: TransactionStatus.SUCCESS,
              fee,
              IconComponent: historyItemData.IconComponent,
              ActionIconComponent: historyItemData.ActionIconComponent,
              contractDetails: {
                contractAddress: sorobanAttributes.contractId,
                contractName: token.name,
                contractSymbol: token.symbol,
                contractDecimals: token.decimals,
                sorobanTokenInterface: SorobanTokenInterface.mint,
              },
            };
          }
        } catch (error) {
          historyItemData.rowText = capitalize(sorobanAttributes.fnName);
          historyItemData.actionText = t("history.transactionHistory.minted");
          historyItemData.transactionDetails = {
            ...transactionDetailsBase,
            transactionTitle: t("history.transactionHistory.contract"),
            transactionType: TransactionType.CONTRACT,
            status: TransactionStatus.SUCCESS,
            fee,
            IconComponent: historyItemData.IconComponent,
            ActionIconComponent: historyItemData.ActionIconComponent,
          };
        }
      } else {
        const { decimals, symbol } = assetBalance as CustomToken;
        const formattedTokenAmount = formatTokenAmount(
          new BigNumber(sorobanAttributes.amount),
          Number(decimals),
        );
        const formattedAmount = `${isReceiving ? "+" : ""}${formattedTokenAmount} ${symbol}`;
        historyItemData.amountText = formattedAmount;
        historyItemData.dateText = date;
        historyItemData.rowText = capitalize(sorobanAttributes.fnName);
        historyItemData.transactionDetails = {
          ...transactionDetailsBase,
          transactionTitle: t("history.transactionHistory.minted"),
          transactionType: TransactionType.CONTRACT,
          status: TransactionStatus.SUCCESS,
          fee,
          IconComponent,
          ActionIconComponent,
          contractDetails: {
            contractAddress: sorobanAttributes.contractId,
            contractSymbol: symbol,
            contractDecimals: decimals,
            sorobanTokenInterface: SorobanTokenInterface.mint,
          },
        };
      }

      return historyItemData as HistoryItemData;
    }

    const historyItemData: Partial<HistoryItemData> = {
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
    };

    if (sorobanAttributes.fnName === SorobanTokenInterface.transfer) {
      try {
        const tokenDetailsResponse = await getTokenDetails({
          contractId: sorobanAttributes.contractId,
          publicKey,
          network,
        });

        if (!tokenDetailsResponse) {
          historyItemData.rowText = operationString;
          historyItemData.transactionDetails = {
            ...transactionDetailsBase,
            transactionTitle: t("history.transactionHistory.contract"),
            transactionType: TransactionType.CONTRACT_TRANSFER,
            status: TransactionStatus.SUCCESS,
            fee,
            IconComponent: historyItemData.IconComponent,
            ActionIconComponent: historyItemData.ActionIconComponent,
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
        }

        const { symbol, decimals, name } = tokenDetailsResponse!;
        const isNative = symbol === "native";
        const code = isNative ? "XLM" : symbol;
        const formattedTokenAmount = formatTokenAmount(
          new BigNumber(sorobanAttributes.amount),
          decimals,
        );
        const isRecipient =
          sorobanAttributes.to === publicKey &&
          sorobanAttributes.from !== publicKey;
        const paymentDifference = isRecipient ? "+" : "-";
        const formattedAmount = `${paymentDifference}${formattedTokenAmount} ${code}`;
        historyItemData.amountText = formattedAmount;
        historyItemData.IconComponent = isNative ? (
          <AssetIcon
            token={{
              code: "XLM",
              issuer: {
                key: "",
              },
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
          <Icon.ArrowCircleDown
            size={16}
            color={themeColors.foreground.primary}
          />
        ) : (
          <Icon.ArrowCircleUp
            size={16}
            color={themeColors.foreground.primary}
          />
        );
        historyItemData.isAddingFunds = isRecipient;
        historyItemData.rowText = isNative ? "XLM" : (name ?? symbol);
        historyItemData.dateText = date;
        historyItemData.actionText = isRecipient
          ? t("history.transactionHistory.received")
          : t("history.transactionHistory.sent");
        historyItemData.transactionDetails = {
          ...transactionDetailsBase,
          transactionTitle: `${isRecipient ? t("Received") : t("Sent")} ${code}`,
          transactionType: TransactionType.CONTRACT_TRANSFER,
          status: TransactionStatus.SUCCESS,
          fee,
          IconComponent: historyItemData.IconComponent,
          ActionIconComponent: historyItemData.ActionIconComponent,
          contractDetails: {
            contractAddress: sorobanAttributes.contractId,
            contractSymbol: symbol,
            contractDecimals: decimals,
            sorobanTokenInterface: SorobanTokenInterface.transfer,
            transferDetails: {
              from: sorobanAttributes.from,
              to: sorobanAttributes.to,
              amount: sorobanAttributes.amount,
            },
          },
        };
      } catch (error) {
        historyItemData.rowText = operationString;
        historyItemData.transactionDetails = {
          ...transactionDetailsBase,
          transactionTitle: t("Transaction"),
          transactionType: TransactionType.CONTRACT_TRANSFER,
          status: TransactionStatus.SUCCESS,
          fee,
          IconComponent: historyItemData.IconComponent,
          ActionIconComponent: historyItemData.ActionIconComponent,
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
      }
    } else {
      historyItemData.rowText = operationString;
      historyItemData.transactionDetails = {
        ...transactionDetailsBase,
        transactionTitle: t("Transaction"),
        transactionType: TransactionType.CONTRACT,
        status: TransactionStatus.SUCCESS,
        fee,
        IconComponent: historyItemData.IconComponent,
        ActionIconComponent: historyItemData.ActionIconComponent,
      };
    }

    // Default Soroban operation
    return historyItemData as HistoryItemData;
  }

  // Fallback for other operation types
  return defaultHistoryItemData;
};

const HistoryItem: React.FC<HistoryItemProps> = ({
  accountBalances,
  operation,
  publicKey,
  networkDetails,
  handleTransactionDetails,
}) => {
  const { network } = networkDetails;
  const { themeColors } = useColors();
  const [isLoading, setIsLoading] = useState(true);
  const [historyItem, setHistoryItem] = useState<HistoryItemData | null>(null);

  useEffect(() => {
    const buildHistoryItem = async () => {
      try {
        const historyItemData = await mapHistoryItemData(
          operation,
          accountBalances,
          publicKey,
          networkDetails,
          network,
          themeColors,
        );

        setHistoryItem(historyItemData);
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
      }
    };

    buildHistoryItem();
  }, [
    operation,
    accountBalances,
    publicKey,
    networkDetails,
    network,
    themeColors,
  ]);

  if (isLoading) {
    return (
      <View className="flex-1 items-start py-2">
        <Spinner size="small" />
      </View>
    );
  }

  if (!historyItem) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={() => {
        handleTransactionDetails(historyItem.transactionDetails);
      }}
      className="mb-4 flex-row justify-between items-center flex-1"
    >
      <View className="flex-row items-center flex-1">
        {renderIconComponent({
          iconComponent: historyItem.IconComponent,
          themeColors,
        })}
        <View className="ml-4 flex-1 mr-2">
          <Text md primary medium numberOfLines={1}>
            {historyItem.rowText}
          </Text>
          <View className="flex-row items-center gap-1">
            {renderActionIcon({
              actionIcon: historyItem.ActionIconComponent,
              themeColors,
            })}
            <Text sm secondary numberOfLines={1}>
              {historyItem.actionText}
            </Text>
          </View>
        </View>
      </View>
      <View className="items-end justify-center">
        {historyItem.amountText && (
          <Text
            md
            primary
            numberOfLines={1}
            color={
              historyItem.isAddingFunds
                ? themeColors.status.success
                : themeColors.text.primary
            }
          >
            {historyItem.amountText}
          </Text>
        )}
        <Text sm secondary numberOfLines={1}>
          {historyItem.dateText}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default HistoryItem;
