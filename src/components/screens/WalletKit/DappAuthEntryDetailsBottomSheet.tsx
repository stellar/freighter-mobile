import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import BottomSheetAdaptiveContainer from "components/primitives/BottomSheetAdaptiveContainer";
import { DappAuthEntryDisplay } from "components/screens/WalletKit/DappAuthEntryDisplay";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface DappAuthEntryDetailsBottomSheetProps {
  entryXdr: string;
  onDismiss: () => void;
}

const DappAuthEntryDetailsBottomSheet: React.FC<
  DappAuthEntryDetailsBottomSheetProps
> = ({ entryXdr, onDismiss }) => {
  const { t } = useAppTranslation();

  return (
    <View className="flex-1 gap-[16px] w-full">
      <BottomSheetAdaptiveContainer
        header={
          <View className="w-full gap-[16px]">
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
            <Text xl>
              {t("dappRequestBottomSheetContent.authEntryDetails")}
            </Text>
          </View>
        }
      >
        <BottomSheetScrollView
          className="w-full"
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
          contentContainerStyle={{
            gap: pxValue(16),
            paddingBottom: pxValue(64),
          }}
        >
          <DappAuthEntryDisplay entryXdr={entryXdr} expandAll />
        </BottomSheetScrollView>
      </BottomSheetAdaptiveContainer>
    </View>
  );
};

export default DappAuthEntryDetailsBottomSheet;
