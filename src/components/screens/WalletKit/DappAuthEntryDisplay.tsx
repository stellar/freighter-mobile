import { xdr } from "@stellar/stellar-sdk";
import { KeyValueInvokeHostFnArgs } from "components/screens/SignTransactionDetails/components/KeyVal";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { logger } from "config/logger";
import {
  getInvocationDetails,
  InvocationArgs,
  INVOCATION_TYPE_INVOKE,
  INVOCATION_TYPE_WASM,
} from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React, { useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";

interface DappAuthEntryDisplayProps {
  /** Base64-encoded SorobanAuthorizationEntry XDR */
  entryXdr: string;
  /** When true all invocation cards start expanded */
  expandAll?: boolean;
}

/**
 * Decodes a SorobanAuthorizationEntry XDR and renders each invocation as an
 * expandable card — matching the extension's AuthEntries component.
 *
 * Falls back to a scrollable raw-XDR view if parsing fails.
 */
export const DappAuthEntryDisplay: React.FC<DappAuthEntryDisplayProps> = ({
  entryXdr,
  expandAll = false,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();

  // Lazy initialiser: when expandAll, parse once to know how many indices exist
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(() => {
    if (!expandAll) return new Set();
    try {
      const entry = xdr.SorobanAuthorizationEntry.fromXDR(entryXdr, "base64");
      const d = getInvocationDetails(entry.rootInvocation());
      return new Set(d.map((_, i) => i));
    } catch {
      return new Set();
    }
  });

  let details: InvocationArgs[] = [];
  try {
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(entryXdr, "base64");
    details = getInvocationDetails(entry.rootInvocation());
  } catch (e) {
    logger.warn("DappAuthEntryDisplay", "Failed to parse auth entry XDR", {
      error: e,
    });
  }

  const toggleExpanded = (index: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const getDetailKey = (detail: InvocationArgs): string => {
    if (detail.type === INVOCATION_TYPE_INVOKE)
      return `invoke-${detail.contractId}-${detail.fnName}`;
    if (detail.type === INVOCATION_TYPE_WASM) return `wasm-${detail.hash}`;
    return `sac-${detail.asset}`;
  };

  const renderDetailTitle = (detail: InvocationArgs): string => {
    if (detail.type === INVOCATION_TYPE_INVOKE) return detail.fnName;
    return t("signTransactionDetails.authorizations.contractCreation");
  };

  const renderDetailContent = (detail: InvocationArgs) => {
    if (detail.type === INVOCATION_TYPE_INVOKE) {
      return (
        <View className="gap-[12px]">
          <View className="gap-[4px]">
            <Text sm secondary>
              {t("signTransactionDetails.authorizations.contractId")}
            </Text>
            <View className="flex-row items-center gap-[8px]">
              <Text sm primary style={{ flex: 1 }}>
                {truncateAddress(detail.contractId)}
              </Text>
              <Icon.Copy01
                size={14}
                themeColor="gray"
                onPress={() => copyToClipboard(detail.contractId)}
              />
            </View>
          </View>
          <View className="gap-[4px]">
            <Text sm secondary>
              {t("signTransactionDetails.authorizations.functionName")}
            </Text>
            <View className="flex-row items-center gap-[8px]">
              <Text sm primary style={{ flex: 1 }}>
                {detail.fnName}
              </Text>
              <Icon.Copy01
                size={14}
                themeColor="gray"
                onPress={() => copyToClipboard(detail.fnName)}
              />
            </View>
          </View>
          {detail.args.length > 0 && (
            <KeyValueInvokeHostFnArgs
              args={detail.args}
              contractId={detail.contractId}
              fnName={detail.fnName}
              variant="tertiary"
            />
          )}
        </View>
      );
    }

    if (detail.type === "wasm") {
      return (
        <View className="gap-[12px]">
          <View className="gap-[4px]">
            <Text sm secondary>
              {t("signTransactionDetails.authorizations.contractAddress")}
            </Text>
            <View className="flex-row items-center gap-[8px]">
              <Text sm primary style={{ flex: 1 }}>
                {truncateAddress(detail.address)}
              </Text>
              <Icon.Copy01
                size={14}
                themeColor="gray"
                onPress={() => copyToClipboard(detail.address)}
              />
            </View>
          </View>
          <View className="gap-[4px]">
            <Text sm secondary>
              {t("signTransactionDetails.operations.executableWasmHash")}
            </Text>
            <Text sm primary>
              {truncateAddress(detail.hash)}
            </Text>
          </View>
          <View className="gap-[4px]">
            <Text sm secondary>
              {t("signTransactionDetails.operations.salt")}
            </Text>
            <Text sm primary>
              {truncateAddress(detail.salt)}
            </Text>
          </View>
          {detail.args && detail.args.length > 0 && (
            <KeyValueInvokeHostFnArgs args={detail.args} variant="tertiary" />
          )}
        </View>
      );
    }

    // sac
    return (
      <View className="gap-[12px]">
        <View className="gap-[4px]">
          <Text sm secondary>
            {t("signTransactionDetails.operations.tokenCode")}
          </Text>
          <Text sm primary>
            {detail.asset}
          </Text>
        </View>
        {detail.args && detail.args.length > 0 && (
          <KeyValueInvokeHostFnArgs args={detail.args} variant="tertiary" />
        )}
      </View>
    );
  };

  return (
    <View testID="auth-entry-display" className="gap-[12px]">
      <View className="flex-row items-center gap-[8px]">
        <Icon.Key01 size={16} color={themeColors.text.secondary} />
        <Text sm secondary>
          {t("signTransactionDetails.authorizations.title")}
        </Text>
      </View>

      {details.length > 0 ? (
        details.map((detail, index) => {
          const isExpanded = expandedIndices.has(index);
          return (
            <View
              key={getDetailKey(detail)}
              className="rounded-[16px] overflow-hidden"
              style={{ backgroundColor: themeColors.background.secondary }}
              testID={`auth-entry-item-${index}`}
            >
              <TouchableOpacity
                className="flex-row items-center justify-between p-[16px]"
                onPress={() => toggleExpanded(index)}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-[8px] flex-1">
                  <Icon.CodeCircle01
                    size={16}
                    color={themeColors.foreground.primary}
                  />
                  <Text md primary style={{ flex: 1 }}>
                    {renderDetailTitle(detail)}
                  </Text>
                </View>
                <View
                  style={{
                    transform: [{ rotate: isExpanded ? "90deg" : "0deg" }],
                  }}
                >
                  <Icon.ChevronRight
                    size={16}
                    color={themeColors.text.secondary}
                  />
                </View>
              </TouchableOpacity>
              {isExpanded && (
                <View className="px-[16px] pb-[16px]">
                  {renderDetailContent(detail)}
                </View>
              )}
            </View>
          );
        })
      ) : (
        // Raw fallback when XDR parsing fails
        <View
          className="rounded-[16px] p-[16px] gap-[12px]"
          style={{ backgroundColor: themeColors.background.secondary }}
        >
          <View className="flex-row items-center gap-[8px]">
            <Icon.Code02 size={16} color={themeColors.text.secondary} />
            <Text sm secondary>
              {t("common.authEntry")}
            </Text>
          </View>
          <ScrollView style={{ maxHeight: 120 }}>
            <Text
              sm
              primary
              style={{ fontFamily: "monospace" }}
              testID="auth-entry-display-content"
            >
              {entryXdr}
            </Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
};
