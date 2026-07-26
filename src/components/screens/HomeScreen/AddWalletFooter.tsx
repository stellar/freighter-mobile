import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AddWalletFooterProps {
  onPress: () => void;
  disabled?: boolean;
}

/**
 * "Add wallet" row pinned under the manage-accounts sheet's scrollable
 * content (rendered via the BottomSheet wrapper's scrollViewFooterComponent).
 * It owns the safe-area bottom padding and needs an opaque background for
 * the account list to scroll underneath it cleanly.
 */
export const AddWalletFooter: React.FC<AddWalletFooterProps> = ({
  onPress,
  disabled = false,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-background-primary px-6 pt-[10px]"
      style={{ paddingBottom: insets.bottom + pxValue(DEFAULT_PADDING) }}
    >
      <TouchableOpacity
        className="flex-row items-center gap-[16px] w-full"
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        testID="manage-accounts-add-wallet-button"
      >
        <View className="w-[34px] h-[34px] rounded-full bg-lilac-2 justify-center items-center">
          <Icon.Plus size={14} color={themeColors.lilac[9]} />
        </View>
        <Text md medium color={themeColors.lilac[11]}>
          {t("home.manageAccount.addWallet")}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default AddWalletFooter;
