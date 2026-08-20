import { NotEnoughVariant } from "components/screens/EarnScreen/helpers";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export interface NotEnoughTokenBottomSheetProps {
  variant: NotEnoughVariant;
  tokenCode: string;
  onBuy: () => void;
  onReceive: () => void;
  onClose: () => void;
}

/**
 * "Not enough X" sheet, presented when the token picker's zero-balance rows
 * are tapped — those tokens aren't deposit-ready, so this offers a path to
 * acquire some instead of opening the (unusable) amount screen.
 *
 * Phase 1 scope: the Swap button is intentionally OMITTED from every
 * variant. Swapping into the deposit asset from within Earn belongs to a
 * separate, deferred cycle — `SWAP_OR_TRANSFER` and `TRANSFER_ONLY` therefore
 * render the identical Receive-only button set below, and
 * `BUY_SWAP_OR_TRANSFER` renders the same Buy + Receive set as
 * `BUY_OR_TRANSFER`. If a future reader is looking for a Swap CTA here, it
 * was left out on purpose, not forgotten.
 */
export const NotEnoughTokenBottomSheet: React.FC<
  NotEnoughTokenBottomSheetProps
> = ({ variant, tokenCode, onBuy, onReceive, onClose }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const showBuy =
    variant === NotEnoughVariant.BUY_SWAP_OR_TRANSFER ||
    variant === NotEnoughVariant.BUY_OR_TRANSFER;

  return (
    <View className="flex-1" testID="not-enough-token-bottom-sheet">
      <View className="relative flex-row items-center mb-8">
        <View className="bg-lilac-3 p-2 rounded-[8px]">
          <Icon.Coins01 color={themeColors.lilac[9]} size={28} />
        </View>
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

      <Text xl medium primary textAlign="left">
        {t("earnNotEnough.title", { tokenCode })}
      </Text>

      <View className="mt-[24px] pr-8">
        <Text md regular secondary textAlign="left">
          {t(
            showBuy
              ? "earnNotEnough.bodyWithBuy"
              : "earnNotEnough.bodyReceiveOnly",
            { tokenCode },
          )}
        </Text>
      </View>

      <View className="mt-[24px] gap-[12px] flex-row">
        {showBuy && (
          <View className="flex-1">
            <Button
              secondary
              xl
              onPress={onBuy}
              testID="not-enough-token-buy-button"
            >
              {t("earnNotEnough.buy", { tokenCode })}
            </Button>
          </View>
        )}
        <View className="flex-1">
          <Button
            tertiary
            xl
            onPress={onReceive}
            testID="not-enough-token-receive-button"
          >
            {t("earnNotEnough.receive")}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default NotEnoughTokenBottomSheet;
