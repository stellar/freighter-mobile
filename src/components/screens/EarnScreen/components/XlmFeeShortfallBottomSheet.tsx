import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomSheetHeader } from "components/BottomSheetHeader";
import { TokenIcon } from "components/TokenIcon";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

export interface XlmFeeShortfallBottomSheetProps {
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
  /** Buy XLM via the onramp. Same destination as the token picker's
   *  `NotEnoughTokenBottomSheet` Buy button. */
  onBuy: () => void;
  /** Opens the in-flow "Receive funds" sheet on top of this one. */
  onReceive: () => void;
  /**
   * Whether the onramp is offered: mainnet only, as on the not-enough
   * sheet. Without it, Receive is the one (filled) action.
   */
  isBuyAvailable: boolean;
}

/**
 * Sheet shown when the account has no XLM at all to cover the network fee
 * (the pre-simulation `needsXlmForFee` gate) -- distinct from the
 * measured-resource-fee shortfall, which stays a toast (`earnAmount.errors.
 * feeShortfall`/`insufficientBalanceForFee`).
 *
 * The XLM icon leads the stacked sheet header, followed by "Buy with
 * Coinbase" (filled) above "Receive XLM" (outlined); without the onramp,
 * "Receive XLM" alone, filled.
 *
 * Pure content: the caller wraps this in `components/BottomSheet` and owns
 * the modal ref, passed through here only so the close control can dismiss
 * it.
 */
export const XlmFeeShortfallBottomSheet: React.FC<
  XlmFeeShortfallBottomSheetProps
> = ({ bottomSheetModalRef, onBuy, onReceive, isBuyAvailable }) => {
  const { t } = useAppTranslation();

  const handleClose = () => {
    bottomSheetModalRef?.current?.dismiss();
  };

  return (
    <View className="flex-1" testID="xlm-fee-shortfall-bottom-sheet">
      <BottomSheetHeader
        title={t("earnAmount.networkFeeSheet.title")}
        leading={
          <TokenIcon
            token={{
              type: "native" as const,
              code: NATIVE_TOKEN_CODE as "XLM",
            }}
          />
        }
        onClose={handleClose}
        closeTestID="xlm-fee-shortfall-close"
      />

      <View className="mt-[24px]">
        <Text md regular secondary>
          {t("earnAmount.networkFeeSheet.body")}
        </Text>
      </View>

      <View className="mt-[24px] gap-[8px]">
        {isBuyAvailable && (
          <Button
            secondary
            xl
            isFullWidth
            onPress={onBuy}
            testID="xlm-fee-shortfall-buy-button"
          >
            {t("earnAmount.networkFeeSheet.buyWithCoinbase")}
          </Button>
        )}
        <Button
          secondary={!isBuyAvailable}
          tertiary={isBuyAvailable}
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
