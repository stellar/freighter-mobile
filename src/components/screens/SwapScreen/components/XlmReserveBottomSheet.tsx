import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { useSwapStore } from "ducks/swap";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useEffect } from "react";
import { View } from "react-native";
import { analytics } from "services/analytics";

const HELP_ARTICLE_URL =
  "https://help.freighter.app/article/xjlva9dxov-how-much-xlm-do-i-need-in-my-wallet";

export interface XlmReserveBottomSheetProps {
  publicKey: string;
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
}

export const XlmReserveBottomSheet: React.FC<XlmReserveBottomSheetProps> = ({
  publicKey,
  bottomSheetModalRef,
}) => {
  const { t } = useAppTranslation();
  const { setDestinationToken } = useSwapStore();
  const { copyToClipboard } = useClipboard();
  const { open: openInAppBrowser } = useInAppBrowser();

  useEffect(() => {
    analytics.track(AnalyticsEvent.SWAP_XLM_RESERVE_INSUFFICIENT_SHOWN);
  }, []);

  const handleSwapXlm = () => {
    setDestinationToken({
      id: "native",
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

  const handleCancel = () => {
    bottomSheetModalRef?.current?.dismiss();
  };

  return (
    <View className="gap-[16px] p-[4px]">
      <Text lg primary medium>
        {t("swapScreen.xlmReserve.title")}
      </Text>
      <Text md secondary>
        {t("swapScreen.xlmReserve.body")}
      </Text>
      <Button onPress={handleSwapXlm} primary>
        {t("swapScreen.xlmReserve.swapXlm")}
      </Button>
      <Button onPress={handleCopyAddress} secondary>
        {t("swapScreen.xlmReserve.copyAddress")}
      </Button>
      <Button onPress={handleWhyXlm} tertiary>
        {t("swapScreen.xlmReserve.whyDoINeedXlm")}
      </Button>
      <Button onPress={handleCancel} tertiary>
        {t("common.cancel")}
      </Button>
    </View>
  );
};

export default XlmReserveBottomSheet;
