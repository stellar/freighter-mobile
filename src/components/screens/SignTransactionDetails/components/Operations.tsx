import { Operation, StrKey, xdr } from "@stellar/stellar-sdk";
import {
  KeyValueList,
  KeyValueLine,
  KeyValueSigner,
  KeyValueWithPublicKey,
  PathList,
  KeyValueClaimants,
  KeyValueInvokeHostFn,
  KeyValueSignerKeyOptions,
  KeyValueInvokeHostFnArgs,
} from "components/screens/SignTransactionDetails/components/KeyVal";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  mapNetworkToNetworkDetails,
  NATIVE_TOKEN_CODE,
  OPERATION_TYPES,
} from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { formatAssetAmount } from "helpers/formatAmount";
import { getCreateContractArgs } from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useEffect } from "react";
import { View } from "react-native";
import { scanAsset } from "services/blockaid/api";

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

  const authorizationMap: AuthorizationMap = {
    "1": "Authorization Required",

    "2": "Authorization Revocable",

    "4": "Authorization Immutable",

    "8": "Authorization Clawback Enabled",
  };

  useEffect(() => {
    const scanOperationAssets = async () => {
      let sourceAsset;
      let destinationAsset;

      if (type === "payment") {
        const { asset } = operation;

        sourceAsset = asset;
      }

      if (
        type === "pathPaymentStrictReceive" ||
        type === "pathPaymentStrictSend"
      ) {
        const { sendAsset, destAsset } = operation;

        sourceAsset = sendAsset;
        destinationAsset = destAsset;
      }

      if (sourceAsset) {
        await scanAsset({
          assetCode: sourceAsset.code,
          assetIssuer: sourceAsset.issuer,
          network: networkDetails.network,
        });
      }

      if (destinationAsset) {
        await scanAsset({
          assetCode: destinationAsset.code,
          assetIssuer: destinationAsset.issuer,
          network: networkDetails.network,
        });
      }
    };

    scanOperationAssets();
  }, [type, networkDetails.network, operation]);

  switch (type) {
    case "createAccount": {
      const { startingBalance, destination } = operation;

      return (
        <>
          <KeyValueWithPublicKey
            operationKey={t("signTransactionDetails.operations.destination")}
            operationValue={destination}
          />
          <KeyValueList
            operationKey={t(
              "signTransactionDetails.operations.startingBalance",
            )}
            operationValue={formatAssetAmount(
              startingBalance,
              NATIVE_TOKEN_CODE,
            )}
          />
        </>
      );
    }
    case "payment": {
      const { destination, asset, amount } = operation;

      return (
        <>
          <KeyValueWithPublicKey
            operationKey={t("signTransactionDetails.operations.destination")}
            operationValue={destination}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.assetCode")}
            operationValue={asset.code}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.amount")}
            operationValue={amount}
          />
        </>
      );
    }
    case "pathPaymentStrictReceive": {
      const { sendAsset, sendMax, destination, destAsset, destAmount, path } =
        operation;

      return (
        <>
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.assetCode")}
            operationValue={sendAsset.code}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.sendMax")}
            operationValue={sendMax}
          />
          <KeyValueWithPublicKey
            operationKey={t("signTransactionDetails.operations.destination")}
            operationValue={destination}
          />
          <KeyValueWithPublicKey
            operationKey={t(
              "signTransactionDetails.operations.destinationAsset",
            )}
            operationValue={destAsset.code}
          />
          <KeyValueList
            operationKey={t(
              "signTransactionDetails.operations.destinationAmount",
            )}
            operationValue={destAmount}
          />
          <PathList paths={path} />
        </>
      );
    }
    case "pathPaymentStrictSend": {
      const { sendAsset, sendAmount, destination, destAsset, destMin, path } =
        operation;

      return (
        <>
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.assetCode")}
            operationValue={sendAsset.code}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.sendAmount")}
            operationValue={sendAmount}
          />
          <KeyValueWithPublicKey
            operationKey={t("signTransactionDetails.operations.destination")}
            operationValue={destination}
          />
          <KeyValueWithPublicKey
            operationKey={t(
              "signTransactionDetails.operations.destinationAsset",
            )}
            operationValue={destAsset.code}
          />
          <KeyValueList
            operationKey={t(
              "signTransactionDetails.operations.destinationMinimum",
            )}
            operationValue={destMin}
          />
          <PathList paths={path} />
        </>
      );
    }
    case "createPassiveSellOffer": {
      const { selling, buying, amount, price } = operation;

      return (
        <>
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.buying")}
            operationValue={buying.code}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.amount")}
            operationValue={amount}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.selling")}
            operationValue={selling.code}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.price")}
            operationValue={price}
          />
        </>
      );
    }
    case "manageSellOffer": {
      const { offerId, selling, buying, price, amount } = operation;

      return (
        <>
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.offerId")}
            operationValue={offerId}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.selling")}
            operationValue={selling.code}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.buying")}
            operationValue={buying.code}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.amount")}
            operationValue={amount}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.price")}
            operationValue={price}
          />
        </>
      );
    }
    case "manageBuyOffer": {
      const { selling, buying, buyAmount, price, offerId } = operation;

      return (
        <>
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.offerId")}
            operationValue={offerId}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.buying")}
            operationValue={buying.code}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.buyAmount")}
            operationValue={buyAmount}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.selling")}
            operationValue={selling.code}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.price")}
            operationValue={price}
          />
        </>
      );
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

      return (
        <>
          {signer && <KeyValueSigner signer={signer} />}
          {inflationDest && (
            <KeyValueWithPublicKey
              operationKey={t(
                "signTransactionDetails.operations.inflationDestination",
              )}
              operationValue={inflationDest}
            />
          )}
          {homeDomain && (
            <KeyValueList
              operationKey={t("signTransactionDetails.operations.homeDomain")}
              operationValue={homeDomain}
            />
          )}
          {highThreshold && (
            <KeyValueList
              operationKey={t(
                "signTransactionDetails.operations.highThreshold",
              )}
              operationValue={highThreshold?.toString()}
            />
          )}
          {medThreshold && (
            <KeyValueList
              operationKey={t(
                "signTransactionDetails.operations.mediumThreshold",
              )}
              operationValue={medThreshold?.toString()}
            />
          )}
          {lowThreshold && (
            <KeyValueList
              operationKey={t("signTransactionDetails.operations.lowThreshold")}
              operationValue={lowThreshold?.toString()}
            />
          )}
          {masterWeight && (
            <KeyValueList
              operationKey={t("signTransactionDetails.operations.masterWeight")}
              operationValue={masterWeight?.toString()}
            />
          )}
          {setFlags && (
            <KeyValueList
              operationKey={t("signTransactionDetails.operations.setFlags")}
              operationValue={authorizationMap[setFlags?.toString()]}
            />
          )}
          {clearFlags && (
            <KeyValueList
              operationKey={t("signTransactionDetails.operations.clearFlags")}
              operationValue={authorizationMap[clearFlags.toString()]}
            />
          )}
        </>
      );
    }
    case "changeTrust": {
      const { limit, line } = operation;

      return (
        <>
          <KeyValueLine line={line} />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.type")}
            operationValue={type}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.limit")}
            operationValue={limit}
          />
        </>
      );
    }
    case "allowTrust": {
      const { trustor, assetCode, authorize } = operation;

      return (
        <>
          <KeyValueWithPublicKey
            operationKey={t("signTransactionDetails.operations.trustor")}
            operationValue={trustor}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.assetCode")}
            operationValue={assetCode}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.authorize")}
            operationValue={authorize}
          />
        </>
      );
    }
    case "accountMerge": {
      const { destination } = operation;

      return (
        <KeyValueWithPublicKey
          operationKey={t("signTransactionDetails.operations.destination")}
          operationValue={destination}
        />
      );
    }
    case "manageData": {
      const { name, value } = operation;

      return (
        <>
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.name")}
            operationValue={name}
          />
          {value && (
            <KeyValueList
              operationKey={t("signTransactionDetails.operations.value")}
              operationValue={value?.toString()}
            />
          )}
        </>
      );
    }
    case "bumpSequence": {
      const { bumpTo } = operation;

      return (
        <KeyValueList
          operationKey={t("signTransactionDetails.operations.bumpTo")}
          operationValue={bumpTo}
        />
      );
    }
    case "createClaimableBalance": {
      const { asset, amount, claimants } = operation;

      return (
        <>
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.assetCode")}
            operationValue={asset.code}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.amount")}
            operationValue={amount}
          />
          <KeyValueClaimants claimants={claimants} />
        </>
      );
    }
    case "claimClaimableBalance": {
      const { balanceId } = operation;

      return (
        <KeyValueList
          operationKey={t("signTransactionDetails.operations.balanceId")}
          operationValue={truncateAddress(balanceId)}
        />
      );
    }
    case "beginSponsoringFutureReserves": {
      const { sponsoredId } = operation;

      return (
        <KeyValueList
          operationKey={t("signTransactionDetails.operations.sponsoredId")}
          operationValue={truncateAddress(sponsoredId)}
        />
      );
    }
    case "endSponsoringFutureReserves": {
      return (
        <KeyValueList
          operationKey={t("signTransactionDetails.operations.type")}
          operationValue={type}
        />
      );
    }
    case "clawback": {
      const { asset, amount, from } = operation;

      return (
        <>
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.assetCode")}
            operationValue={asset.code}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.amount")}
            operationValue={amount}
          />
          <KeyValueWithPublicKey
            operationKey={t("signTransactionDetails.operations.from")}
            operationValue={from}
          />
        </>
      );
    }
    case "clawbackClaimableBalance": {
      const { balanceId } = operation;

      return (
        <KeyValueList
          operationKey={t("signTransactionDetails.operations.balanceId")}
          operationValue={truncateAddress(balanceId)}
        />
      );
    }
    case "setTrustLineFlags": {
      const { trustor, asset, flags } = operation;

      return (
        <>
          <KeyValueWithPublicKey
            operationKey={t("signTransactionDetails.operations.trustor")}
            operationValue={trustor}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.assetCode")}
            operationValue={asset.code}
          />
          {flags.authorized && (
            <KeyValueList
              operationKey={t(
                "signTransactionDetails.operations.flags.authorized",
              )}
              operationValue={flags.authorized}
            />
          )}
          {flags.authorizedToMaintainLiabilities && (
            <KeyValueList
              operationKey={t(
                "signTransactionDetails.operations.flags.authorizedToMaintainLiabilities",
              )}
              operationValue={flags.authorizedToMaintainLiabilities}
            />
          )}
          {flags.clawbackEnabled && (
            <KeyValueList
              operationKey={t(
                "signTransactionDetails.operations.flags.clawbackEnabled",
              )}
              operationValue={flags.clawbackEnabled}
            />
          )}
        </>
      );
    }
    case "liquidityPoolDeposit": {
      const { liquidityPoolId, maxAmountA, maxAmountB, maxPrice, minPrice } =
        operation;

      return (
        <>
          <KeyValueList
            operationKey={t(
              "signTransactionDetails.operations.liquidityPoolId",
            )}
            operationValue={truncateAddress(liquidityPoolId)}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.maxAmountA")}
            operationValue={maxAmountA}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.maxAmountB")}
            operationValue={maxAmountB}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.maxPrice")}
            operationValue={maxPrice}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.minPrice")}
            operationValue={minPrice}
          />
        </>
      );
    }
    case "liquidityPoolWithdraw": {
      const { liquidityPoolId, amount, minAmountA, minAmountB } = operation;

      return (
        <>
          <KeyValueList
            operationKey={t(
              "signTransactionDetails.operations.liquidityPoolId",
            )}
            operationValue={truncateAddress(liquidityPoolId)}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.minAmountA")}
            operationValue={minAmountA}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.minAmountB")}
            operationValue={minAmountB}
          />
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.amount")}
            operationValue={amount}
          />
        </>
      );
    }
    case "extendFootprintTtl": {
      const { extendTo } = operation;

      return (
        <KeyValueList
          operationKey={t("signTransactionDetails.operations.extendTo")}
          operationValue={extendTo}
        />
      );
    }
    case "invokeHostFunction": {
      return <KeyValueInvokeHostFn operation={operation} />;
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

        return (
          <>
            <KeyValueWithPublicKey
              operationKey={t("signTransactionDetails.operations.account")}
              operationValue={account}
            />
            {"liquidityPoolId" in asset && (
              <KeyValueList
                operationKey={t(
                  "signTransactionDetails.operations.liquidityPoolId",
                )}
                operationValue={truncateAddress(asset.liquidityPoolId)}
              />
            )}
            {"code" in asset && (
              <KeyValueList
                operationKey={t("signTransactionDetails.operations.assetCode")}
                operationValue={asset.code}
              />
            )}
          </>
        );
      }
      if (parsedType === "revokeAccountSponsorship") {
        const { account } =
          operation as unknown as Operation.RevokeAccountSponsorship;

        return (
          <KeyValueWithPublicKey
            operationKey={t("signTransactionDetails.operations.account")}
            operationValue={account}
          />
        );
      }
      if (parsedType === "revokeOfferSponsorship") {
        const { seller, offerId } =
          operation as unknown as Operation.RevokeOfferSponsorship;

        return (
          <>
            <KeyValueWithPublicKey
              operationKey={t("signTransactionDetails.operations.seller")}
              operationValue={seller}
            />
            <KeyValueList
              operationKey={t("signTransactionDetails.operations.offerId")}
              operationValue={offerId}
            />
          </>
        );
      }
      if (parsedType === "revokeDataSponsorship") {
        const { account, name } =
          operation as unknown as Operation.RevokeDataSponsorship;

        return (
          <>
            <KeyValueWithPublicKey
              operationKey={t("signTransactionDetails.operations.account")}
              operationValue={account}
            />
            <KeyValueList
              operationKey={t("signTransactionDetails.operations.name")}
              operationValue={name}
            />
          </>
        );
      }
      if (parsedType === "revokeClaimableBalanceSponsorship") {
        const { balanceId } =
          operation as unknown as Operation.RevokeClaimableBalanceSponsorship;

        return (
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.balanceId")}
            operationValue={truncateAddress(balanceId)}
          />
        );
      }
      if (parsedType === "revokeSignerSponsorship") {
        const { account, signer } =
          operation as unknown as Operation.RevokeSignerSponsorship;

        return (
          <>
            <KeyValueSignerKeyOptions signer={signer} />
            <KeyValueWithPublicKey
              operationKey={t("signTransactionDetails.operations.account")}
              operationValue={account}
            />
          </>
        );
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
    const scanOperationAssets = async () => {
      let sourceAsset;
      let destinationAsset;

      if (type === "payment") {
        const { asset } = operation;

        sourceAsset = asset;
      }

      if (
        type === "pathPaymentStrictReceive" ||
        type === "pathPaymentStrictSend"
      ) {
        const { sendAsset, destAsset } = operation;

        sourceAsset = sendAsset;
        destinationAsset = destAsset;
      }

      if (sourceAsset) {
        await scanAsset({
          assetCode: sourceAsset.code,
          assetIssuer: sourceAsset.issuer,
          network: networkDetails.network,
        });
      }

      if (destinationAsset) {
        await scanAsset({
          assetCode: destinationAsset.code,
          assetIssuer: destinationAsset.issuer,
          network: networkDetails.network,
        });
      }
    };

    scanOperationAssets();
  }, [type, networkDetails.network, operation]);

  switch (type) {
    case "invokeHostFunction": {
      const { func } = operation;

      const renderDetails = () => {
        switch (func.switch()) {
          case xdr.HostFunctionType.hostFunctionTypeCreateContractV2():
          case xdr.HostFunctionType.hostFunctionTypeCreateContract(): {
            const createContractArgs = getCreateContractArgs(func);
            const preimage = createContractArgs.contractIdPreimage;
            const createV2Args = createContractArgs.constructorArgs;

            if (preimage.switch().name === "contractIdPreimageFromAddress") {
              const preimageFromAddress = preimage.fromAddress();
              const address = preimageFromAddress.address();
              const addressType = address.switch();

              if (addressType.name === "scAddressTypeAccount") {
                return (
                  createV2Args && (
                    <KeyValueInvokeHostFnArgs args={createV2Args} />
                  )
                );
              }
              return (
                createV2Args && <KeyValueInvokeHostFnArgs args={createV2Args} />
              );
            }

            // contractIdPreimageFromAsset
            return (
              createV2Args && <KeyValueInvokeHostFnArgs args={createV2Args} />
            );
          }

          case xdr.HostFunctionType.hostFunctionTypeInvokeContract(): {
            const invocation = func.invokeContract();
            const contractId = StrKey.encodeContract(
              invocation.contractAddress().contractId(),
            );
            const functionName = invocation.functionName().toString();
            const args = invocation.args();

            return (
              <KeyValueInvokeHostFnArgs
                args={args}
                contractId={contractId}
                fnName={functionName}
                showHeader={false}
              />
            );
          }

          case xdr.HostFunctionType.hostFunctionTypeUploadContractWasm(): {
            const wasm = func.wasm().toString();

            return (
              <KeyValueList
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

  return (
    <View className="Operations">
      {operations.map((operation, index: number) => {
        const operationIndex = index + 1;
        const { source, type } = operation;

        return (
          <View
            className="Operations--wrapper"
            key={operationIndex}
            data-testid="OperationsWrapper"
          >
            <View className="Operations--header">
              <Icon.Cube02 size={16} themeColor="gray" />
              <Text>{OPERATION_TYPES[type] || type}</Text>
            </View>
            <View className="Operations--item">
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
                <View className="Operations--header">
                  <Icon.BracketsEllipses size={16} themeColor="gray" />
                  <Text>
                    {t("signTransactionDetails.operations.parameters")}
                  </Text>
                </View>
                <View className="Operations--item">
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
