/* eslint-disable react/no-array-index-key */
import CollapsibleSection from "components/CollapsibleSection";
import {
  ExternalExecutableNote,
  KeyValueListItem,
  KeyValueInvokeHostFnArgs,
} from "components/screens/SignTransactionDetails/components/KeyVal";
import { AuthEntryDisplay } from "components/screens/SignTransactionDetails/types";
import { Banner } from "components/sds/Banner";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  getInvocationDetails,
  InvocationArgs,
  INVOCATION_TYPE_EXTERNAL_REF,
  INVOCATION_TYPE_INVOKE,
  INVOCATION_TYPE_SAC,
  INVOCATION_TYPE_UNRECOGNIZED,
  INVOCATION_TYPE_WASM,
} from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import { useClipboard } from "hooks/useClipboard";
import { t } from "i18next";
import React from "react";
import { View } from "react-native";

interface SignTransactionAuthorizationsProps {
  authEntries: AuthEntryDisplay[];
}

const SignTransactionAuthorizations = ({
  authEntries,
}: SignTransactionAuthorizationsProps) => {
  const { copyToClipboard } = useClipboard();

  const getAuthEntryTitle = (detail: InvocationArgs) => {
    switch (detail.type) {
      case INVOCATION_TYPE_INVOKE: {
        return detail.fnName;
      }
      case INVOCATION_TYPE_SAC:
      case INVOCATION_TYPE_WASM:
      case INVOCATION_TYPE_EXTERNAL_REF: {
        return t("signTransactionDetails.authorizations.contractCreation");
      }
      case INVOCATION_TYPE_UNRECOGNIZED: {
        return t(
          "signTransactionDetails.authorizations.unrecognizedInvocation",
        );
      }
      default: {
        return null;
      }
    }
  };

  const getAuthEntryKey = (detail: InvocationArgs) => {
    switch (detail.type) {
      case INVOCATION_TYPE_INVOKE: {
        return `${detail.type}-${detail.contractId}-${detail.fnName}`;
      }
      case INVOCATION_TYPE_SAC:
        return `${detail.type}-${detail.asset}`;
      case INVOCATION_TYPE_WASM:
        return `${detail.type}-${detail.hash}`;
      case INVOCATION_TYPE_EXTERNAL_REF:
        return `${detail.type}-${detail.owner}-${detail.tag}`;
      case INVOCATION_TYPE_UNRECOGNIZED:
        return detail.type;
      default:
        return `unknown-${JSON.stringify(detail)}`;
    }
  };

  const getAuthEntryContent = (detail: InvocationArgs) => {
    switch (detail.type) {
      case INVOCATION_TYPE_INVOKE: {
        return (
          <View className="gap-[12px]">
            <View className="bg-background-secondary rounded-[16px] p-[16px] gap-[12px]">
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[4px]">
                  <Text secondary>
                    {t("signTransactionDetails.authorizations.contractId")}
                  </Text>
                  <Icon.Copy01
                    size={14}
                    themeColor="gray"
                    onPress={() => copyToClipboard(detail.contractId)}
                  />
                </View>
                <Text>{detail.contractId}</Text>
              </View>
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[4px]">
                  <Text secondary>
                    {t("signTransactionDetails.authorizations.functionName")}
                  </Text>
                  <Icon.Copy01
                    size={14}
                    themeColor="gray"
                    onPress={() => copyToClipboard(detail.fnName)}
                  />
                </View>
                <Text>{detail.fnName}</Text>
              </View>
            </View>
            <KeyValueInvokeHostFnArgs
              args={detail.args}
              contractId={detail.contractId}
              fnName={detail.fnName}
            />
          </View>
        );
      }
      case INVOCATION_TYPE_SAC: {
        return (
          <View className="gap-[12px]">
            <View className="bg-background-secondary rounded-[16px] p-[16px] gap-[12px]">
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[4px]">
                  <Icon.CodeSnippet01 size={14} themeColor="gray" />
                  <Text secondary>
                    {t(
                      "signTransactionDetails.authorizations.contractCreation",
                    )}
                  </Text>
                </View>
              </View>
            </View>
            <KeyValueListItem
              operationKey={t("common.token")}
              operationValue={truncateAddress(detail.asset)}
            />
            {detail.args && <KeyValueInvokeHostFnArgs args={detail.args} />}
          </View>
        );
      }
      case INVOCATION_TYPE_WASM: {
        return (
          <View className="gap-[12px]">
            <View className="bg-background-secondary rounded-[16px] p-[16px] gap-[12px]">
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[4px]">
                  <Icon.CodeSnippet01 size={14} themeColor="gray" />
                  <Text secondary>
                    {t(
                      "signTransactionDetails.authorizations.contractCreation",
                    )}
                  </Text>
                </View>
              </View>
            </View>
            <KeyValueListItem
              operationKey={t(
                "signTransactionDetails.authorizations.contractAddress",
              )}
              operationValue={
                <View className="flex-row items-center gap-[4px]">
                  <Text>{truncateAddress(detail.address)}</Text>
                  <Icon.Copy01
                    size={14}
                    themeColor="gray"
                    onPress={() => copyToClipboard(detail.address)}
                  />
                </View>
              }
            />
            <KeyValueListItem
              operationKey={t("common.hash")}
              operationValue={truncateAddress(detail.hash)}
            />
            <KeyValueListItem
              operationKey={t("common.salt")}
              operationValue={truncateAddress(detail.salt)}
            />
            {detail.args && <KeyValueInvokeHostFnArgs args={detail.args} />}
          </View>
        );
      }
      // CAP-85 (Protocol 28): contract created from an external executable
      // reference (owner contract + tag) instead of a Wasm hash.
      case INVOCATION_TYPE_EXTERNAL_REF: {
        return (
          <View className="gap-[12px]">
            <View className="bg-background-secondary rounded-[16px] p-[16px] gap-[12px]">
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[4px]">
                  <Icon.CodeSnippet01 size={14} themeColor="gray" />
                  <Text secondary>
                    {t(
                      "signTransactionDetails.authorizations.contractCreation",
                    )}
                  </Text>
                </View>
              </View>
            </View>
            <ExternalExecutableNote />
            <KeyValueListItem
              operationKey={t(
                "signTransactionDetails.authorizations.contractAddress",
              )}
              operationValue={
                <View className="flex-row items-center gap-[4px]">
                  <Text>{truncateAddress(detail.address)}</Text>
                  <Icon.Copy01
                    size={14}
                    themeColor="gray"
                    onPress={() => copyToClipboard(detail.address)}
                  />
                </View>
              }
            />
            <KeyValueListItem
              operationKey={t(
                "signTransactionDetails.authorizations.executableOwner",
              )}
              operationValue={
                <View className="flex-row items-center gap-[4px]">
                  <Text>{truncateAddress(detail.owner)}</Text>
                  <Icon.Copy01
                    size={14}
                    themeColor="gray"
                    onPress={() => copyToClipboard(detail.owner)}
                  />
                </View>
              }
            />
            <KeyValueListItem
              operationKey={t(
                "signTransactionDetails.authorizations.executableTag",
              )}
              operationValue={detail.tag}
            />
            <KeyValueListItem
              operationKey={t("common.salt")}
              operationValue={truncateAddress(detail.salt)}
            />
            {detail.args && <KeyValueInvokeHostFnArgs args={detail.args} />}
          </View>
        );
      }
      case INVOCATION_TYPE_UNRECOGNIZED: {
        return (
          <Banner
            variant="error"
            showChevron={false}
            testID="UnrecognizedInvocationWarning"
            text={t(
              "signTransactionDetails.authorizations.unrecognizedInvocationWarning",
            )}
          />
        );
      }
      default: {
        return null;
      }
    }
  };

  const renderAuthEntry = ({ invocation, boundAddress }: AuthEntryDisplay) => {
    const invocationDetails = getInvocationDetails(invocation);

    return (
      <View className="gap-[12px]">
        {boundAddress && (
          <KeyValueListItem
            operationKey={t("signTransactionDetails.authorizations.address")}
            operationValue={
              <View className="flex-row items-center gap-[4px]">
                <Text>{truncateAddress(boundAddress)}</Text>
                <Icon.Copy01
                  size={14}
                  themeColor="gray"
                  onPress={() => copyToClipboard(boundAddress)}
                />
              </View>
            }
          />
        )}
        {invocationDetails.map((detail, detailIndex) => (
          <View
            key={`${getAuthEntryKey(detail)}-${detailIndex}`}
            className="py-[12px] px-[16px] bg-background-tertiary rounded-[16px] gap-[12px]"
          >
            <CollapsibleSection
              header={
                <View className="flex-row items-center gap-[8px]">
                  <Icon.CodeCircle01 size={16} themeColor="gray" />
                  <Text>{getAuthEntryTitle(detail)}</Text>
                </View>
              }
              testID={`collapsible-auth-${getAuthEntryKey(detail)}-${detailIndex}`}
            >
              {getAuthEntryContent(detail)}
            </CollapsibleSection>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View>
      <View className="flex-row items-center gap-[8px] mb-[12px]">
        <Icon.Key02 size={16} themeColor="gray" />
        <Text secondary>
          {t("signTransactionDetails.authorizations.title")}
        </Text>
      </View>
      {authEntries.map((entry, index) => (
        <View key={`auth-entry-${index}-${entry.invocation.toXdr("base64")}`}>
          {renderAuthEntry(entry)}
        </View>
      ))}
    </View>
  );
};

export default SignTransactionAuthorizations;
