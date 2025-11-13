import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

export interface MuxedAddressWarningBottomSheetProps {
  onCancel?: () => void;
  onClose: () => void;
}

/**
 * Bottom sheet component for warning about muxed address not being supported.
 * Follows the same structure as SecurityDetailBottomSheet with buttons stacked vertically.
 *
 * @example
 * <MuxedAddressWarningBottomSheet
 *   onCancel={handleCancel}
 *   onClose={handleClose}
 * />
 */
export const MuxedAddressWarningBottomSheet: React.FC<
  MuxedAddressWarningBottomSheetProps
> = ({ onCancel, onClose }) => {
  const { t } = useAppTranslation();

  return (
    <View className="flex-1 gap-[16px]">
      <View className="flex-row justify-between items-center">
        <View className="h-[40px] w-[40px] items-center justify-center rounded-[8px] bg-red-3 border border-red-6">
          <Icon.AlertOctagon themeColor="red" />
        </View>
        <View className="bg-background-tertiary rounded-full p-2 h-[32px] w-[32px] items-center justify-center">
          <Icon.XClose onPress={onClose} size={20} themeColor="gray" />
        </View>
      </View>
      <Text xl primary>
        {t("transactionAmountScreen.errors.muxedAddressWarning.title")}
      </Text>
      <Text md secondary regular>
        {t("transactionAmountScreen.errors.muxedAddressWarning.description")}
      </Text>

      <View className="gap-[12px]">
        {onCancel && (
          <Button xl isFullWidth onPress={onCancel} variant="destructive">
            {t("common.cancel")}
          </Button>
        )}
      </View>
    </View>
  );
};

export default MuxedAddressWarningBottomSheet;
