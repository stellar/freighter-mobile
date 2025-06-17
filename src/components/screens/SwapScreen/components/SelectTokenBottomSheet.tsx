import { TokenSelectionContent } from "components/screens/SwapScreen/components";
import TokenContextMenu from "components/screens/SwapScreen/components/TokenContextMenu";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { PricedBalance } from "config/types";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface SelectTokenBottomSheetProps {
  onTokenSelect: (tokenId: string, tokenSymbol: string) => void;
  customTitle?: string;
  title?: string;
  onClose?: () => void;
  network: NETWORKS;
}

const SelectTokenBottomSheet: React.FC<SelectTokenBottomSheetProps> = ({
  onTokenSelect,
  customTitle,
  title,
  onClose,
  network,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const renderTokenContextMenu = (balance: PricedBalance) => (
    <TokenContextMenu balance={balance} network={network} />
  );

  return (
    <View className="flex-1">
      <View className="relative flex-row items-center justify-center mb-8">
        {onClose && (
          <TouchableOpacity onPress={onClose} className="absolute left-0">
            <Icon.X size={24} color={themeColors.base[1]} />
          </TouchableOpacity>
        )}
        <Text md medium semiBold>
          {title || t("swapScreen.swapTo")}
        </Text>
      </View>

      <View className="flex-1">
        <TokenSelectionContent
          onTokenPress={onTokenSelect}
          showTitleIcon={false}
          customTitle={customTitle}
          renderRightContent={renderTokenContextMenu}
        />
      </View>
    </View>
  );
};

export default SelectTokenBottomSheet;
