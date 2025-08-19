/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Asset,
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

interface KeyValueListProps {
  operationKey: string;
  operationValue: string | number | React.ReactNode;
}

export const KeyValueList = ({
  operationKey,
  operationValue,
}: KeyValueListProps) => (
  <View className="bg-background-secondary rounded-[16px] p-[16px] gap-[12px]">
    <View className="flex-row items-center gap-[8px]">
      <Text>{operationKey}</Text>
    </View>
    <View className="h-[1px] bg-background-tertiary" />
    <Text>{operationValue}</Text>
  </View>
);

interface KeyValueInvokeHostFnArgsProps {
  args: xdr.ScVal[];
  contractId?: string;
  fnName?: string;
  showHeader?: boolean;
}

export const KeyValueInvokeHostFnArgs = ({
  args,
  contractId,
  fnName,
  showHeader = true,
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
      <View className="bg-background-secondary rounded-[16px] p-[16px] gap-[12px]">
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
        {args.map((arg, index) => (
          <View key={arg.toXDR().toString()} className="gap-[8px]">
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
        ))}
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
  <KeyValueList
    operationKey={operationKey}
    operationValue={<Avatar publicAddress={operationValue} size="sm" />}
  />
);

interface PathListProps {
  paths: Asset[];
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

        <KeyValueList
          operationKey={t("signTransactionDetails.operations.assetCode")}
          operationValue={code}
        />

        {issuer ? (
          <KeyValueList
            operationKey={t("signTransactionDetails.operations.issuer")}
            operationValue={<Avatar publicAddress={issuer} size="sm" />}
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
        <KeyValueList
          operationKey={t("signTransactionDetails.operations.signer")}
          operationValue={formattedBuffer(signer.sha256Hash)}
        />
      );
    }

    if ("preAuthTx" in signer) {
      return (
        <KeyValueList
          operationKey={t("signTransactionDetails.operations.signer")}
          operationValue={formattedBuffer(signer.preAuthTx)}
        />
      );
    }

    if ("ed25519SignedPayload" in signer) {
      return (
        <KeyValueList
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
      <KeyValueList
        operationKey={t("signTransactionDetails.operations.signerWeight")}
        operationValue={signer.weight}
      />
    </View>
  );
};

interface KeyValueLineProps {
  line: Asset | LiquidityPoolAsset;
}

export const KeyValueLine = ({ line }: KeyValueLineProps) => {
  if ("assetA" in line) {
    return (
      <View>
        <KeyValueList
          operationKey={t("signTransactionDetails.operations.assetA")}
          operationValue={line.assetA.getCode()}
        />
        <KeyValueList
          operationKey={t("signTransactionDetails.operations.assetB")}
          operationValue={line.assetB.getCode()}
        />
        <KeyValueList
          operationKey={t("signTransactionDetails.operations.fee")}
          operationValue={line.fee}
        />
      </View>
    );
  }

  return (
    <KeyValueList
      operationKey={t("signTransactionDetails.operations.assetCode")}
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
          <KeyValueList
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
            <KeyValueList
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
            <KeyValueList
              operationKey={
                hideKey ? "" : t("signTransactionDetails.operations.predicate")
              }
              operationValue={CLAIM_PREDICATES[predicate.switch().name]}
            />
            <KeyValueList
              operationKey=""
              operationValue={predicate.absBefore().toString()}
            />
          </>
        );
      }

      case "claimPredicateBeforeRelativeTime": {
        return (
          <>
            <KeyValueList
              operationKey={
                hideKey ? "" : t("signTransactionDetails.operations.predicate")
              }
              operationValue={CLAIM_PREDICATES[predicate.switch().name]}
            />
            <KeyValueList
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
              <KeyValueList
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
            <KeyValueList
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
              `signTransactionDetails.operations.destination #${index + 1}`,
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
                <KeyValueList
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
                <KeyValueList
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
                <KeyValueList
                  operationKey={t(
                    "signTransactionDetails.operations.executableType",
                  )}
                  operationValue={executableType}
                />
                {executable.wasmHash() && (
                  <KeyValueList
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

          const contractId = StrKey.encodeContract(address.contractId());

          return (
            <>
              <KeyValueList
                operationKey={t("signTransactionDetails.operations.type")}
                operationValue={t(
                  "signTransactionDetails.operations.createContract",
                )}
              />
              <KeyValueWithPublicKey
                operationKey={t("signTransactionDetails.operations.contractId")}
                operationValue={contractId}
              />
              <KeyValueList
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
              <KeyValueList
                operationKey={t(
                  "signTransactionDetails.operations.executableType",
                )}
                operationValue={executableType}
              />
              {executable.wasmHash() && (
                <KeyValueList
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
            <KeyValueList
              operationKey={t("signTransactionDetails.operations.type")}
              operationValue={t(
                "signTransactionDetails.operations.createContract",
              )}
            />
            {preimageFromAsset.switch().name === "assetTypeCreditAlphanum4" ||
            preimageFromAsset.switch().name === "assetTypeCreditAlphanum12" ? (
              <>
                <KeyValueList
                  operationKey={t(
                    "signTransactionDetails.operations.assetCode",
                  )}
                  operationValue={(preimageValue as xdr.AlphaNum12)
                    .assetCode()
                    .toString()}
                />
                <KeyValueList
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

            <KeyValueList
              operationKey={t(
                "signTransactionDetails.operations.executableType",
              )}
              operationValue={executableType}
            />
            {executable.wasmHash() && (
              <KeyValueList
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
        const contractId = StrKey.encodeContract(
          invocation.contractAddress().contractId(),
        );

        const functionName = invocation.functionName().toString();

        return (
          <>
            <KeyValueList
              operationKey={t("signTransactionDetails.operations.type")}
              operationValue={t(
                "signTransactionDetails.operations.invokeContract",
              )}
            />
            <KeyValueList
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
            <KeyValueList
              operationKey={t("signTransactionDetails.operations.functionName")}
              operationValue={functionName}
            />
          </>
        );
      }

      case xdr.HostFunctionType.hostFunctionTypeUploadContractWasm(): {
        return (
          <KeyValueList
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
      <KeyValueList
        operationKey={t("signTransactionDetails.operations.signerSha256Hash")}
        operationValue={signer.sha256Hash}
      />
    );
  }

  if ("preAuthTx" in signer) {
    return (
      <KeyValueList
        operationKey={t("signTransactionDetails.operations.preAuthTransaction")}
        operationValue={signer.preAuthTx}
      />
    );
  }

  if ("ed25519SignedPayload" in signer) {
    return (
      <KeyValueList
        operationKey={t("signTransactionDetails.operations.signedPayload")}
        operationValue={signer.ed25519SignedPayload}
      />
    );
  }
  return <View />;
};
