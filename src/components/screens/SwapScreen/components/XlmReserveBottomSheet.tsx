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
    openInAppBrowser(HELP_ARTICLE_URL);
  };

  const handleClose = () => {
    bottomSheetModalRef?.current?.dismiss();
  };

  return (
    <View className="gap-[24px]">
      <View className="flex-row items-center justify-between">
        <Icon.PlusCircle themeColor="lilac" withBackground square size={28} />
        <TouchableOpacity onPress={handleClose} testID="xlm-reserve-close">
          <Icon.X
            color={themeColors.foreground.secondary}
            size={22}
            circle
            circleBorder={themeColors.background.tertiary}
            circleBackground={themeColors.background.tertiary}
          />
        </TouchableOpacity>
      </View>

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
