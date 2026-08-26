/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable react/no-array-index-key */
import {
  Address,
  Asset as SdkToken,
  Claimant,
  LiquidityPoolAsset,
  Operation,
  OperationRecord,
  StrKey,
  xdr,
} from "@stellar/stellar-sdk";
import Spinner from "components/Spinner";
import Avatar from "components/sds/Avatar";
import { Banner } from "components/sds/Banner";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { CLAIM_PREDICATES, mapNetworkToNetworkDetails } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import {
  addressToString,
  getCreateContractArgs,
  scValByType,
} from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import { t } from "i18next";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { getContractSpecs } from "services/backend";

// v16 no longer exports the signer option types directly; derive them from the
// parsed-operation union so they track the SDK exactly.
type SetOptionsSigner = NonNullable<
  Extract<OperationRecord, { type: "setOptions" }>["signer"]
>;
type SignerKeyOptions = Extract<
  OperationRecord,
  { type: "revokeSignerSponsorship" }
>["signer"];

/**
 * Renders a signer hash (sha256Hash / preAuthTx) as uppercase hex.
 *
 * Accepts a string as well as bytes because the SDK is inconsistent: the
 * `revokeSponsorship` signer arm returns these fields as already-hex strings
 * (`convertXdrSignerKeyToObject`), while `setOptions` returns real
 * `Uint8Array`s. A string is passed through rather than re-encoded -- encoding
 * it again would hex the ASCII of the hex.
 */
const signerKeyToHex = (value: Uint8Array | string): string =>
  (typeof value === "string"
    ? value
    : xdr.encodeBytes(value, "hex")
  ).toUpperCase();

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
          const xdrString = arg.toXdr("base64");
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

export const InlinePublicKeyRow = ({
  operationKey,
  operationValue,
}: KeyValueWithPublicKeyProps) => (
  <View className="bg-background-secondary rounded-[16px] px-[16px] py-[14px] flex-row items-center justify-between gap-[12px]">
    <Text>{operationKey}</Text>
    <View className="flex-1 flex-row items-center justify-end gap-[8px]">
      <Avatar publicAddress={operationValue} size="sm" hasDarkBackground />
      <Text>{truncateAddress(operationValue)}</Text>
    </View>
  </View>
);

interface InlineHashRowProps {
  operationKey: string;
  operationValue: string;
}

export const InlineHashRow = ({
  operationKey,
  operationValue,
}: InlineHashRowProps) => (
  <View className="bg-background-secondary rounded-[16px] px-[16px] py-[14px] flex-row items-center justify-between gap-[12px]">
    <Text>{operationKey}</Text>
    <View className="flex-1 flex-row items-center justify-end">
      <Text>{truncateAddress(operationValue)}</Text>
    </View>
  </View>
);

export const KeyValueWithPublicKey = ({
  operationKey,
  operationValue,
}: KeyValueWithPublicKeyProps) => (
  <KeyValueListItem
    operationKey={operationKey}
    operationValue={
      <View className="flex-row items-center gap-[16px]">
        <Avatar publicAddress={operationValue} size="sm" hasDarkBackground />
        <Text>{truncateAddress(operationValue)}</Text>
      </View>
    }
  />
);

interface PathListProps {
  paths: SdkToken[];
}

export const PathList = ({ paths }: PathListProps) => {
  const { themeColors } = useColors();
  return (
    <View>
      <View className="flex-row items-center gap-[8px]">
        <Icon.Shuffle01 size={16} themeColor="gray" />
        <Text secondary>{t("signTransactionDetails.operations.path")} </Text>
      </View>
      <View className="gap-[12px] mt-[8px]">
        {paths.map(({ code, issuer }, index) => (
          <View
            key={`${code} ${index + 1}`}
            className="bg-background-tertiary rounded-[16px] p-[16px] gap-[12px]"
          >
            <View className="rounded-full self-start px-[8px] py-[4px] bg-lilac-1 border border-lilac-6">
              <Text size="xs" color={themeColors.lilac[11]}>
                #{index + 1}
              </Text>
            </View>

            <View className="flex-row justify-between items-center">
              <Text secondary>
                {t("signTransactionDetails.operations.token")}
              </Text>
              {issuer && (
                <Text secondary>
                  {t("signTransactionDetails.operations.issuer")}
                </Text>
              )}
            </View>

            <View className="flex-row justify-between items-center">
              <Text>{code}</Text>
              {issuer && (
                <View className="flex-row items-center gap-[8px]">
                  <Avatar publicAddress={issuer} size="sm" hasDarkBackground />
                  <Text>{truncateAddress(issuer, 4, 4)}</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

interface KeyValueSignerProps {
  signer: SetOptionsSigner;
}

export const KeyValueSigner = ({ signer }: KeyValueSignerProps) => {
  const renderSignerType = () => {
    if (signer.ed25519PublicKey) {
      return (
        <InlinePublicKeyRow
          operationKey={t("signTransactionDetails.operations.signer")}
          operationValue={signer.ed25519PublicKey}
        />
      );
    }

    if (signer.sha256Hash) {
      return (
        <InlineHashRow
          operationKey={t("signTransactionDetails.operations.signer")}
          operationValue={signerKeyToHex(signer.sha256Hash)}
        />
      );
    }

    if (signer.preAuthTx) {
      return (
        <InlineHashRow
          operationKey={t("signTransactionDetails.operations.signer")}
          operationValue={signerKeyToHex(signer.preAuthTx)}
        />
      );
    }

    if (signer.ed25519SignedPayload) {
      return (
        <InlineHashRow
          operationKey={t("signTransactionDetails.operations.signer")}
          operationValue={signer.ed25519SignedPayload}
        />
      );
    }

    return <View />;
  };

  return (
    <View className="bg-background-secondary rounded-[16px]">
      {renderSignerType()}
      <View className="h-[1px] mx-4 bg-border-primary" />
      <View className="rounded-[16px] px-[16px] py-[14px] flex-row items-center justify-between gap-[12px]">
        <Text>{t("signTransactionDetails.operations.signerWeight")}</Text>
        <View className="flex-1 flex-row items-center justify-end gap-[8px]">
          <Text>{signer.weight}</Text>
        </View>
      </View>
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
    switch (predicate.type) {
      case "claimPredicateUnconditional": {
        return (
          <KeyValueListItem
            operationKey={
              hideKey ? "" : t("signTransactionDetails.operations.predicate")
            }
            operationValue={CLAIM_PREDICATES[predicate.type]}
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
              operationValue={CLAIM_PREDICATES[predicate.type]}
            />
            {predicate.andPredicates.map((p) =>
              claimPredicateValue({ predicate: p, hideKey: true }),
            )}
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
              operationValue={CLAIM_PREDICATES[predicate.type]}
            />
            <KeyValueListItem
              operationKey=""
              operationValue={predicate.absBefore.toString()}
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
              operationValue={CLAIM_PREDICATES[predicate.type]}
            />
            <KeyValueListItem
              operationKey=""
              operationValue={predicate.relBefore.toString()}
            />
          </>
        );
      }

      case "claimPredicateNot": {
        const { notPredicate } = predicate;

        if (notPredicate) {
          return (
            <>
              <KeyValueListItem
                operationKey={
                  hideKey
                    ? ""
                    : t("signTransactionDetails.operations.predicate")
                }
                operationValue={CLAIM_PREDICATES[predicate.type]}
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
              operationValue={CLAIM_PREDICATES[predicate.type]}
            />
            {predicate.orPredicates.map((p) =>
              claimPredicateValue({ predicate: p, hideKey: true }),
            )}
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
        <View key={claimant.destination + claimant.predicate.type}>
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

/**
 * Explains that a CAP-85 externally managed executable is not pinned by the
 * transaction being signed: the owner can change the code the reference
 * resolves to after this transaction is signed.
 */
export const ExternalExecutableNote = () => (
  <Banner
    variant="warning"
    showChevron={false}
    testID="ExternalExecutableNote"
    text={t("signTransactionDetails.authorizations.executableNote")}
  />
);

/**
 * Renders the executable of a contract-creation host function. CAP-85
 * (Protocol 28) adds a third arm whose code lives behind a reference into
 * another contract's storage -- we show the owner and tag that identify the
 * reference, and deliberately no wasm hash, because the owner can change the
 * code the reference resolves to after this transaction is signed.
 */
interface ExecutableDetailsProps {
  executable: xdr.ContractExecutable;
}

export const ExecutableDetails = ({ executable }: ExecutableDetailsProps) => {
  const { copyToClipboard } = useClipboard();

  // v17: `wasmHash` is an xdr.Hash wrapper on the wasm arm only; render it as
  // hex (Uint8Array.toString would give comma-joined decimals).
  const wasmHash =
    executable.type === "contractExecutableWasm"
      ? xdr.encodeBytes(executable.wasmHash.toBytes(), "hex")
      : null;
  const externalRef =
    executable.type === "contractExecutableExternalRef"
      ? executable.externalRef
      : null;
  const externalRefOwner = externalRef
    ? addressToString(externalRef.executableOwner)
    : null;

  return (
    <>
      <KeyValueListItem
        operationKey={t("signTransactionDetails.operations.executableType")}
        operationValue={executable.type}
      />
      {wasmHash && (
        <KeyValueListItem
          operationKey={t(
            "signTransactionDetails.operations.executableWasmHash",
          )}
          operationValue={
            <View className="flex-row items-center gap-[4px]">
              <Text>{truncateAddress(wasmHash)}</Text>
              <Icon.Copy01
                size={14}
                themeColor="gray"
                onPress={() => copyToClipboard(wasmHash)}
              />
            </View>
          }
        />
      )}
      {externalRef && externalRefOwner && (
        <>
          <KeyValueWithPublicKey
            operationKey={t(
              "signTransactionDetails.authorizations.executableOwner",
            )}
            operationValue={externalRefOwner}
          />
          <KeyValueListItem
            operationKey={t(
              "signTransactionDetails.authorizations.executableTag",
            )}
            // SEP-51 form: reversible for non-UTF-8 bytes, plain text otherwise.
            operationValue={externalRef.tag.toJson()}
          />
          <ExternalExecutableNote />
        </>
      )}
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
    switch (hostfn.type) {
      case "hostFunctionTypeCreateContractV2":
      case "hostFunctionTypeCreateContract": {
        const createContractArgs = getCreateContractArgs(hostfn);
        const preimage = createContractArgs.contractIdPreimage;
        const { executable } = createContractArgs;
        const createV2Args = createContractArgs.constructorArgs;

        if (preimage.type === "contractIdPreimageFromAddress") {
          const preimageFromAddress = preimage.fromAddress;
          const { address } = preimageFromAddress;
          const salt = xdr.encodeBytes(
            preimageFromAddress.salt.toBytes(),
            "hex",
          );

          if (address.type === "scAddressTypeAccount") {
            const accountId = StrKey.encodeEd25519PublicKey(
              address.accountId.ed25519.toBytes(),
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
                <ExecutableDetails executable={executable} />
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
              <ExecutableDetails executable={executable} />
              {createV2Args && <KeyValueInvokeHostFnArgs args={createV2Args} />}
            </>
          );
        }

        // contractIdPreimageFromAsset
        const preimageFromAsset = preimage.fromAsset;
        const preimageValue = preimageFromAsset.value;

        return (
          <>
            <KeyValueListItem
              operationKey={t("signTransactionDetails.operations.type")}
              operationValue={t(
                "signTransactionDetails.operations.createContract",
              )}
            />
            {preimageFromAsset.type === "assetTypeCreditAlphanum4" ||
            preimageFromAsset.type === "assetTypeCreditAlphanum12" ? (
              <>
                <KeyValueListItem
                  operationKey={t(
                    "signTransactionDetails.operations.tokenCode",
                  )}
                  operationValue={
                    // v17: BytesValue.toString() base64-encodes; toJson()
                    // yields the trimmed ASCII asset code.
                    (
                      preimageValue as xdr.AlphaNum12
                    ).assetCode.toJson() as string
                  }
                />
                <KeyValueListItem
                  operationKey={t("signTransactionDetails.operations.issuer")}
                  operationValue={
                    <View className="flex-row items-center gap-[4px]">
                      <Text>
                        {truncateAddress(
                          StrKey.encodeEd25519PublicKey(
                            (
                              preimageValue as xdr.AlphaNum12
                            ).issuer.ed25519.toBytes(),
                          ),
                        )}
                      </Text>
                      <Icon.Copy01
                        size={14}
                        themeColor="gray"
                        onPress={() =>
                          copyToClipboard(
                            StrKey.encodeEd25519PublicKey(
                              (
                                preimageValue as xdr.AlphaNum12
                              ).issuer.ed25519.toBytes(),
                            ),
                          )
                        }
                      />
                    </View>
                  }
                />
              </>
            ) : null}

            <ExecutableDetails executable={executable} />
            {createV2Args && <KeyValueInvokeHostFnArgs args={createV2Args} />}
          </>
        );
      }

      case "hostFunctionTypeInvokeContract": {
        const invocation = hostfn.invokeContract;
        const contractId = Address.fromScAddress(
          invocation.contractAddress,
        ).toString();
        const functionName = invocation.functionName.toString();

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

      case "hostFunctionTypeUploadContractWasm": {
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
  if (signer.ed25519PublicKey) {
    return (
      <KeyValueWithPublicKey
        operationKey={t("signTransactionDetails.operations.signerKey")}
        operationValue={signer.ed25519PublicKey}
      />
    );
  }

  if (signer.sha256Hash) {
    return (
      <KeyValueListItem
        operationKey={t("signTransactionDetails.operations.signerSha256Hash")}
        operationValue={signerKeyToHex(signer.sha256Hash)}
      />
    );
  }

  if (signer.preAuthTx) {
    return (
      <KeyValueListItem
        operationKey={t("signTransactionDetails.operations.preAuthTransaction")}
        operationValue={signerKeyToHex(signer.preAuthTx)}
      />
    );
  }

  if (signer.ed25519SignedPayload) {
    return (
      <KeyValueListItem
        operationKey={t("signTransactionDetails.operations.signedPayload")}
        operationValue={signer.ed25519SignedPayload}
      />
    );
  }
  return <View />;
};
