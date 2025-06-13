import { TokenSelectionContent } from "components/screens/SwapScreen/components";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface SelectTokenBottomSheetProps {
  onTokenSelect: (tokenId: string, tokenSymbol: string) => void;
}

const SelectTokenBottomSheet: React.FC<SelectTokenBottomSheetProps> = ({
  onTokenSelect,
}) => {
  const { t } = useAppTranslation();

  return (
    <View className="flex-1 px-4 pb-4">
      <View className="mb-4">
        <Text lg medium>
          {t("swapScreen.selectAsset")}
        </Text>
      </View>
      <TokenSelectionContent
        onTokenPress={onTokenSelect}
        showTitleIcon={false}
      />
    </View>
  );
};

export default SelectTokenBottomSheet;
