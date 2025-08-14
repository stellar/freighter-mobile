/* eslint-disable @typescript-eslint/no-explicit-any */
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { List } from "components/List";
import { Badge } from "components/sds/Badge";
import { Banner } from "components/sds/Banner";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { formatAssetAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React, { useMemo } from "react";
import { View } from "react-native";

interface DappTransactionDetailBottomSheetContentProps {
  transactionDetails: any;
  onClose: () => void;
  isMalicious?: boolean;
  isSuspicious?: boolean;
}

export const DappTransactionDetailBottomSheetContent: React.FC<DappTransactionDetailBottomSheetContentProps> = ({ transactionDetails, onClose, isMalicious, isSuspicious }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();
  
  const summaryItems = useMemo(() => {
    return [
      {
        title: "Operations",
        trailingContent: <Text>1</Text>,
        titleColor: themeColors.text.secondary,
      },
      {
        title: "Fees",
        trailingContent: <Text>{formatAssetAmount(String(transactionDetails?.fee) ?? "0", NATIVE_TOKEN_CODE)}</Text>,
        titleColor: themeColors.text.secondary,
      },
      {
        title: "Sequence #",
        trailingContent: (
        <View className="flex-row items-center gap-[4px]">
          <Icon.Copy01 size={16} themeColor="gray" onPress={() => copyToClipboard(transactionDetails?.summary.sequence)} />
          <Text>{transactionDetails?.summary.sequence}</Text>
        </View>),
        titleColor: themeColors.text.secondary,
      },
      {
        title: "XDR",
        trailingContent: (
          <View className="flex-row items-center gap-[4px]">
          <Icon.Copy01 size={16} themeColor="gray" onPress={() => copyToClipboard(transactionDetails?.summary.xdr)} />
          <Text>{transactionDetails?.summary.xdr}</Text>
        </View>),
        titleColor: themeColors.text.secondary,
      }
    ];
  }, [transactionDetails, t]);

  const invokeHostFunctionItems = useMemo(() => {
    return [
      {
        title: "Type",
        trailingContent: <Text>Invoke Contract</Text>,
        titleColor: themeColors.text.secondary,
      },
      {
        title: "Contract ID",
        trailingContent: (
          <View className="flex-row items-center gap-[4px]">
          <Icon.Copy01 size={16} themeColor="gray" onPress={() => copyToClipboard("CCLBPEYS3XFK65MYYXSBMOGKUI4ODN5S7SUZBGD7NALUQF64QILLX5B5")} />
          <Text>{truncateAddress("CCLBPEYS3XFK65MYYXSBMOGKUI4ODN5S7SUZBGD7NALUQF64QILLX5B5", 7, 0)}</Text>
        </View>),
        titleColor: themeColors.text.secondary,
      },
      {
        title: "Function Name",
        trailingContent: <Text>submit</Text>,
        titleColor: themeColors.text.secondary,
      }
    ];
  }, []);

  const invokeHostFunctionParametersItems = useMemo(() => {
    return [
      {
        titleComponent: (
          <View className="flex-row items-center gap-[8px]">
            <Text secondary>amount_in</Text>
            <Icon.Copy01 size={14} themeColor="gray" />
          </View>
        ),
        description: "100000000",
        descriptionColor: themeColors.text.primary,
        titleColor: themeColors.text.secondary,
      },
      {
        titleComponent: (
          <View className="flex-row items-center gap-[8px]">
            <Text secondary>amount_out_min</Text>
            <Icon.Copy01 size={14} themeColor="gray" />
          </View>
        ),
        description: "29380709",
        descriptionColor: themeColors.text.primary,
        titleColor: themeColors.text.secondary,
      },
      {
        titleComponent: (
          <View className="flex-row items-center gap-[8px]">
            <Text secondary>path</Text>
            <Icon.Copy01 size={14} themeColor="gray" />
          </View>
        ),
        description: `[ "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA", "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75" ]`,
        descriptionColor: themeColors.text.primary,
        titleColor: themeColors.text.secondary,
      },
      {
        titleComponent: (
          <View className="flex-row items-center gap-[8px]">
            <Text secondary>deadline</Text>
            <Icon.Copy01 size={14} themeColor="gray" />
          </View>
        ),
        description: "7849217234982404501",
        descriptionColor: themeColors.text.primary,
        titleColor: themeColors.text.secondary,
      },
    ];
  }, []);

  const renderBadge = () => {
    if (isMalicious) {
      return <Badge size="md" variant="error">Malicious</Badge>;
    }

    if (isSuspicious) {
      return <Badge size="md" variant="warning">Suspicious</Badge>;
    }

    return null;
  };
  
  return (
    <BottomSheetScrollView>
      <View className="flex-1 justify-center mt-2 gap-[16px]">
        {/* header */}
        <View className="flex-row items-center justify-between">
          <View className="rounded-[8px] bg-lilac-3 p-2">
            <Icon.List size={25} themeColor="lilac" />
          </View>
          <View className="">
            <Icon.XClose onPress={onClose} size={20} themeColor="gray" withBackground />
          </View>
        </View>
        {/* summary */}
        <View>
          <Text xl>{t("dappRequestBottomSheetContent.transactionDetails")}</Text>
          <List items={summaryItems} className="mt-[16px]" variant="secondary" />
        </View>
        { /* Authorization */}
        <View className="gap-[12px]">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Key02 size={16} themeColor="gray" />
            <Text secondary>Authorizations</Text>
          </View>
          {(isMalicious || isSuspicious) && (
            <Banner
              variant={isMalicious ? "error" : "warning"}
              text={
                isMalicious
                  ? "One or more authorizations are malicious"
                  : "One or more authorizations are suspicious"
              }
              showChevron={false}
            />
          )}
          {/* submit */}
          <View className="bg-background-tertiary rounded-[16px] px-[16px] py-[12px] gap-[12px]">
            {/* header */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-[8px]">
                <Icon.CodeCircle01 size={16} themeColor="gray" />
                <Text>submit</Text>
              </View>
              {renderBadge()}
            </View>
            {/* detail */ } 
            <View className="bg-background-secondary rounded-[16px] p-[16px] gap-[12px]">
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[8px]">
                  <Text secondary>Contract ID</Text>
                  <Icon.Copy01 size={14} themeColor="gray" />
                </View>
                <Text> 
                  CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH
                </Text>
              </View>
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[8px]">
                  <Text secondary>Function Name</Text>
                  <Icon.Copy01 size={14} themeColor="gray" />
                </View>
                <Text> 
                  submit
                </Text>
              </View>
            </View>
            {/* parameters */ }
            <View className="bg-background-secondary rounded-[16px] p-[16px] gap-[12px]">
              {/* header */}
              <View className="flex-row items-center gap-[8px]">
                <Icon.BracketsEllipses size={16} themeColor="gray" />
                <Text>Parameters</Text>
              </View>
              <View className="b bg-border-primary w-full h-[1px]" />
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[8px]">
                  <Text secondary>from</Text>
                  <Icon.Copy01 size={14} themeColor="gray" />
                </View>
                <Text> 
                GDF32CQINROD3E2LMCGZUDVMWTXCJFR5SBYVRJ7WAAIAS3P7DCVWZEFY
                </Text>
              </View>
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[8px]">
                  <Text secondary>spender</Text>
                  <Icon.Copy01 size={14} themeColor="gray" />
                </View>
                <Text> 
                GDF32CQINROD3E2LMCGZUDVMWTXCJFR5SBYVRJ7WAAIAS3P7DCVWZEFY
                </Text>
              </View>
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[8px]">
                  <Text secondary>to</Text>
                  <Icon.Copy01 size={14} themeColor="gray" />
                </View>
                <Text> 
                GDF32CQINROD3E2LMCGZUDVMWTXCJFR5SBYVRJ7WAAIAS3P7DCVWZEFY
                </Text>
              </View>
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[8px]">
                  <Text secondary>requests</Text>
                  <Icon.Copy01 size={14} themeColor="gray" />
                </View>
                <Text>{`- address: \nCDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC\namount: '97808238087'\nrequest_type: 2`}
                </Text>
              </View>
            </View>
          </View>
          {/* transfer */}
          <View className="bg-background-tertiary rounded-[16px] px-[16px] py-[12px] gap-[12px]">
            {/* header */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-[8px]">
                <Icon.CodeCircle01 size={16} themeColor="gray" />
                <Text>transfer</Text>
              </View>
              {renderBadge()}
            </View>
            {/* detail */ } 
            <View className="bg-background-secondary rounded-[16px] p-[16px] gap-[12px]">
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[8px]">
                  <Text secondary>Contract ID</Text>
                  <Icon.Copy01 size={14} themeColor="gray" />
                </View>
                <Text> 
                CDLZPEYS3XFK65MYYXSBMOGKUI4ODN5S7SUZBGD7NALUQF64QILLCYSC
                </Text>
              </View>
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[8px]">
                  <Text secondary>Function Name</Text>
                  <Icon.Copy01 size={14} themeColor="gray" />
                </View>
                <Text> 
                  transfer
                </Text>
              </View>
            </View>
            {/* parameters */ }
            <View className="bg-background-secondary rounded-[16px] p-[16px] gap-[12px]">
              {/* header */}
              <View className="flex-row items-center gap-[8px]">
                <Icon.BracketsEllipses size={16} themeColor="gray" />
                <Text>Parameters</Text>
              </View>
              <View className="b bg-border-primary w-full h-[1px]" />
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[8px]">
                  <Icon.Copy01 size={14} themeColor="gray" />
                </View>
                <Text> 
                GDF32CQINROD3E2LMCGZUDVMWTXCJFR5SBYVRJ7WAAIAS3P7DCVWZEFY
                </Text>
              </View>
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[8px]">
                  <Icon.Copy01 size={14} themeColor="gray" />
                </View>
                <Text> 
                CCLBPEYS3XFK65MYYXSBMOGKUI4ODN5S7SUZBGD7NALUQF64QILLX5B5
                </Text>
              </View>
              <View className="gap-[8px]">
                <View className="flex-row items-center gap-[8px]">
                  <Icon.Copy01 size={14} themeColor="gray" />
                </View>
                <Text> 
                97808238087
                </Text>
              </View>
            </View>
          </View>
          { /* TODO: map other authorization types/operations */}
        </View>
        {/* invoke function */}
        <View className="gap-[12px] mt-[12px]">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Cube02 size={16} themeColor="gray" />
            <Text secondary>Invoke Host Function</Text>
          </View>
          <List items={invokeHostFunctionItems} variant="secondary" />
        </View>
        {/* parameters */}
        <View className="gap-[12px] mt-[12px]">
          <View className="flex-row items-center gap-[8px]">
            <Icon.BracketsEllipses size={16} themeColor="gray" />
            <Text secondary>Parameters</Text>
          </View>
          <List items={invokeHostFunctionParametersItems} variant="secondary" />
        </View>
      </View>
    </BottomSheetScrollView>
  );
};