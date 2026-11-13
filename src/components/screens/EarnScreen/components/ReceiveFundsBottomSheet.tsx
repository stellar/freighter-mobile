import { AccountQrCode } from "components/AccountQrDisplay";
import { BottomSheetHeader } from "components/BottomSheetHeader";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React from "react";
import { View } from "react-native";

/** The QR before its card's 14pt padding, so the card is 240 across. */
const RECEIVE_QR_SIZE = 212;

export interface ReceiveFundsBottomSheetProps {
  /** Returns to the sheet this one was opened over. */
  onBack: () => void;
  /** Closes this sheet and the one it was opened over. */
  onClose: () => void;
}

/**
 * In-flow "Receive funds" sheet, opened from "Receive" on the token picker's
 * `NotEnoughTokenBottomSheet` and the amount screen's
 * `XlmFeeShortfallBottomSheet`. It is presented on top of the sheet that
 * opened it, so the user never leaves Earn: back returns to that sheet, and
 * X closes both.
 *
 * The copy action uses the same plain `useClipboard` as the Receive screen: a
 * receive address is public and is copied precisely so the user can paste it
 * elsewhere, often well after `useSecureClipboard`'s 30s auto-clear window.
 *
 * Pure content, following this feature's convention: the caller wraps this
 * in `components/BottomSheet` and owns the modal refs.
 */
export const ReceiveFundsBottomSheet: React.FC<
  ReceiveFundsBottomSheetProps
> = ({ onBack, onClose }) => {
  const { t } = useAppTranslation();
  const { account } = useGetActiveAccount();
  const { copyToClipboard } = useClipboard();

  const publicKey = account?.publicKey ?? "";

  const handleCopy = () => {
    copyToClipboard(publicKey);
  };

  return (
    <View className="gap-[24px]" testID="receive-funds-bottom-sheet">
      <BottomSheetHeader
        title={t("earnReceiveFunds.title")}
        layout="centered"
        onBack={onBack}
        backTestID="receive-funds-back"
        onClose={onClose}
        closeTestID="receive-funds-close"
      />

      <View className="items-center gap-[16px]">
        <View testID="receive-funds-qr">
          <AccountQrCode publicKey={publicKey} size={RECEIVE_QR_SIZE} />
        </View>
        <Text md regular secondary textAlign="center">
          {t("earnReceiveFunds.networkSupport")}
        </Text>
      </View>

      <Button
        isFullWidth
        secondary
        xl
        icon={<Icon.Copy01 size={18} />}
        iconPosition={IconPosition.LEFT}
        onPress={handleCopy}
        testID="receive-funds-copy-button"
      >
        {t("earnReceiveFunds.copyAddress")}
      </Button>
    </View>
  );
};

export default ReceiveFundsBottomSheet;
