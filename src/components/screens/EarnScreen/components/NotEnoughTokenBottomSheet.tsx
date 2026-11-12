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
   * icon instead of a generic glyph. Undefined only while no option is
   * selected (the sheet isn't presented in that state), in which case this
   * renders nothing.
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
 * One variant per `NotEnoughVariant`; the first action is always the filled
 * pill:
 * - `BUY_SWAP_OR_TRANSFER`: "Swap for {code}" (filled) and "Buy {code}"
 *   (outlined) side by side, an "or" rule, then "Receive {code}" as a text
 *   button.
 * - `SWAP_OR_TRANSFER`: "Swap for {code}" (filled) above "Receive {code}"
 *   (outlined).
 * - `BUY_OR_TRANSFER`: "Buy with Coinbase" (filled) above "Receive {code}"
 *   (outlined).
 * - `TRANSFER_ONLY`: a single filled "Receive {code}".
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

  const receiveLabel = t("earnNotEnough.receive", { tokenCode });

  const renderStackedActions = (
    primary: { label: string; onPress: () => void; testID: string },
    testID: string,
  ) => (
    <View className="gap-[8px]" testID={testID}>
      <Button
        secondary
        xl
        isFullWidth
        onPress={primary.onPress}
        testID={primary.testID}
      >
        {primary.label}
      </Button>
      <Button
        tertiary
        xl
        isFullWidth
        onPress={onReceive}
        testID="not-enough-token-receive-button"
      >
        {receiveLabel}
      </Button>
    </View>
  );

  const renderActions = () => {
    switch (variant) {
      case NotEnoughVariant.BUY_SWAP_OR_TRANSFER:
        return (
          <View
            className="gap-[8px]"
            testID="not-enough-token-actions-buy-swap"
          >
            <View className="flex-row gap-[8px]">
              <View className="flex-1">
                <Button
                  secondary
                  xl
                  isFullWidth
                  onPress={onSwap}
                  testID="not-enough-token-swap-button"
                >
                  {t("earnNotEnough.swap", { tokenCode })}
                </Button>
              </View>
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
            </View>

            <View className="flex-row items-center gap-[8px]">
              <View className="h-px flex-1 bg-border-primary" />
              <Text md semiBold secondary>
                {t("earnNotEnough.or")}
              </Text>
              <View className="h-px flex-1 bg-border-primary" />
            </View>

            {/* A text button: no fill, no border. */}
            <TouchableOpacity
              onPress={onReceive}
              className="h-[52px] items-center justify-center px-[16px] pb-[16px] pt-[8px]"
              testID="not-enough-token-receive-link"
            >
              <Text md semiBold secondary>
                {receiveLabel}
              </Text>
            </TouchableOpacity>
          </View>
        );
      case NotEnoughVariant.SWAP_OR_TRANSFER:
        return renderStackedActions(
          {
            label: t("earnNotEnough.swap", { tokenCode }),
            onPress: onSwap,
            testID: "not-enough-token-swap-button",
          },
          "not-enough-token-actions-swap",
        );
      case NotEnoughVariant.BUY_OR_TRANSFER:
        return renderStackedActions(
          {
            label: t("earnNotEnough.buyWithCoinbase"),
            onPress: onBuy,
            testID: "not-enough-token-buy-button",
          },
          "not-enough-token-actions-buy",
        );
      case NotEnoughVariant.TRANSFER_ONLY:
      default:
        return (
          <Button
            secondary
            xl
            isFullWidth
            onPress={onReceive}
            testID="not-enough-token-receive-button"
          >
            {receiveLabel}
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
        <Text md regular secondary>
          {t(bodyKey, { tokenCode })}
        </Text>
      </View>

      <View className="mt-[24px]">{renderActions()}</View>
    </View>
  );
};

export default NotEnoughTokenBottomSheet;
