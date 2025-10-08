/* eslint-disable react/no-array-index-key */
import { Address, Operation, xdr } from "@stellar/stellar-sdk";
import { List, ListItemProps } from "components/List";
import Spinner from "components/Spinner";
import {
  KeyValueListItem,
  KeyValueSigner,
  KeyValueWithPublicKey,
  PathList,
  KeyValueClaimants,
  KeyValueInvokeHostFn,
  KeyValueSignerKeyOptions,
  KeyValueInvokeHostFnArgs,
} from "components/screens/SignTransactionDetails/components/KeyVal";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  mapNetworkToNetworkDetails,
  NATIVE_TOKEN_CODE,
  OPERATION_TYPES,
  VISUAL_DELAY_MS,
} from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import {
  formatTokenDisplayAmount,
  formatFiatAmount,
} from "helpers/formatAmount";
import { getCreateContractArgs } from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { scanToken } from "services/blockaid/api";

interface OperationsProps {
  operations: Operation[];
}

type AuthorizationMap = {
  [index: string]: string;
};

const RenderOperationByType = ({ operation }: { operation: Operation }) => {
  const { t } = useAppTranslation();
  const { network } = useAuthenticationStore();
  const networkDetails = mapNetworkToNetworkDetails(network);
  const { type } = operation;
  const { copyToClipboard } = useClipboard();
  const { themeColors } = useColors();

  const authorizationMap: AuthorizationMap = {
    "1": "Authorization Required",

    "2": "Authorization Revocable",

    "4": "Authorization Immutable",

    "8": "Authorization Clawback Enabled",
  };

  useEffect(() => {
    const scanOperationTokens = async () => {
      let sourceToken;
      let destinationToken;

      if (type === "payment") {
        const { asset } = operation;

        sourceToken = asset;
      }

      if (
        type === "pathPaymentStrictReceive" ||
        type === "pathPaymentStrictSend"
      ) {
        const { sendAsset, destAsset } = operation;

        sourceToken = sendAsset;
        destinationToken = destAsset;
      }

      if (sourceToken) {
        await scanToken({
          tokenCode: sourceToken.code,
          tokenIssuer: sourceToken.issuer,
          network: networkDetails.network,
        });
      }

      if (destinationToken) {
        await scanToken({
          tokenCode: destinationToken.code,
          tokenIssuer: destinationToken.issuer,
          network: networkDetails.network,
        });
      }
    };

    scanOperationTokens();
  }, [type, networkDetails.network, operation]);

  switch (type) {
    case "createAccount": {
      const { startingBalance, destination } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.destination"),
          trailingContent: (
            <View className="flex-row items-center gap-[4px]">
              <Avatar publicAddress={destination} size="sm" hasDarkBackground />
              <Text>{truncateAddress(destination)}</Text>
            </View>
          ),
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.startingBalance"),
          trailingContent: (
            <Text>
              {formatTokenDisplayAmount(startingBalance, NATIVE_TOKEN_CODE)}
            </Text>
          ),
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "payment": {
      const { destination, asset, amount } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.destination"),
          trailingContent: (
            <View className="flex-row items-center gap-[4px]">
              <Avatar publicAddress={destination} size="sm" hasDarkBackground />
              <Text>{truncateAddress(destination)}</Text>
            </View>
          ),
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.tokenCode"),
          trailingContent: <Text>{asset.code}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.amount"),
          trailingContent: (
            <Text>{formatTokenDisplayAmount(amount, asset.code)}</Text>
          ),
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "pathPaymentStrictReceive": {
      const { sendAsset, sendMax, destination, destAsset, destAmount, path } =
        operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.tokenCode"),
          trailingContent: <Text>{sendAsset.code}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.sendMax"),
          trailingContent: (
            <Text>{formatTokenDisplayAmount(sendMax, sendAsset.code)}</Text>
          ),
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.destination"),
          trailingContent: (
            <View className="flex-row items-center gap-[4px]">
              <Avatar publicAddress={destination} size="sm" hasDarkBackground />
              <Text>{truncateAddress(destination)}</Text>
            </View>
          ),
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.destinationToken"),
          trailingContent: <Text>{destAsset.code}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.destinationAmount"),
          trailingContent: (
            <Text>{formatTokenDisplayAmount(destAmount, destAsset.code)}</Text>
          ),
          titleColor: themeColors.text.secondary,
        },
      ];

      return (
        <View className="gap-[12px]">
          <List variant="secondary" items={items} />
          {/* direct trades will have no paths */}
          {path.length > 0 && <PathList paths={path} />}
        </View>
      );
    }
    case "pathPaymentStrictSend": {
      const { sendAsset, sendAmount, destination, destAsset, destMin, path } =
        operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.tokenCode"),
          trailingContent: <Text>{sendAsset.code}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.sendAmount"),
          trailingContent: (
            <Text>{formatTokenDisplayAmount(sendAmount, sendAsset.code)}</Text>
          ),
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.destination"),
          trailingContent: (
            <View className="flex-row items-center gap-[4px]">
              <Avatar publicAddress={destination} size="sm" hasDarkBackground />
              <Text>{truncateAddress(destination)}</Text>
            </View>
          ),
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.destinationToken"),
          trailingContent: <Text>{destAsset.code}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.destinationMinimum"),
          trailingContent: (
            <Text>{formatTokenDisplayAmount(destMin, destAsset.code)}</Text>
          ),
          titleColor: themeColors.text.secondary,
        },
      ];

      return (
        <View className="gap-[12px]">
          <List variant="secondary" items={items} />
          {/* direct trades will have no paths */}
          {path.length > 0 && <PathList paths={path} />}
        </View>
      );
    }
    case "createPassiveSellOffer": {
      const { selling, buying, amount, price } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.buying"),
          trailingContent: <Text>{buying.code}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.amount"),
          trailingContent: (
            <Text>{formatTokenDisplayAmount(amount, buying.code)}</Text>
          ),
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.selling"),
          trailingContent: <Text>{selling.code}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.price"),
          trailingContent: <Text>{formatFiatAmount(price)}</Text>,
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "manageSellOffer": {
      const { offerId, selling, buying, price, amount } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.offerId"),
          trailingContent: <Text>{offerId}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.selling"),
          trailingContent: <Text>{selling.code}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.buying"),
          trailingContent: <Text>{buying.code}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.amount"),
          trailingContent: (
            <Text>{formatTokenDisplayAmount(amount, buying.code)}</Text>
          ),
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.price"),
          trailingContent: <Text>{formatFiatAmount(price)}</Text>,
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "manageBuyOffer": {
      const { selling, buying, buyAmount, price, offerId } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.offerId"),
          trailingContent: <Text>{offerId}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.buying"),
          trailingContent: <Text>{buying.code}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.buyAmount"),
          trailingContent: (
            <Text>{formatTokenDisplayAmount(buyAmount, buying.code)}</Text>
          ),
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.selling"),
          trailingContent: <Text>{selling.code}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.price"),
          trailingContent: <Text>{formatFiatAmount(price)}</Text>,
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "setOptions": {
      const {
        inflationDest,
        clearFlags,
        setFlags,
        masterWeight,
        lowThreshold,
        medThreshold,
        highThreshold,
        homeDomain,
        signer,
      } = operation;

      const items: ListItemProps[] = [];

      if (signer) {
        items.push({
          title: t("signTransactionDetails.operations.signer"),
          trailingContent: (
            <View>
              <KeyValueSigner signer={signer} />
            </View>
          ),
          titleColor: themeColors.text.secondary,
        });
      }

      if (inflationDest) {
        items.push({
          title: t("signTransactionDetails.operations.inflationDestination"),
          trailingContent: (
            <View className="flex-row items-center gap-[4px]">
              <Avatar
                publicAddress={inflationDest}
                size="sm"
                hasDarkBackground
              />
              <Text>{truncateAddress(inflationDest)}</Text>
            </View>
          ),
          titleColor: themeColors.text.secondary,
        });
      }

      if (homeDomain) {
        items.push({
          title: t("signTransactionDetails.operations.homeDomain"),
          trailingContent: <Text>{homeDomain}</Text>,
          titleColor: themeColors.text.secondary,
        });
      }

      if (highThreshold) {
        items.push({
          title: t("signTransactionDetails.operations.highThreshold"),
          trailingContent: <Text>{highThreshold.toString()}</Text>,
          titleColor: themeColors.text.secondary,
        });
      }

      if (medThreshold) {
        items.push({
          title: t("signTransactionDetails.operations.mediumThreshold"),
          trailingContent: <Text>{medThreshold.toString()}</Text>,
          titleColor: themeColors.text.secondary,
        });
      }

      if (lowThreshold) {
        items.push({
          title: t("signTransactionDetails.operations.lowThreshold"),
          trailingContent: <Text>{lowThreshold.toString()}</Text>,
          titleColor: themeColors.text.secondary,
        });
      }

      if (masterWeight) {
        items.push({
          title: t("signTransactionDetails.operations.masterWeight"),
          trailingContent: <Text>{masterWeight.toString()}</Text>,
          titleColor: themeColors.text.secondary,
        });
      }

      if (setFlags) {
        items.push({
          title: t("signTransactionDetails.operations.setFlags"),
          trailingContent: <Text>{authorizationMap[setFlags.toString()]}</Text>,
          titleColor: themeColors.text.secondary,
        });
      }

      if (clearFlags) {
        items.push({
          title: t("signTransactionDetails.operations.clearFlags"),
          trailingContent: (
            <Text>{authorizationMap[clearFlags.toString()]}</Text>
          ),
          titleColor: themeColors.text.secondary,
        });
      }

      return <List variant="secondary" items={items} />;
    }
    case "changeTrust": {
      const { limit, line } = operation;

      const items: ListItemProps[] = [];
      if ("assetA" in line) {
        items.push(
          {
            title: t("signTransactionDetails.operations.tokenA"),
            trailingContent: <Text>{line.assetA.getCode()}</Text>,
            titleColor: themeColors.text.secondary,
          },
          {
            title: t("signTransactionDetails.operations.tokenB"),
            trailingContent: <Text>{line.assetB.getCode()}</Text>,
            titleColor: themeColors.text.secondary,
          },
          {
            title: t("signTransactionDetails.operations.fee"),
            trailingContent: <Text>{line.fee}</Text>,
            titleColor: themeColors.text.secondary,
          },
        );
      } else {
        items.push({
          title: t("signTransactionDetails.operations.tokenCode"),
          trailingContent: <Text>{line.code}</Text>,
          titleColor: themeColors.text.secondary,
        });
      }

      items.push({
        title: t("signTransactionDetails.operations.type"),
        trailingContent: <Text>{type}</Text>,
        titleColor: themeColors.text.secondary,
      });
      items.push({
        title: t("signTransactionDetails.operations.limit"),
        trailingContent: <Text>{limit}</Text>,
        titleColor: themeColors.text.secondary,
      });

      return <List variant="secondary" items={items} />;
    }
    case "allowTrust": {
      const { trustor, assetCode, authorize } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.trustor"),
          trailingContent: (
            <View className="flex-row items-center gap-[4px]">
              <Avatar publicAddress={trustor} size="sm" hasDarkBackground />
              <Text>{truncateAddress(trustor)}</Text>
            </View>
          ),
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.tokenCode"),
          trailingContent: <Text>{assetCode}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.authorize"),
          trailingContent: <Text>{String(authorize)}</Text>,
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "accountMerge": {
      const { destination } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.destination"),
          trailingContent: (
            <View className="flex-row items-center gap-[4px]">
              <Avatar publicAddress={destination} size="sm" hasDarkBackground />
              <Text>{truncateAddress(destination)}</Text>
            </View>
          ),
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "manageData": {
      const { name, value } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.name"),
          trailingContent: <Text>{name}</Text>,
          titleColor: themeColors.text.secondary,
        },
      ];

      if (value) {
        items.push({
          title: t("signTransactionDetails.operations.value"),
          trailingContent: <Text>{value.toString()}</Text>,
          titleColor: themeColors.text.secondary,
        });
      }

      return <List variant="secondary" items={items} />;
    }
    case "bumpSequence": {
      const { bumpTo } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.bumpTo"),
          trailingContent: <Text>{bumpTo}</Text>,
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "createClaimableBalance": {
      const { asset, amount, claimants } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.tokenCode"),
          trailingContent: <Text>{asset.code}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.amount"),
          trailingContent: (
            <Text>{formatTokenDisplayAmount(amount, asset.code)}</Text>
          ),
          titleColor: themeColors.text.secondary,
        },
      ];

      return (
        <View className="gap-[12px]">
          <List variant="secondary" items={items} />
          <KeyValueClaimants claimants={claimants} />
        </View>
      );
    }
    case "claimClaimableBalance": {
      const { balanceId } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.balanceId"),
          trailingContent: <Text>{truncateAddress(balanceId)}</Text>,
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "beginSponsoringFutureReserves": {
      const { sponsoredId } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.sponsoredId"),
          trailingContent: <Text>{truncateAddress(sponsoredId)}</Text>,
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "endSponsoringFutureReserves": {
      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.type"),
          trailingContent: <Text>{type}</Text>,
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "clawback": {
      const { asset, amount, from } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.tokenCode"),
          trailingContent: <Text>{asset.code}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.amount"),
          trailingContent: (
            <Text>{formatTokenDisplayAmount(amount, asset.code)}</Text>
          ),
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.from"),
          trailingContent: (
            <View className="flex-row items-center gap-[4px]">
              <Avatar publicAddress={from} size="sm" hasDarkBackground />
              <Text>{truncateAddress(from)}</Text>
            </View>
          ),
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "clawbackClaimableBalance": {
      const { balanceId } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.balanceId"),
          trailingContent: <Text>{truncateAddress(balanceId)}</Text>,
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "setTrustLineFlags": {
      const { trustor, asset, flags } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.trustor"),
          trailingContent: (
            <View className="flex-row items-center gap-[4px]">
              <Avatar publicAddress={trustor} size="sm" hasDarkBackground />
              <Text>{truncateAddress(trustor)}</Text>
            </View>
          ),
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.tokenCode"),
          trailingContent: <Text>{asset.code}</Text>,
          titleColor: themeColors.text.secondary,
        },
      ];

      if (flags.authorized) {
        items.push({
          title: t("signTransactionDetails.operations.flags.authorized"),
          trailingContent: <Text>{String(flags.authorized)}</Text>,
          titleColor: themeColors.text.secondary,
        });
      }

      if (flags.authorizedToMaintainLiabilities) {
        items.push({
          title: t(
            "signTransactionDetails.operations.flags.authorizedToMaintainLiabilities",
          ),
          trailingContent: (
            <Text>{String(flags.authorizedToMaintainLiabilities)}</Text>
          ),
          titleColor: themeColors.text.secondary,
        });
      }

      if (flags.clawbackEnabled) {
        items.push({
          title: t("signTransactionDetails.operations.flags.clawbackEnabled"),
          trailingContent: <Text>{String(flags.clawbackEnabled)}</Text>,
          titleColor: themeColors.text.secondary,
        });
      }

      return <List variant="secondary" items={items} />;
    }
    case "liquidityPoolDeposit": {
      const { liquidityPoolId, maxAmountA, maxAmountB, maxPrice, minPrice } =
        operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.liquidityPoolId"),
          trailingContent: <Text>{truncateAddress(liquidityPoolId)}</Text>,
        },
        {
          title: t("signTransactionDetails.operations.maxAmountA"),
          trailingContent: <Text>{maxAmountA}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.maxAmountB"),
          trailingContent: <Text>{maxAmountB}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.maxPrice"),
          trailingContent: <Text>{maxPrice}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.minPrice"),
          trailingContent: <Text>{minPrice}</Text>,
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "liquidityPoolWithdraw": {
      const { liquidityPoolId, amount, minAmountA, minAmountB } = operation;

      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.liquidityPoolId"),
          trailingContent: <Text>{truncateAddress(liquidityPoolId)}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.minAmountA"),
          trailingContent: <Text>{minAmountA}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.minAmountB"),
          trailingContent: <Text>{minAmountB}</Text>,
          titleColor: themeColors.text.secondary,
        },
        {
          title: t("signTransactionDetails.operations.amount"),
          trailingContent: <Text>{amount}</Text>,
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "extendFootprintTtl": {
      const { extendTo } = operation;
      const items: ListItemProps[] = [
        {
          title: t("signTransactionDetails.operations.extendTo"),
          trailingContent: <Text>{extendTo}</Text>,
          titleColor: themeColors.text.secondary,
        },
      ];

      return <List variant="secondary" items={items} />;
    }
    case "invokeHostFunction": {
      const { func } = operation;
      switch (func.switch()) {
        case xdr.HostFunctionType.hostFunctionTypeInvokeContract(): {
          const invocation = func.invokeContract();
          const contractId = Address.fromScAddress(
            invocation.contractAddress(),
          ).toString();
          const functionName = invocation.functionName().toString();

          const items: ListItemProps[] = [
            {
              title: t("signTransactionDetails.operations.type"),
              trailingContent: (
                <Text>{t("signTransactionDetails.authorizations.invoke")}</Text>
              ),
              titleColor: themeColors.text.secondary,
            },
            {
              title: t("signTransactionDetails.authorizations.contractId"),
              trailingContent: (
                <View className="flex-row items-center gap-[8px]">
                  <Icon.Copy01
                    size={16}
                    themeColor="gray"
                    onPress={() => copyToClipboard(contractId)}
                  />
                  <Text>{truncateAddress(contractId, 10, 0)}</Text>
                </View>
              ),
              titleColor: themeColors.text.secondary,
            },
            {
              title: t("signTransactionDetails.operations.functionName"),
              trailingContent: <Text>{functionName}</Text>,
              titleColor: themeColors.text.secondary,
            },
          ];

          return <List variant="secondary" items={items} />;
        }
        case xdr.HostFunctionType.hostFunctionTypeUploadContractWasm(): {
          const items: ListItemProps[] = [
            {
              title: t("signTransactionDetails.operations.type"),
              trailingContent: (
                <Text>
                  {t("signTransactionDetails.operations.uploadContractWasm")}
                </Text>
              ),
              titleColor: themeColors.text.secondary,
            },
          ];

          return <List variant="secondary" items={items} />;
        }
        case xdr.HostFunctionType.hostFunctionTypeCreateContractV2():
        case xdr.HostFunctionType.hostFunctionTypeCreateContract(): {
          // Fall back to existing detailed component for complex create contract rendering
          return <KeyValueInvokeHostFn operation={operation} />;
        }
        default:
          return <View />;
      }
    }
    case "restoreFootprint":
    case "inflation":
    default: {
      // OperationType is missing some types
      // Issue: https://github.com/stellar/js-stellar-base/issues/728
      const parsedType = type as string;

      if (parsedType === "revokeTrustlineSponsorship") {
        const { account, asset } =
          operation as unknown as Operation.RevokeTrustlineSponsorship;

        const items: ListItemProps[] = [
          {
            title: t("signTransactionDetails.operations.account"),
            trailingContent: (
              <View className="flex-row items-center gap-[4px]">
                <Avatar publicAddress={account} size="sm" hasDarkBackground />
                <Text>{truncateAddress(account)}</Text>
              </View>
            ),
            titleColor: themeColors.text.secondary,
          },
        ];

        if ("liquidityPoolId" in asset) {
          items.push({
            title: t("signTransactionDetails.operations.liquidityPoolId"),
            trailingContent: (
              <Text>{truncateAddress(asset.liquidityPoolId, 10, 0)}</Text>
            ),
            titleColor: themeColors.text.secondary,
          });
        }

        if ("code" in asset) {
          items.push({
            title: t("signTransactionDetails.operations.tokenCode"),
            trailingContent: <Text>{asset.code}</Text>,
            titleColor: themeColors.text.secondary,
          });
        }

        return <List variant="secondary" items={items} />;
      }

      if (parsedType === "revokeAccountSponsorship") {
        const { account } =
          operation as unknown as Operation.RevokeAccountSponsorship;

        const items: ListItemProps[] = [
          {
            title: t("signTransactionDetails.operations.account"),
            trailingContent: (
              <View className="flex-row items-center gap-[4px]">
                <Avatar publicAddress={account} size="sm" hasDarkBackground />
                <Text>{truncateAddress(account)}</Text>
              </View>
            ),
            titleColor: themeColors.text.secondary,
          },
        ];

        return <List variant="secondary" items={items} />;
      }

      if (parsedType === "revokeOfferSponsorship") {
        const { seller, offerId } =
          operation as unknown as Operation.RevokeOfferSponsorship;

        const items: ListItemProps[] = [
          {
            title: t("signTransactionDetails.operations.seller"),
            trailingContent: (
              <View className="flex-row items-center gap-[4px]">
                <Avatar publicAddress={seller} size="sm" hasDarkBackground />
                <Text>{truncateAddress(seller)}</Text>
              </View>
            ),
            titleColor: themeColors.text.secondary,
          },
          {
            title: t("signTransactionDetails.operations.offerId"),
            trailingContent: <Text>{offerId}</Text>,
            titleColor: themeColors.text.secondary,
          },
        ];

        return <List variant="secondary" items={items} />;
      }

      if (parsedType === "revokeDataSponsorship") {
        const { account, name } =
          operation as unknown as Operation.RevokeDataSponsorship;

        const items: ListItemProps[] = [
          {
            title: t("signTransactionDetails.operations.account"),
            trailingContent: (
              <View className="flex-row items-center gap-[4px]">
                <Avatar publicAddress={account} size="sm" hasDarkBackground />
                <Text>{truncateAddress(account)}</Text>
              </View>
            ),
            titleColor: themeColors.text.secondary,
          },
          {
            title: t("signTransactionDetails.operations.name"),
            trailingContent: <Text>{name}</Text>,
            titleColor: themeColors.text.secondary,
          },
        ];

        return <List variant="secondary" items={items} />;
      }

      if (parsedType === "revokeClaimableBalanceSponsorship") {
        const { balanceId } =
          operation as unknown as Operation.RevokeClaimableBalanceSponsorship;

        const items: ListItemProps[] = [
          {
            title: t("signTransactionDetails.operations.balanceId"),
            trailingContent: <Text>{truncateAddress(balanceId)}</Text>,
            titleColor: themeColors.text.secondary,
          },
        ];

        return <List variant="secondary" items={items} />;
      }

      if (parsedType === "revokeSignerSponsorship") {
        const { account, signer } =
          operation as unknown as Operation.RevokeSignerSponsorship;

        const items: ListItemProps[] = [
          {
            title: t("signTransactionDetails.operations.signer"),
            trailingContent: (
              <View>
                <KeyValueSignerKeyOptions signer={signer} />
              </View>
            ),
            titleColor: themeColors.text.secondary,
          },
          {
            title: t("signTransactionDetails.operations.account"),
            trailingContent: (
              <View className="flex-row items-center gap-[4px]">
                <Avatar publicAddress={account} size="sm" hasDarkBackground />
                <Text>{truncateAddress(account)}</Text>
              </View>
            ),
            titleColor: themeColors.text.secondary,
          },
        ];

        return <List variant="secondary" items={items} />;
      }

      return <View />;
    }
  }
};

const RenderOperationArgsByType = ({ operation }: { operation: Operation }) => {
  const { t } = useAppTranslation();
  const { network } = useAuthenticationStore();
  const networkDetails = mapNetworkToNetworkDetails(network);
  const { type } = operation;

  useEffect(() => {
    const scanOperationTokens = async () => {
      let sourceToken;
      let destinationToken;

      if (type === "payment") {
        const { asset } = operation;

        sourceToken = asset;
      }

      if (
        type === "pathPaymentStrictReceive" ||
        type === "pathPaymentStrictSend"
      ) {
        const { sendAsset, destAsset } = operation;

        sourceToken = sendAsset;
        destinationToken = destAsset;
      }

      if (sourceToken) {
        await scanToken({
          tokenCode: sourceToken.code,
          tokenIssuer: sourceToken.issuer,
          network: networkDetails.network,
        });
      }

      if (destinationToken) {
        await scanToken({
          tokenCode: destinationToken.code,
          tokenIssuer: destinationToken.issuer,
          network: networkDetails.network,
        });
      }
    };

    scanOperationTokens();
  }, [type, networkDetails.network, operation]);

  switch (type) {
    case "invokeHostFunction": {
      const { func } = operation;

      const renderDetails = () => {
        switch (func.switch()) {
          case xdr.HostFunctionType.hostFunctionTypeCreateContractV2():
          case xdr.HostFunctionType.hostFunctionTypeCreateContract(): {
            const createContractArgs = getCreateContractArgs(func);
            const createV2Args = createContractArgs.constructorArgs;

            return (
              createV2Args && (
                <KeyValueInvokeHostFnArgs
                  args={createV2Args}
                  variant="tertiary"
                />
              )
            );
          }

          case xdr.HostFunctionType.hostFunctionTypeInvokeContract(): {
            const invocation = func.invokeContract();
            const contractId = Address.fromScAddress(
              invocation.contractAddress(),
            ).toString();
            const functionName = invocation.functionName().toString();
            const args = invocation.args();

            return (
              <KeyValueInvokeHostFnArgs
                args={args}
                contractId={contractId}
                fnName={functionName}
                showHeader={false}
                variant="tertiary"
              />
            );
          }

          case xdr.HostFunctionType.hostFunctionTypeUploadContractWasm(): {
            const wasm = func.wasm().toString();

            return (
              <KeyValueListItem
                operationKey={t("signTransactionDetails.operations.wasm")}
                operationValue={wasm}
              />
            );
          }

          default:
            return <View />;
        }
      };
      return renderDetails();
    }

    default: {
      return <View />;
    }
  }
};

const Operations = ({ operations }: OperationsProps) => {
  const { t } = useAppTranslation();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // small delay to avoid rendering broken content before the content is ready
    const timer = setTimeout(() => setIsReady(true), VISUAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <View className="items-center py-[16px]">
        <Spinner size="small" />
      </View>
    );
  }

  return (
    <View>
      {operations.map((operation, index: number) => {
        const { source, type } = operation;
        return (
          <View
            className="flex-1 gap-[12px]"
            key={`operation-${index}-${type}-${source || "no-source"}`}
          >
            <View className="flex-row items-center gap-[8px]">
              <Icon.Cube02 size={16} themeColor="gray" />
              <Text secondary>{OPERATION_TYPES[type] || type}</Text>
            </View>
            <View>
              {source && (
                <KeyValueWithPublicKey
                  operationKey={t("signTransactionDetails.operations.source")}
                  operationValue={source}
                />
              )}
              <RenderOperationByType operation={operation} />
            </View>
            {type === "invokeHostFunction" && (
              <>
                <View className="flex-row items-center gap-[8px]">
                  <Icon.BracketsEllipses size={16} themeColor="gray" />
                  <Text secondary>
                    {t("signTransactionDetails.operations.parameters")}
                  </Text>
                </View>
                <View>
                  <RenderOperationArgsByType operation={operation} />
                </View>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
};

export default Operations;
