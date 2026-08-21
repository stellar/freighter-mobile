import { TokenIcon } from "components/TokenIcon";
import { NotEnoughVariant } from "components/screens/EarnScreen/helpers";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { Balance, Token } from "config/types";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
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
  /**
   * The swap-within-earn branch doesn't exist yet on this branch (see the
   * caller's `handleSwapForToken`) -- this prop is wired now, ahead of that
   * work, so the button renders per the design without a dead branch to add
   * later.
   */
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
  const { themeColors } = useColors();

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
      case NotEnoughVariant.BUY_SWAP_OR_TRANSFER:
        return (
          <View testID="not-enough-token-actions-buy-swap">
            <View className="flex-row gap-[12px]">
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

            <View className="flex-row items-center mt-[16px]">
              <View className="flex-1 h-px bg-border-primary" />
              <View className="px-3">
                <Text sm secondary>
                  {t("earnNotEnough.or")}
                </Text>
              </View>
              <View className="flex-1 h-px bg-border-primary" />
            </View>

            <TouchableOpacity
              onPress={onReceive}
              className="mt-[16px] items-center"
              testID="not-enough-token-receive-link"
            >
              <Text sm medium secondary>
                {t("earnNotEnough.transfer")}
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
              {t("earnNotEnough.transfer")}
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
              {t("earnNotEnough.transfer")}
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
            {t("earnNotEnough.transfer")}
          </Button>
        );
    }
  };

  return (
    <View className="flex-1" testID="not-enough-token-bottom-sheet">
      <View className="relative flex-row items-center mb-8">
        <TokenIcon token={token} />
        <TouchableOpacity
          onPress={onClose}
          className="absolute right-0"
          testID="not-enough-token-close"
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
        {t("earnNotEnough.title", { tokenCode })}
      </Text>

      <View className="mt-[12px]">
        <Text md regular secondary textAlign="left">
          {t(bodyKey, { tokenCode })}
        </Text>
      </View>

      <View className="mt-[16px]">{renderActions()}</View>
    </View>
  );
};

export default NotEnoughTokenBottomSheet;
