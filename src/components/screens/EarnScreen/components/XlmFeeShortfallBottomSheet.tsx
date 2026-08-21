import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { TokenIcon } from "components/TokenIcon";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export interface XlmFeeShortfallBottomSheetProps {
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
  /** Buy XLM via the onramp. Same destination as the token picker's
   *  `NotEnoughTokenBottomSheet` Buy button. */
  onBuy: () => void;
  /** Cross-stack jump to the global Receive screen -- a separate batch
   *  replaces this with an in-flow "Receive funds" QR sheet (design node
   *  `9457:46184`); this sheet just needs to call whatever handler the
   *  caller currently wires here. */
  onReceive: () => void;
}

/**
 * Sheet shown when the account has no XLM at all to cover the network fee
 * (the pre-simulation `needsXlmForFee` gate) -- distinct from the
 * measured-resource-fee shortfall, which stays a toast (`earnAmount.errors.
 * feeShortfall`/`insufficientBalanceForFee`) and is untouched by this
 * component.
 *
 * Previously the generic `InformationBottomSheet` with a single "Buy XLM"
 * action; this is a dedicated sheet matching design node `9457:45927`
 * exactly: the XLM asset icon (not an amber warning glyph), and **two**
 * stacked full-width actions -- "Buy with Coinbase" (light `tertiary` pill)
 * above "Transfer from another account" (outlined `secondary` pill) -- the
 * same two-action stack shape as `NotEnoughTokenBottomSheet`'s
 * `BUY_OR_TRANSFER` variant.
 *
 * Pure content: mirrors `PoolDetailsBottomSheet`'s convention (the caller
 * wraps this in `components/BottomSheet` and owns the modal ref, passed
 * through here only so the close control and actions can dismiss it).
 */
export const XlmFeeShortfallBottomSheet: React.FC<
  XlmFeeShortfallBottomSheetProps
> = ({ bottomSheetModalRef, onBuy, onReceive }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const handleClose = () => {
    bottomSheetModalRef?.current?.dismiss();
  };

  return (
    <View className="flex-1" testID="xlm-fee-shortfall-bottom-sheet">
      <View className="relative flex-row items-center mb-8">
        <TokenIcon
          token={{ type: "native" as const, code: NATIVE_TOKEN_CODE as "XLM" }}
        />
        <TouchableOpacity
          onPress={handleClose}
          className="absolute right-0"
          testID="xlm-fee-shortfall-close"
        >
          <Icon.X
            color={themeColors.foreground.secondary}
            size={22}
            circle
            circleBackground={themeColors.background.tertiary}
          />
        </TouchableOpacity>
      </View>

      <Text lg medium primary textAlign="left">
        {t("earnAmount.networkFeeSheet.title")}
      </Text>

      <View className="mt-[12px]">
        <Text md regular secondary textAlign="left">
          {t("earnAmount.networkFeeSheet.body")}
        </Text>
      </View>

      <View className="mt-[16px] gap-[8px]">
        <Button
          tertiary
          xl
          isFullWidth
          onPress={onBuy}
          testID="xlm-fee-shortfall-buy-button"
        >
          {t("earnAmount.networkFeeSheet.buyWithCoinbase")}
        </Button>
        <Button
          secondary
          xl
          isFullWidth
          onPress={onReceive}
          testID="xlm-fee-shortfall-receive-button"
        >
          {t("earnAmount.networkFeeSheet.transfer")}
        </Button>
      </View>
    </View>
  );
};

export default XlmFeeShortfallBottomSheet;
