import { BottomSheetHeader } from "components/BottomSheetHeader";
import { Button } from "components/sds/Button";
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
    <View className="flex-1 gap-[24px]">
      <BottomSheetHeader
        title={t("transactionAmountScreen.errors.muxedAddressWarning.title")}
        onClose={onClose}
      />
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
