import { BottomSheetHeader } from "components/BottomSheetHeader";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

/**
 * What the sheet explains:
 * - `"account"`: an `M…` address the token doesn't support.
 * - `"contract"`: a `W…` address the token doesn't support.
 * - `"memo"`: a memo the token can't be sent with to this address.
 * - `"collectibleMemo"`: a memo the collectible can't be sent with to this
 *   address.
 * - `"numericMemo"`: a memo that isn't a number, for a token that only takes
 *   a numeric one.
 */
export type MuxedAddressWarningVariant =
  | "account"
  | "contract"
  | "memo"
  | "collectibleMemo"
  | "numericMemo";

const DESCRIPTION_KEYS = {
  account: "transactionAmountScreen.errors.muxedAddressWarning.description",
  contract: "transactionAmountScreen.errors.muxedContractWarning.description",
  memo: "transactionAmountScreen.errors.memoNotSupportedWarning.description",
  collectibleMemo:
    "transactionAmountScreen.errors.memoNotSupportedWarning.collectibleDescription",
  numericMemo: "transaction.errors.nonNumericMemoNotSupported",
} as const;

export interface MuxedAddressWarningBottomSheetProps {
  onCancel?: () => void;
  onClose: () => void;
  /**
   * What the sheet explains (see `MuxedAddressWarningVariant`). Defaults to
   * `"account"`, an `M…` address.
   */
  variant?: MuxedAddressWarningVariant;
}

/**
 * Bottom sheet that explains why a send is blocked: a muxed address the token
 * doesn't support, or a memo it can't be sent with.
 * Follows the same structure as SecurityDetailBottomSheet with buttons stacked vertically.
 *
 * The `M…` and `W…` variants share the "Muxed address not supported" title,
 * and the memo variants share "Memo not supported". The description depends on
 * the variant (see `MuxedAddressWarningVariant`).
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
  const isMuxedAddressVariant = variant === "account" || variant === "contract";

  return (
    <View className="flex-1 gap-[24px]">
      <BottomSheetHeader
        title={
          isMuxedAddressVariant
            ? t("transactionAmountScreen.errors.muxedAddressWarning.title")
            : t("transactionAmountScreen.errors.memoNotSupported")
        }
        onClose={onClose}
        closeTestID="muxed-address-warning-close-button"
      />
      <Text md secondary regular>
        {t(DESCRIPTION_KEYS[variant])}
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
