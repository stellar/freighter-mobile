import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { TokenIcon } from "components/TokenIcon";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { useSwapStore } from "ducks/swap";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React from "react";
import { TouchableOpacity, View } from "react-native";

const HELP_ARTICLE_URL =
  "https://help.freighter.app/article/xjlva9dxov-how-much-xlm-do-i-need-in-my-wallet";

export interface XlmReserveBottomSheetProps {
  publicKey: string;
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
  /**
   * Destination token code (e.g. "AQUA") — interpolated into the title body
   * and the info-card body to match Figma node 11821-35684 ("To receive
   * AQUA, your wallet needs a trustline on Stellar.").
   */
  tokenCode?: string;
}

export const XlmReserveBottomSheet: React.FC<XlmReserveBottomSheetProps> = ({
  publicKey,
  bottomSheetModalRef,
  tokenCode,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { setDestinationToken, sourceTokenId } = useSwapStore();
  const { copyToClipboard } = useClipboard();
  const { open: openInAppBrowser } = useInAppBrowser();

  // Don't offer "Swap for 0.5 XLM" when the user is already selling XLM —
  // flipping the destination to XLM would leave source === destination,
  // which path-finding rejects and strands the user.
  const canOfferSwapToXlm =
    sourceTokenId !== "native" && sourceTokenId !== NATIVE_TOKEN_CODE;

  const interpolation = { tokenCode: tokenCode ?? "" };

  const handleSwapXlm = () => {
    setDestinationToken({
      id: NATIVE_TOKEN_CODE,
      tokenCode: NATIVE_TOKEN_CODE,
      decimals: 7,
      tokenType: TokenTypeWithCustomToken.NATIVE,
      isNew: false,
    });
    bottomSheetModalRef?.current?.dismiss();
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
        <Icon.PlusCircle themeColor="lilac" withBackground square size={24} />
        <TouchableOpacity
          onPress={handleClose}
          className="size-8 items-center justify-center rounded-full bg-gray-3"
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

      {/* Info card: XLM icon + "0.5 XLM required" + interpolated body */}
      <View className="rounded-[16px] bg-background-tertiary px-[16px] py-[16px] flex-row items-center gap-[12px]">
        <TokenIcon
          token={{ type: "native", code: NATIVE_TOKEN_CODE }}
          size="sm"
        />
        <View className="flex-1 gap-[2px]">
          <Text sm medium primary>
            {t("swapScreen.xlmReserve.infoCardTitle")}
          </Text>
          <Text xs regular secondary>
            {t("swapScreen.xlmReserve.infoCardBody", interpolation)}
          </Text>
        </View>
      </View>

      {/* CTAs — "Swap for 0.5 XLM" (tertiary per design system mapping) and
          "Copy my wallet address" (minimal text-only treatment). */}
      {canOfferSwapToXlm && (
        <Button onPress={handleSwapXlm} tertiary>
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
