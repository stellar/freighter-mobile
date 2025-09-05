/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable react/no-array-index-key */
import {
  Address,
  Asset as SdkToken,
  Claimant,
  LiquidityPoolAsset,
  Operation,
  Signer,
  SignerKeyOptions,
  StrKey,
  xdr,
} from "@stellar/stellar-sdk";
import Spinner from "components/Spinner";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { CLAIM_PREDICATES, mapNetworkToNetworkDetails } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { getCreateContractArgs, scValByType } from "helpers/soroban";
import { formattedBuffer, truncateAddress } from "helpers/stellar";
import { useClipboard } from "hooks/useClipboard";
import { t } from "i18next";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { getContractSpecs } from "services/backend";

interface KeyValueListItemProps {
  operationKey: string;
  operationValue: string | number | React.ReactNode;
}

export const KeyValueListItem = ({
  operationKey,
  operationValue,
}: KeyValueListItemProps) => (
  <View className="bg-background-secondary rounded-[16px] p-[16px] gap-[12px]">
    <View className="flex-row items-center gap-[8px]">
      <Text>{operationKey}</Text>
    </View>
    <View className="h-[1px] bg-background-tertiary" />
    {typeof operationValue === "string" ||
    typeof operationValue === "number" ? (
      <Text>{operationValue}</Text>
    ) : (
      operationValue
    )}
  </View>
);

interface KeyValueInvokeHostFnArgsProps {
  args: xdr.ScVal[];
  contractId?: string;
  fnName?: string;
  showHeader?: boolean;
  variant?: "secondary" | "tertiary";
}

export const KeyValueInvokeHostFnArgs = ({
  args,
  contractId,
  fnName,
  showHeader = true,
  variant = "secondary",
}: KeyValueInvokeHostFnArgsProps) => {
  const { network } = useAuthenticationStore();
  const networkDetails = mapNetworkToNetworkDetails(network);
  const [isLoading, setIsLoading] = useState(true);
  const [argNames, setArgNames] = useState([] as string[]);
  const { copyToClipboard } = useClipboard();

  useEffect(() => {
    const getSpec = async (id: string, name: string) => {
      try {
        const spec = await getContractSpecs({ contractId: id, networkDetails });
        const { definitions } = spec;
        const invocationSpec = definitions[name];
        const argNamesPositional = invocationSpec.properties?.args
          ?.required as string[];

        setArgNames(argNamesPositional);
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
      }
    };

    if (contractId && fnName) {
      getSpec(contractId, fnName);
    } else {
      setIsLoading(false);
    }
  }, [contractId, fnName, networkDetails]);

  const renderContent = () => {
    if (isLoading) {
      return <Spinner size="small" />;
    }

    return (
      <View
        className={`bg-background-${variant} rounded-[16px] p-[16px] gap-[12px]`}
      >
        {showHeader && (
          <>
            <View className="flex-row items-center gap-[8px]">
              <Icon.BracketsEllipses size={16} themeColor="gray" />
              <Text>
                {t("signTransactionDetails.authorizations.parameters")}
              </Text>
            </View>
            <View className="h-[1px] bg-background-tertiary" />
          </>
        )}
        {args.map((arg, index) => {
          const xdrString = arg.toXDR().toString();
          const contextKey = `${contractId || "no-contract"}-${fnName || "no-fn"}`;

          return (
            <View
              key={`arg-${contextKey}-${index}-${xdrString}`}
              className="gap-[8px]"
            >
              <View className="flex-row items-center gap-[4px]">
                <Text secondary>{argNames[index] && argNames[index]}</Text>
                <Icon.Copy01
                  size={14}
                  themeColor="gray"
                  onPress={() => copyToClipboard(scValByType(arg) as string)}
                />
              </View>
              <Text>{scValByType(arg)}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return renderContent();
};

interface KeyValueWithPublicKeyProps {
  operationKey: string;
  operationValue: string;
}

export const KeyValueWithPublicKey = ({
  operationKey,
  operationValue,
}: KeyValueWithPublicKeyProps) => (
  <KeyValueListItem
    operationKey={operationKey}
    operationValue={
      <Avatar publicAddress={operationValue} size="sm" hasDarkBackground />
    }
  />
);

interface PathListProps {
  paths: SdkToken[];
}

export const PathList = ({ paths }: PathListProps) => (
  <View>
    <View className="flex-row items-center gap-[8px]">
      <Text>{t("signTransactionDetails.operations.path")}: </Text>
    </View>
    {paths.map(({ code, issuer }, index) => (
      <View
        key={`${code} ${index + 1}`}
        className="flex-row items-center gap-[8px]"
      >
        <Text>#{index + 1}</Text>

        <KeyValueListItem
          operationKey={t("signTransactionDetails.operations.tokenCode")}
          operationValue={code}
        />

        {issuer ? (
          <KeyValueListItem
            operationKey={t("signTransactionDetails.operations.issuer")}
            operationValue={
              <Avatar publicAddress={issuer} size="sm" hasDarkBackground />
            }
          />
        ) : null}
      </View>
    ))}
  </View>
);

interface KeyValueSignerProps {
  signer: Signer;
}

export const KeyValueSigner = ({ signer }: KeyValueSignerProps) => {
  const renderSignerType = () => {
    if ("ed25519PublicKey" in signer) {
      return (
        <KeyValueWithPublicKey
          operationKey={t("signTransactionDetails.operations.signer")}
          operationValue={signer.ed25519PublicKey}
        />
      );
    }

    if ("sha256Hash" in signer) {
      return (
        <KeyValueListItem
          operationKey={t("signTransactionDetails.operations.signer")}
          operationValue={formattedBuffer(signer.sha256Hash)}
        />
      );
    }

    if ("preAuthTx" in signer) {
      return (
        <KeyValueListItem
          operationKey={t("signTransactionDetails.operations.signer")}
          operationValue={formattedBuffer(signer.preAuthTx)}
        />
      );
    }

    if ("ed25519SignedPayload" in signer) {
      return (
        <KeyValueListItem
          operationKey={t("signTransactionDetails.operations.signer")}
          operationValue={truncateAddress(signer.ed25519SignedPayload)}
        />
      );
    }

    return <View />;
  };

  return (
    <View>
      {renderSignerType()}
      <KeyValueListItem
        operationKey={t("signTransactionDetails.operations.signerWeight")}
        operationValue={signer.weight}
      />
    </View>
  );
};

interface KeyValueLineProps {
  line: SdkToken | LiquidityPoolAsset;
}

export const KeyValueLine = ({ line }: KeyValueLineProps) => {
  if ("assetA" in line) {
    return (
      <View>
        <KeyValueListItem
          operationKey={t("signTransactionDetails.operations.tokenA")}
          operationValue={line.assetA.getCode()}
        />
        <KeyValueListItem
          operationKey={t("signTransactionDetails.operations.tokenB")}
          operationValue={line.assetB.getCode()}
        />
        <KeyValueListItem
          operationKey={t("signTransactionDetails.operations.fee")}
          operationValue={line.fee}
        />
      </View>
    );
  }

  return (
    <KeyValueListItem
      operationKey={t("signTransactionDetails.operations.tokenCode")}
      operationValue={line.code}
    />
  );
};

interface KeyValueClaimantsProps {
  claimants: Claimant[];
}

interface ClaimPredicateValueProps {
  predicate: xdr.ClaimPredicate;
  hideKey: boolean;
}

export const KeyValueClaimants = ({ claimants }: KeyValueClaimantsProps) => {
  const claimPredicateValue = ({
    predicate,
    hideKey = false,
  }: ClaimPredicateValueProps): React.ReactNode => {
    switch (predicate.switch().name) {
      case "claimPredicateUnconditional": {
        return (
          <KeyValueListItem
            operationKey={
              hideKey ? "" : t("signTransactionDetails.operations.predicate")
            }
            operationValue={CLAIM_PREDICATES[predicate.switch().name]}
          />
        );
      }

      case "claimPredicateAnd": {
        return (
          <>
            <KeyValueListItem
              operationKey={
                hideKey ? "" : t("signTransactionDetails.operations.predicate")
              }
              operationValue={CLAIM_PREDICATES[predicate.switch().name]}
            />
            {predicate
              .andPredicates()
              .map((p) => claimPredicateValue({ predicate: p, hideKey: true }))}
          </>
        );
      }

      case "claimPredicateBeforeAbsoluteTime": {
        return (
          <>
            <KeyValueListItem
              operationKey={
                hideKey ? "" : t("signTransactionDetails.operations.predicate")
              }
              operationValue={CLAIM_PREDICATES[predicate.switch().name]}
            />
            <KeyValueListItem
              operationKey=""
              operationValue={predicate.absBefore().toString()}
            />
          </>
        );
      }

      case "claimPredicateBeforeRelativeTime": {
        return (
          <>
            <KeyValueListItem
              operationKey={
                hideKey ? "" : t("signTransactionDetails.operations.predicate")
              }
              operationValue={CLAIM_PREDICATES[predicate.switch().name]}
            />
            <KeyValueListItem
              operationKey=""
              operationValue={predicate.relBefore().toString()}
            />
          </>
        );
      }

      case "claimPredicateNot": {
        const notPredicate = predicate.notPredicate();

        if (notPredicate) {
          return (
            <>
              <KeyValueListItem
                operationKey={
                  hideKey
                    ? ""
                    : t("signTransactionDetails.operations.predicate")
                }
                operationValue={CLAIM_PREDICATES[predicate.switch().name]}
              />
              {claimPredicateValue({ predicate: notPredicate, hideKey: true })}
            </>
          );
        }

        return <View />;
      }

      case "claimPredicateOr": {
        return (
          <>
            <KeyValueListItem
              operationKey={
                hideKey ? "" : t("signTransactionDetails.operations.predicate")
              }
              operationValue={CLAIM_PREDICATES[predicate.switch().name]}
            />
            {predicate
              .orPredicates()
              .map((p) => claimPredicateValue({ predicate: p, hideKey: true }))}
          </>
        );
      }

      default: {
        return <View />;
      }
    }
  };

  return (
    <>
      {claimants.map((claimant, index) => (
        <View key={claimant.destination + claimant.predicate.switch().name}>
          <KeyValueWithPublicKey
            operationKey={t(
              "signTransactionDetails.operations.destinationWithNumber",
              {
                number: index + 1,
              },
            )}
            operationValue={claimant.destination}
          />
          {claimPredicateValue({
            predicate: claimant.predicate,
            hideKey: false,
          })}
        </View>
      ))}
    </>
  );
};

interface KeyValueInvokeHostFnProps {
  operation: Operation.InvokeHostFunction;
}

export const KeyValueInvokeHostFn = ({
  operation,
}: KeyValueInvokeHostFnProps) => {
  const hostfn = operation.func;
  const { copyToClipboard } = useClipboard();

  const renderDetails = () => {
    switch (hostfn.switch()) {
      case xdr.HostFunctionType.hostFunctionTypeCreateContractV2():
      case xdr.HostFunctionType.hostFunctionTypeCreateContract(): {
        const createContractArgs = getCreateContractArgs(hostfn);
        const preimage = createContractArgs.contractIdPreimage;
        const { executable } = createContractArgs;
        const createV2Args = createContractArgs.constructorArgs;
        const executableType = executable.switch().name;
        const wasmHash = executable.wasmHash();

        if (preimage.switch().name === "contractIdPreimageFromAddress") {
          const preimageFromAddress = preimage.fromAddress();
          const address = preimageFromAddress.address();
          const salt = preimageFromAddress.salt().toString("hex");
          const addressType = address.switch();

          if (addressType.name === "scAddressTypeAccount") {
            const accountId = StrKey.encodeEd25519PublicKey(
              address.accountId().ed25519(),
            );

            return (
              <>
                <KeyValueListItem
                  operationKey={t("signTransactionDetails.operations.type")}
                  operationValue={t(
                    "signTransactionDetails.operations.createContract",
                  )}
                />
                <KeyValueWithPublicKey
                  operationKey={t(
                    "signTransactionDetails.operations.accountId",
                  )}
                  operationValue={accountId}
                />
                <KeyValueListItem
                  operationKey={t("signTransactionDetails.operations.salt")}
                  operationValue={
                    <View className="flex-row items-center gap-[4px]">
                      <Text>{truncateAddress(salt)}</Text>
                      <Icon.Copy01
                        size={14}
                        themeColor="gray"
                        onPress={() => copyToClipboard(salt)}
                      />
                    </View>
                  }
                />
                <KeyValueListItem
                  operationKey={t(
                    "signTransactionDetails.operations.executableType",
                  )}
                  operationValue={executableType}
                />
                {executable.wasmHash() && (
                  <KeyValueListItem
                    operationKey={t(
                      "signTransactionDetails.operations.executableWasmHash",
                    )}
                    operationValue={
                      <View className="flex-row items-center gap-[4px]">
                        <Text>{truncateAddress(wasmHash.toString("hex"))}</Text>
                        <Icon.Copy01
                          size={14}
                          themeColor="gray"
                          onPress={() =>
                            copyToClipboard(wasmHash.toString("hex"))
                          }
                        />
                      </View>
                    }
                  />
                )}
              </>
            );
          }

          const contractId = Address.fromScAddress(address).toString();

          return (
            <>
              <KeyValueListItem
                operationKey={t("signTransactionDetails.operations.type")}
                operationValue={t(
                  "signTransactionDetails.operations.createContract",
                )}
              />
              <KeyValueWithPublicKey
                operationKey={t("signTransactionDetails.operations.contractId")}
                operationValue={contractId}
              />
              <KeyValueListItem
                operationKey={t("signTransactionDetails.operations.salt")}
                operationValue={
                  <View className="flex-row items-center gap-[4px]">
                    <Text>{truncateAddress(salt)}</Text>
                    <Icon.Copy01
                      size={14}
                      themeColor="gray"
                      onPress={() => copyToClipboard(salt)}
                    />
                  </View>
                }
              />
              <KeyValueListItem
                operationKey={t(
                  "signTransactionDetails.operations.executableType",
                )}
                operationValue={executableType}
              />
              {executable.wasmHash() && (
                <KeyValueListItem
                  operationKey={t(
                    "signTransactionDetails.operations.executableWasmHash",
                  )}
                  operationValue={
                    <View className="flex-row items-center gap-[4px]">
                      <Text>{truncateAddress(wasmHash.toString("hex"))}</Text>
                      <Icon.Copy01
                        size={14}
                        themeColor="gray"
                        onPress={() =>
                          copyToClipboard(wasmHash.toString("hex"))
                        }
                      />
                    </View>
                  }
                />
              )}
              {createV2Args && <KeyValueInvokeHostFnArgs args={createV2Args} />}
            </>
          );
        }

        // contractIdPreimageFromAsset
        const preimageFromAsset = preimage.fromAsset();
        const preimageValue = preimageFromAsset.value()!;

        return (
          <>
            <KeyValueListItem
              operationKey={t("signTransactionDetails.operations.type")}
              operationValue={t(
                "signTransactionDetails.operations.createContract",
              )}
            />
            {preimageFromAsset.switch().name === "assetTypeCreditAlphanum4" ||
            preimageFromAsset.switch().name === "assetTypeCreditAlphanum12" ? (
              <>
                <KeyValueListItem
                  operationKey={t(
                    "signTransactionDetails.operations.tokenCode",
                  )}
                  operationValue={(preimageValue as xdr.AlphaNum12)
                    .assetCode()
                    .toString()}
                />
                <KeyValueListItem
                  operationKey={t("signTransactionDetails.operations.issuer")}
                  operationValue={
                    <View className="flex-row items-center gap-[4px]">
                      <Text>
                        {truncateAddress(
                          StrKey.encodeEd25519PublicKey(
                            (preimageValue as xdr.AlphaNum12)
                              .issuer()
                              .ed25519(),
                          ),
                        )}
                      </Text>
                      <Icon.Copy01
                        size={14}
                        themeColor="gray"
                        onPress={() =>
                          copyToClipboard(
                            StrKey.encodeEd25519PublicKey(
                              (preimageValue as xdr.AlphaNum12)
                                .issuer()
                                .ed25519(),
                            ),
                          )
                        }
                      />
                    </View>
                  }
                />
              </>
            ) : null}

            <KeyValueListItem
              operationKey={t(
                "signTransactionDetails.operations.executableType",
              )}
              operationValue={executableType}
            />
            {executable.wasmHash() && (
              <KeyValueListItem
                operationKey={t(
                  "signTransactionDetails.operations.executableWasmHash",
                )}
                operationValue={
                  <View className="flex-row items-center gap-[4px]">
                    <Text>{truncateAddress(wasmHash.toString("hex"))}</Text>
                    <Icon.Copy01
                      size={14}
                      themeColor="gray"
                      onPress={() => copyToClipboard(wasmHash.toString("hex"))}
                    />
                  </View>
                }
              />
            )}
            {createV2Args && <KeyValueInvokeHostFnArgs args={createV2Args} />}
          </>
        );
      }

      case xdr.HostFunctionType.hostFunctionTypeInvokeContract(): {
        const invocation = hostfn.invokeContract();
        const contractId = Address.fromScAddress(
          invocation.contractAddress(),
        ).toString();
        const functionName = invocation.functionName().toString();

        return (
          <>
            <KeyValueListItem
              operationKey={t("signTransactionDetails.operations.type")}
              operationValue={t(
                "signTransactionDetails.operations.invokeContract",
              )}
            />
            <KeyValueListItem
              operationKey={t("signTransactionDetails.operations.contractId")}
              operationValue={
                <View className="flex-row items-center gap-[4px]">
                  <Text>{truncateAddress(contractId)}</Text>
                  <Icon.Copy01
                    size={14}
                    themeColor="gray"
                    onPress={() => copyToClipboard(contractId)}
                  />
                </View>
              }
            />
            <KeyValueListItem
              operationKey={t("signTransactionDetails.operations.functionName")}
              operationValue={functionName}
            />
          </>
        );
      }

      case xdr.HostFunctionType.hostFunctionTypeUploadContractWasm(): {
        return (
          <KeyValueListItem
            operationKey={t("signTransactionDetails.operations.type")}
            operationValue={t(
              "signTransactionDetails.operations.uploadContractWasm",
            )}
          />
        );
      }

      default:
        return <View />;
    }
  };

  return renderDetails();
};

interface KeyValueSignerKeyOptionsProps {
  signer: SignerKeyOptions;
}

export const KeyValueSignerKeyOptions = ({
  signer,
}: KeyValueSignerKeyOptionsProps) => {
  if ("ed25519PublicKey" in signer) {
    return (
      <KeyValueWithPublicKey
        operationKey={t("signTransactionDetails.operations.signerKey")}
        operationValue={signer.ed25519PublicKey}
      />
    );
  }

  if ("sha256Hash" in signer) {
    return (
      <KeyValueListItem
        operationKey={t("signTransactionDetails.operations.signerSha256Hash")}
        operationValue={signer.sha256Hash}
      />
    );
  }

  if ("preAuthTx" in signer) {
    return (
      <KeyValueListItem
        operationKey={t("signTransactionDetails.operations.preAuthTransaction")}
        operationValue={signer.preAuthTx}
      />
    );
  }

  if ("ed25519SignedPayload" in signer) {
    return (
      <KeyValueListItem
        operationKey={t("signTransactionDetails.operations.signedPayload")}
        operationValue={signer.ed25519SignedPayload}
      />
    );
  }
  return <View />;
};
