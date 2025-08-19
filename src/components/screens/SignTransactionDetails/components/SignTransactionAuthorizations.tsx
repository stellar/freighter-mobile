import { xdr } from "@stellar/stellar-sdk";
import {
  KeyValueInvokeHostFnArgs,
  KeyValueList,
} from "components/screens/SignTransactionDetails/components/KeyVal";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { getInvocationDetails, InvocationArgs } from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import { useClipboard } from "hooks/useClipboard";
import { t } from "i18next";
import React from "react";
import { View } from "react-native";

interface SignTransactionAuthorizationsProps {
  authEntries: xdr.SorobanAuthorizedInvocation[];
}

const SignTransactionAuthorizations = ({
  authEntries,
}: SignTransactionAuthorizationsProps) => {
  const { copyToClipboard } = useClipboard();

  const getAuthEntryTitle = (detail: InvocationArgs) => {
    switch (detail.type) {
      case "invoke": {
        return detail.fnName;
      }
      case "sac":
      case "wasm": {
        return t("signTransactionDetails.authorizations.contractCreation");
      }
      default: {
        return null;
      }
    }
  };

  const getAuthEntryKey = (detail: InvocationArgs) => {
    switch (detail.type) {
      case "invoke": {
        return detail.fnName;
      }
      case "sac":
        return detail.asset;
      case "wasm":
        return detail.hash;
      default:
        return null;
    }
  };

  const getAuthEntryContent = (detail: InvocationArgs) => {
    switch (detail.type) {
      case "invoke": {
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
      case "sac": {
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
            <KeyValueList
              operationKey={t("common.asset")}
              operationValue={truncateAddress(detail.asset)}
            />
            {detail.args && <KeyValueInvokeHostFnArgs args={detail.args} />}
          </View>
        );
      }
      case "wasm": {
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
            <KeyValueList
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
            <KeyValueList
              operationKey={t("common.hash")}
              operationValue={truncateAddress(detail.hash)}
            />
            <KeyValueList
              operationKey={t("common.salt")}
              operationValue={truncateAddress(detail.salt)}
            />
            {detail.args && <KeyValueInvokeHostFnArgs args={detail.args} />}
          </View>
        );
      }
      default: {
        return null;
      }
    }
  };

  const renderAuthEntry = (authEntry: xdr.SorobanAuthorizedInvocation) => {
    const invocationDetails = getInvocationDetails(authEntry);

    return (
      <View className="gap-[12px]">
        {invocationDetails.map((detail) => (
          <View
            key={getAuthEntryKey(detail)}
            className="py-[12px] px-[16px] bg-background-tertiary rounded-[16px] gap-[12px]"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-[8px]">
                <Icon.CodeCircle01 size={16} themeColor="gray" />
                <Text>{getAuthEntryTitle(detail)}</Text>
              </View>

              <Icon.ChevronDown size={16} themeColor="gray" />
            </View>

            {/* Content */}
            {getAuthEntryContent(detail)}
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
      {authEntries.map((authEntry) => (
        <View key={authEntry.toXDR("raw").toString()}>
          {renderAuthEntry(authEntry)}
        </View>
      ))}
    </View>
  );
};

export default SignTransactionAuthorizations;
