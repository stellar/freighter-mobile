import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { AccountQrDisplay } from "components/AccountQrDisplay";
import { Button, IconPosition } from "components/sds/Button";
import { BUTTON_THEME } from "components/sds/Button/theme";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export interface ReceiveFundsBottomSheetProps {
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
}

/**
 * In-flow "Receive funds" sheet (design node `9457:46184`) -- opened from
 * "Transfer from another account" on both the token picker's
 * `NotEnoughTokenBottomSheet` and the amount screen's
 * `XlmFeeShortfallBottomSheet`. Previously that action navigated cross-stack
 * to `ROOT_NAVIGATOR_ROUTES.SCAN_RECEIVE_SCREEN`, ejecting the user from
 * Earn entirely; this sheet is presented on top of whichever sheet triggered
 * it (mirrors the review sheet's own security-detail sheet, and the mock
 * itself, which composites this sheet directly over the fee sheet) so
 * dismissing it always lands back exactly where the user was, still inside
 * Earn.
 *
 * Shares `AccountQrDisplay` (avatar/name/address + QR + network pill) with
 * `ScanReceiveScreen`'s Receive tab -- see that component's own doc for why
 * the copy action isn't folded into it. This sheet's copy action uses the
 * same plain `useClipboard` the screen uses -- a receive address is public
 * and is copied precisely so the user can paste it elsewhere, often well
 * after `useSecureClipboard`'s 30s auto-clear window, so the two surfaces
 * behave identically here.
 *
 * Pure content, following this feature's convention: the caller wraps this
 * in `components/BottomSheet` and owns the modal ref, passed through here
 * only so the close control can dismiss it.
 */
export const ReceiveFundsBottomSheet: React.FC<
  ReceiveFundsBottomSheetProps
> = ({ bottomSheetModalRef }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { copyToClipboard } = useClipboard();

  const publicKey = account?.publicKey ?? "";

  const handleClose = () => {
    bottomSheetModalRef?.current?.dismiss();
  };

  const handleCopy = () => {
    copyToClipboard(publicKey);
  };

  return (
    <View testID="receive-funds-bottom-sheet">
      <View className="relative items-center mb-8">
        <Text lg medium primary textAlign="center">
          {t("earnReceiveFunds.title")}
        </Text>
        <TouchableOpacity
          onPress={handleClose}
          className="absolute right-0 top-0"
          testID="receive-funds-close"
        >
          <Icon.X
            color={themeColors.foreground.secondary}
            size={22}
            circle
            circleBackground={themeColors.background.tertiary}
          />
        </TouchableOpacity>
      </View>

      <AccountQrDisplay
        publicKey={publicKey}
        accountName={account?.accountName}
        testID="receive-funds-account-qr"
      />

      {/* Design rhythm (node `9457:46184`): network pill -> 32 -> footnote ->
          16 -> CTA. `mt-8` (32) and `gap-4` (16) below match that exactly --
          this block isn't shared with `ReceiveTabView` (see
          `AccountQrDisplay`'s doc comment for why the CTA stays
          caller-owned), so there's no existing treatment to stay
          consistent with here. */}
      <View className="mt-8 gap-4">
        <Text md medium secondary textAlign="center">
          {t("scanReceiveScreen.receive.networkSupport")}
        </Text>
        <Button
          isFullWidth
          tertiary
          icon={
            <Icon.Copy01 size={18} color={BUTTON_THEME.colors.tertiary.text} />
          }
          iconPosition={IconPosition.LEFT}
          onPress={handleCopy}
          testID="receive-funds-copy-button"
        >
          {t("scanReceiveScreen.receive.copyButton")}
        </Button>
      </View>
    </View>
  );
};

export default ReceiveFundsBottomSheet;
