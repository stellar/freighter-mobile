import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import SignTransactionAuthorizations from "components/screens/SignTransactionDetails/components/SignTransactionAuthorizations";
import SignTransactionOperationDetails from "components/screens/SignTransactionDetails/components/SignTransactionOperationDetails";
import SignTransactionSummary from "components/screens/SignTransactionDetails/components/SignTransactionSummary";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface SignTransactionDetailsBottomSheetProps {
  data: SignTransactionDetailsInterface;
  onDismiss: () => void;
}

const SignTransactionDetailsBottomSheet = ({
  data,
  onDismiss,
}: SignTransactionDetailsBottomSheetProps) => {
  const { t } = useAppTranslation();

  return (
    <View className="gap-[16px] w-full pb-[64px]">
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <View className="bg-lilac-3 p-[7px] rounded-[8px]">
          <Icon.List size={25} themeColor="lilac" />
        </View>
        <Icon.XClose
          size={20}
          themeColor="gray"
          onPress={onDismiss}
          withBackground
        />
      </View>
      <Text xl>{t("signTransactionDetails.title")}</Text>
      <BottomSheetScrollView
        className="w-full gap-[24px]"
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        contentContainerStyle={{
          gap: pxValue(16),
          paddingBottom: pxValue(64),
        }}
      >
        <SignTransactionSummary summary={data.summary} />
        <SignTransactionAuthorizations authEntries={data.authEntries} />
        <SignTransactionOperationDetails operations={data.operations} />
      </BottomSheetScrollView>
    </View>
  );
};

export default SignTransactionDetailsBottomSheet;
