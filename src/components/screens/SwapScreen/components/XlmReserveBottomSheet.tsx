import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomSheetHeader } from "components/BottomSheetHeader";
import { TokenIcon } from "components/TokenIcon";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE, UNFUNDED_ACCOUNT_HELP_URL } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useState } from "react";
import { View } from "react-native";

export interface XlmReserveBottomSheetProps {
  publicKey: string;
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
  /** Destination token code (e.g. "AQUA") interpolated into the title and info-card body. */
  tokenCode?: string;
  /** When true, renders the "Swap for 0.5 XLM" CTA. */
  canOfferSwapToXlm: boolean;
  /** Async handler for the "Swap for 0.5 XLM" CTA; the sheet tracks local pending state for the spinner. */
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
    openInAppBrowser(UNFUNDED_ACCOUNT_HELP_URL);
  };

  const handleClose = () => {
    bottomSheetModalRef?.current?.dismiss();
  };

  return (
    <View className="gap-[24px]">
      {/* Stacked layout from the "Not enough XLM" frame: the XLM token icon
          leads the top row, the X sits on the right, the title below. */}
      <BottomSheetHeader
        title={t("swapScreen.xlmReserve.title")}
        leading={
          <TokenIcon token={{ type: "native", code: NATIVE_TOKEN_CODE }} />
        }
        onClose={handleClose}
        closeTestID="xlm-reserve-close"
      />

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

      {canOfferSwapToXlm && (
        <Button
          onPress={handleSwapForXlm}
          secondary
          isLoading={isSwapping}
          testID="xlm-reserve-swap-button"
        >
          {t("swapScreen.xlmReserve.swapXlm")}
        </Button>
      )}
      <Button onPress={handleCopyAddress} tertiary>
        {t("swapScreen.xlmReserve.copyAddress")}
      </Button>
    </View>
  );
};

export default XlmReserveBottomSheet;
