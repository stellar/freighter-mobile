import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { TokenIcon } from "components/TokenIcon";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";

const HELP_ARTICLE_URL =
  "https://help.freighter.app/article/xjlva9dxov-how-much-xlm-do-i-need-in-my-wallet";

export interface XlmReserveBottomSheetProps {
  publicKey: string;
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
  /**
   * Destination token code (e.g. "AQUA") — interpolated into the title body
   * and the info-card body ("To receive AQUA, your wallet needs a trustline
   * on Stellar.").
   */
  tokenCode?: string;
  /**
   * Controls whether the "Swap for 0.5 XLM" CTA is rendered. The parent
   * computes this from the user's held balances — true when there's at
   * least one non-XLM classic balance the user can swap from.
   */
  canOfferSwapToXlm: boolean;
  /**
   * Async handler invoked when the user taps "Swap for 0.5 XLM". The
   * parent picks the best non-XLM classic balance, calls Horizon's
   * strictReceivePaths to size the swap, sets source/destination/amount
   * on the swap store, and dismisses this sheet. The sheet just tracks
   * the local pending state for the Button's loading spinner.
   */
  onSwapForXlm?: () => void | Promise<void>;
}

export const XlmReserveBottomSheet: React.FC<XlmReserveBottomSheetProps> = ({
  publicKey,
  bottomSheetModalRef,
  tokenCode,
  canOfferSwapToXlm,
  onSwapForXlm,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { copyToClipboard } = useClipboard();
  const { open: openInAppBrowser } = useInAppBrowser();
  const [isSwapping, setIsSwapping] = useState(false);

  const interpolation = { tokenCode: tokenCode ?? "" };

  const handleSwapForXlm = async () => {
    if (!onSwapForXlm || isSwapping) return;
    setIsSwapping(true);
    try {
      await onSwapForXlm();
    } finally {
      setIsSwapping(false);
    }
  };

  const handleCopyAddress = () => {
    copyToClipboard(publicKey, {
      notificationMessage: t("accountAddressCopied"),
    });
  };

  const handleWhyXlm = () => {
    openInAppBrowser(HELP_ARTICLE_URL);
  };

  const handleClose = () => {
    bottomSheetModalRef?.current?.dismiss();
  };

  return (
    <View className="gap-[24px]">
      {/* Header: lilac plus-circle icon tile + circular X close */}
      <View className="flex-row items-center justify-between">
        <Icon.PlusCircle themeColor="lilac" withBackground square size={26} />
        <TouchableOpacity
          onPress={handleClose}
          className="size-9 items-center justify-center rounded-full bg-gray-3"
          testID="xlm-reserve-close"
        >
          <Icon.X size={20} color={themeColors.gray[9]} />
        </TouchableOpacity>
      </View>

      {/* Title + body with inline "Why do I need XLM?" link */}
      <View className="gap-[8px]">
        <Text xl medium>
          {t("swapScreen.xlmReserve.title")}
        </Text>
        <Text md regular secondary>
          {t("swapScreen.xlmReserve.bodyPrefix", interpolation)}
          <Text
            md
            medium
            color={themeColors.lilac[11]}
            onPress={handleWhyXlm}
            testID="xlm-reserve-why-link"
          >
            {t("swapScreen.xlmReserve.whyDoINeedXlm")}
          </Text>
        </Text>
      </View>

      {/* Info card: XLM icon on the left, "0.5 XLM required" title and the
          per-token body on the right. Title + body line-heights provide the
          vertical rhythm — no explicit gap between the two text lines. */}
      <View className="rounded-[16px] bg-background-tertiary p-4 flex-row items-center gap-3">
        <TokenIcon
          token={{ type: "native", code: NATIVE_TOKEN_CODE }}
          size="lg"
        />
        <View className="flex-1">
          <Text sm medium primary>
            {t("swapScreen.xlmReserve.infoCardTitle")}
          </Text>
          <Text xs medium secondary>
            {t("swapScreen.xlmReserve.infoCardBody", interpolation)}
          </Text>
        </View>
      </View>

      {/* CTAs — "Swap for 0.5 XLM" (tertiary per design system mapping) is
          shown only when the parent says the user has a non-XLM classic
          balance to swap from. "Copy my wallet address" is always shown. */}
      {canOfferSwapToXlm && (
        <Button
          onPress={handleSwapForXlm}
          tertiary
          isLoading={isSwapping}
          testID="xlm-reserve-swap-button"
        >
          {t("swapScreen.xlmReserve.swapXlm")}
        </Button>
      )}
      <Button onPress={handleCopyAddress} minimal>
        {t("swapScreen.xlmReserve.copyAddress")}
      </Button>
    </View>
  );
};

export default XlmReserveBottomSheet;
