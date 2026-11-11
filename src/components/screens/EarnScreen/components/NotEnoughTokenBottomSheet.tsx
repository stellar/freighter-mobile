import { BottomSheetHeader } from "components/BottomSheetHeader";
import { TokenIcon } from "components/TokenIcon";
import { NotEnoughVariant } from "components/screens/EarnScreen/helpers";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { Balance, Token } from "config/types";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export interface NotEnoughTokenBottomSheetProps {
  variant: NotEnoughVariant;
  tokenCode: string;
  /**
   * The deposit asset's real token shape, so the header renders its actual
   * icon (Figma nodes `9457:46399`/`9457:46345`/`9457:46530`) instead of a
   * generic glyph. Undefined only while no option is selected (the sheet
   * isn't presented in that state), in which case this renders nothing.
   */
  token?: Token | Balance;
  onBuy: () => void;
  /** Opens the swap-within-Earn sheet for this token. */
  onSwap: () => void;
  onReceive: () => void;
  onClose: () => void;
}

/**
 * "Not enough X" sheet, presented when the token picker's zero-balance rows
 * are tapped -- those tokens aren't deposit-ready, so this offers a path to
 * acquire some instead of opening the (unusable) amount screen.
 *
 * Four variants, one per `NotEnoughVariant`, each matching its own Figma
 * render exactly rather than a shared layout with parts hidden:
 * - `BUY_SWAP_OR_TRANSFER` (`9457:46345`): "Buy {code}" and "Swap for
 *   {code}" side by side (50/50), a horizontal rule with a centred "or"
 *   below, then "Transfer from another account" as a centred text link
 *   (not a button).
 * - `BUY_OR_TRANSFER` (`9457:46399`): "Buy with Coinbase" stacked full-width
 *   above "Transfer from another account" -- note the Buy label here is
 *   "Buy with Coinbase", not "Buy {code}"; the two variants render different
 *   copy for the same action per their own renders.
 * - `SWAP_OR_TRANSFER` (`9457:42846`): "Swap for {code}" stacked full-width
 *   above "Transfer from another account" -- the same two-action stack as
 *   `BUY_OR_TRANSFER`, with Swap standing in for Buy.
 * - `TRANSFER_ONLY` (`9457:46530`): a single "Transfer from another
 *   account" button, full-width.
 *
 * In the two-action stacks, the top action is the light `tertiary` pill and
 * "Transfer from another account" is the outlined `secondary` pill; in the
 * three-action layout, both acquire actions are `tertiary` pills and
 * "Transfer from another account" is plain secondary text, not a button.
 */
export const NotEnoughTokenBottomSheet: React.FC<
  NotEnoughTokenBottomSheetProps
> = ({ variant, tokenCode, token, onBuy, onSwap, onReceive, onClose }) => {
  const { t } = useAppTranslation();

  // No option selected yet -- the sheet isn't presented in this state, so
  // there is nothing to render (mirrors `PoolDetailsBottomSheet`'s guard for
  // its own not-yet-resolved `pool` prop).
  if (!token) {
    return null;
  }

  const bodyKey = (() => {
    switch (variant) {
      case NotEnoughVariant.BUY_OR_TRANSFER:
      case NotEnoughVariant.BUY_SWAP_OR_TRANSFER:
        return "earnNotEnough.bodyWithBuy";
      case NotEnoughVariant.SWAP_OR_TRANSFER:
        return "earnNotEnough.bodySwapOnly";
      case NotEnoughVariant.TRANSFER_ONLY:
      default:
        return "earnNotEnough.bodyTransferOnly";
    }
  })();

  const renderActions = () => {
    switch (variant) {
      // THREE-action layout, from design `13132:50277` (inside frame
      // `12615:43940`): two filled pills side by side, an "or" rule, then
      // Receive as a bare TEXT button -- not a third stacked pill.
      //
      // The two-action frames (`13701:332804`, `13717:333036`) stack a filled
      // primary above an outlined secondary; that shape does NOT extend to
      // three actions, which is what the design uses this layout for.
      case NotEnoughVariant.BUY_SWAP_OR_TRANSFER:
        return (
          <View
            className="gap-[8px]"
            testID="not-enough-token-actions-buy-swap"
          >
            <View className="flex-row gap-[8px]">
              <View className="flex-1">
                <Button
                  tertiary
                  xl
                  isFullWidth
                  onPress={onBuy}
                  testID="not-enough-token-buy-button"
                >
                  {t("earnNotEnough.buy", { tokenCode })}
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  tertiary
                  xl
                  isFullWidth
                  onPress={onSwap}
                  testID="not-enough-token-swap-button"
                >
                  {t("earnNotEnough.swap", { tokenCode })}
                </Button>
              </View>
            </View>

            <View className="flex-row items-center gap-[8px]">
              <View className="h-px flex-1 bg-border-primary" />
              <Text md semiBold secondary>
                {t("earnNotEnough.or")}
              </Text>
              <View className="h-px flex-1 bg-border-primary" />
            </View>

            {/* Bare text button (`13132:50285`): no fill, no border. The
                pt-8/pb-16 is the design's own, not pill padding. */}
            <TouchableOpacity
              onPress={onReceive}
              className="items-center px-4 pb-4 pt-2"
              testID="not-enough-token-receive-link"
            >
              <Text md semiBold secondary>
                {t("earnNotEnough.receive", { tokenCode })}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case NotEnoughVariant.BUY_OR_TRANSFER:
        return (
          <View className="gap-[8px]" testID="not-enough-token-actions-buy">
            <Button
              tertiary
              xl
              isFullWidth
              onPress={onBuy}
              testID="not-enough-token-buy-button"
            >
              {t("earnNotEnough.buyWithCoinbase")}
            </Button>
            <Button
              secondary
              xl
              isFullWidth
              onPress={onReceive}
              testID="not-enough-token-receive-button"
            >
              {t("earnNotEnough.receive", { tokenCode })}
            </Button>
          </View>
        );
      case NotEnoughVariant.SWAP_OR_TRANSFER:
        return (
          <View className="gap-[8px]" testID="not-enough-token-actions-swap">
            <Button
              tertiary
              xl
              isFullWidth
              onPress={onSwap}
              testID="not-enough-token-swap-button"
            >
              {t("earnNotEnough.swap", { tokenCode })}
            </Button>
            <Button
              secondary
              xl
              isFullWidth
              onPress={onReceive}
              testID="not-enough-token-receive-button"
            >
              {t("earnNotEnough.receive", { tokenCode })}
            </Button>
          </View>
        );
      case NotEnoughVariant.TRANSFER_ONLY:
      default:
        return (
          <Button
            tertiary
            xl
            isFullWidth
            onPress={onReceive}
            testID="not-enough-token-receive-button"
          >
            {t("earnNotEnough.receive", { tokenCode })}
          </Button>
        );
    }
  };

  return (
    <View className="flex-1" testID="not-enough-token-bottom-sheet">
      <BottomSheetHeader
        title={t("earnNotEnough.title", { tokenCode })}
        leading={<TokenIcon token={token} />}
        onClose={onClose}
        closeTestID="not-enough-token-close"
      />

      <View className="mt-[24px]">
        <Text md regular secondary textAlign="left">
          {t(bodyKey, { tokenCode })}
        </Text>
      </View>

      <View className="mt-[24px]">{renderActions()}</View>
    </View>
  );
};

export default NotEnoughTokenBottomSheet;
