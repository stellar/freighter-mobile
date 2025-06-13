import { TokenSelectionContent } from "components/screens/SwapScreen/components";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface SelectTokenBottomSheetProps {
  onTokenSelect: (tokenId: string, tokenSymbol: string) => void;
  customTitle?: string;
  title?: string;
  onClose?: () => void;
}

const SelectTokenBottomSheet: React.FC<SelectTokenBottomSheetProps> = ({
  onTokenSelect,
  customTitle,
  title,
  onClose,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between mb-6">
        <Text xl medium>
          {title || t("swapScreen.swapTo")}
        </Text>
        {onClose && (
          <TouchableOpacity onPress={onClose}>
            <Icon.X size={24} color={themeColors.base[1]} />
          </TouchableOpacity>
        )}
      </View>

      <View className="h-px bg-gray-8 mb-6" />

      <View className="flex-1 px-4 pb-4">
        <TokenSelectionContent
          onTokenPress={onTokenSelect}
          showTitleIcon={false}
          customTitle={customTitle}
        />
      </View>
    </View>
  );
};

export default SelectTokenBottomSheet;
