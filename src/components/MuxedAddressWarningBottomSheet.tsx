import { BottomSheetHeader } from "components/BottomSheetHeader";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

export interface MuxedAddressWarningBottomSheetProps {
  onCancel?: () => void;
  onClose: () => void;
  /**
   * The kind of muxed address the sheet explains. `"account"` (the default)
   * is an `M…` address, and `"contract"` is a `W…` address.
   */
  variant?: "account" | "contract";
}

/**
 * Bottom sheet component for warning about a muxed address not being supported.
 * Follows the same structure as SecurityDetailBottomSheet with buttons stacked vertically.
 *
 * The title is the same for both variants. The description names the address
 * kind: an `M…` that could lose the token in the transfer (`"account"`), or a
 * `W…` the token does not support as a destination (`"contract"`).
 *
 * @example
 * <MuxedAddressWarningBottomSheet
 *   variant="contract"
 *   onCancel={handleCancel}
 *   onClose={handleClose}
 * />
 */
export const MuxedAddressWarningBottomSheet: React.FC<
  MuxedAddressWarningBottomSheetProps
> = ({ onCancel, onClose, variant = "account" }) => {
  const { t } = useAppTranslation();

  return (
    <View className="flex-1 gap-[24px]">
      <BottomSheetHeader
        title={t("transactionAmountScreen.errors.muxedAddressWarning.title")}
        onClose={onClose}
        closeTestID="muxed-address-warning-close-button"
      />
      <Text md secondary regular>
        {variant === "contract"
          ? t("transactionAmountScreen.errors.muxedContractWarning.description")
          : t("transactionAmountScreen.errors.muxedAddressWarning.description")}
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
