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
 * Matches design node `13722:341905`: the XLM asset icon (not an amber
 * warning glyph) and **two** stacked full-width actions -- "Buy with
 * Coinbase" (light `tertiary` pill) above "Receive XLM" (outlined
 * `secondary` pill). Structurally identical to
 * `NotEnoughTokenBottomSheet`'s header and action stack, and redesigned in
 * the same pass: icon and title share a left column (gap 12) with the close
 * control opposite at the top, title at 20/28, and 24 gaps beneath.
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
      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-[12px]">
          <TokenIcon
            token={{
              type: "native" as const,
              code: NATIVE_TOKEN_CODE as "XLM",
            }}
          />
          <Text xl medium primary textAlign="left">
            {t("earnAmount.networkFeeSheet.title")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleClose}
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

      <View className="mt-[24px]">
        <Text md regular secondary textAlign="left">
          {t("earnAmount.networkFeeSheet.body")}
        </Text>
      </View>

      <View className="mt-[24px] gap-[8px]">
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
          {t("earnAmount.networkFeeSheet.receive")}
        </Button>
      </View>
    </View>
  );
};

export default XlmFeeShortfallBottomSheet;
