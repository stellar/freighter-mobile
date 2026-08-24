import { AmountCard } from "components/AmountCard";
import { PercentageButtons } from "components/PercentageButtons";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { PricedBalance, Token } from "config/types";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { UseTokenFiatConverterResult } from "hooks/useTokenFiatConverter";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export interface EarnSwapBottomSheetProps {
  /** The held balance being sold. Undefined until a source is chosen. */
  sourceBalance?: PricedBalance;
  /** Label for the sell chip -- the source token's code. */
  sourceLabel?: string;
  /** "1,691.69 XLM available", or null to hide the line. */
  availableBalanceText?: string | null;
  /** Opens the source picker (design `13723:343723`, "swap From"). */
  onSourcePickerPress: () => void;
  /** Drives the sell card's input + fiat toggle. */
  converter: UseTokenFiatConverterResult;
  /** Whether the source has a usable USD price; hides the fiat line if not. */
  hasUsdPrice: boolean;
  /** Small text under the sell amount (the fiat/token counterpart). */
  sourceSecondaryText?: string;

  /**
   * The asset being deposited into the pool. Fixed, never chosen here --
   * that is the whole point of entering swap from Earn.
   */
  destinationToken: Token;
  destinationLabel: string;
  /** Quoted receive amount, already formatted. */
  destinationAmount: string;
  /** Fiat counterpart of the quote, already formatted. */
  destinationSecondaryText?: string;

  onPercentagePress: (percentage: number) => void;
  onSettingsPress: () => void;
  onClose: () => void;
  /** Null disables the CTA; the label still renders (e.g. "Enter an amount"). */
  onReview: (() => void) | null;
  ctaLabel: string;
  isReviewLoading?: boolean;
}

/**
 * Swap-within-Earn, entered from `NotEnoughTokenBottomSheet`'s "Swap for
 * {CODE}" when the user lacks the asset a pool reserve needs.
 *
 * Presented as a sheet OVER the still-visible token picker (design
 * `13722:341980` composites it on a dimmed picker), rather than navigating
 * into `SWAP_STACK` -- routing away would eject the user from Earn, and they
 * would have to find their way back to the reserve they were trying to
 * deposit into.
 *
 * Two deliberate differences from `SwapAmountScreen`, both from the design:
 *
 * - **The receive chip is locked** (`13722:342108` draws it with no chevron,
 *   unlike the sell chip beside it). The destination is the pool asset, so
 *   there is nothing to choose -- see `AmountCard`'s `isLocked`.
 * - **The control between the cards is decorative.** `SwapAmountScreen` puts
 *   a direction toggle there; here the exported glyph is a plain
 *   `chevron-down` (`13722:342112`), and a direction swap would break the
 *   locked-destination invariant anyway, so it renders as a static divider.
 */
export const EarnSwapBottomSheet: React.FC<EarnSwapBottomSheetProps> = ({
  sourceBalance,
  sourceLabel,
  availableBalanceText,
  onSourcePickerPress,
  converter,
  hasUsdPrice,
  sourceSecondaryText,
  destinationToken,
  destinationLabel,
  destinationAmount,
  destinationSecondaryText,
  onPercentagePress,
  onSettingsPress,
  onClose,
  onReview,
  ctaLabel,
  isReviewLoading,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <View className="gap-[24px]" testID="earn-swap-bottom-sheet">
      {/* Header `13722:342081`: settings at the left, centred title, and a
          40px circled X at the right that the sheet owns itself. */}
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          onPress={onSettingsPress}
          hitSlop={12}
          accessibilityRole="button"
          testID="earn-swap-settings"
        >
          <Icon.Settings04 size={24} themeColor="gray" />
        </TouchableOpacity>

        <View className="flex-1 items-center">
          <Text lg medium primary>
            {t("swapScreen.title")}
          </Text>
        </View>

        <TouchableOpacity onPress={onClose} testID="earn-swap-close">
          <Icon.X
            color={themeColors.foreground.secondary}
            size={22}
            circle
            circleBackground={themeColors.background.tertiary}
          />
        </TouchableOpacity>
      </View>

      <View className="gap-[12px]">
        <View className="gap-[8px]">
          <AmountCard
            mode="editable"
            testID="earn-swap-sell-card"
            label={t("swapScreen.youSell")}
            selectedToken={sourceBalance}
            pickerLabel={sourceLabel ?? t("swapScreen.selectToken")}
            onPickerPress={onSourcePickerPress}
            pickerTestID="earn-swap-sell-pill"
            inputTestID="earn-swap-amount-input"
            availableBalanceText={availableBalanceText}
            converter={converter}
            hasUsdPrice={hasUsdPrice}
            secondaryAmountText={sourceSecondaryText}
          />

          <AmountCard
            mode="readonly"
            testID="earn-swap-receive-card"
            label={t("swapScreen.youReceive")}
            selectedToken={destinationToken}
            pickerLabel={destinationLabel}
            // Fixed to the pool asset -- see the component doc.
            isLocked
            onPickerPress={() => {}}
            pickerTestID="earn-swap-receive-pill"
            primaryAmount={destinationAmount}
            secondaryAmount={destinationSecondaryText}
          />

          {/* Static divider `13722:342111`, overlapping both cards' edges.
              `pointerEvents="none"` so it never steals a tap from the card
              beneath it. */}
          <View
            pointerEvents="none"
            className="absolute inset-x-0 top-1/2 -mt-[20px] items-center"
          >
            <View
              className="size-10 items-center justify-center rounded-full"
              style={{ backgroundColor: themeColors.background.secondary }}
            >
              <Icon.ChevronDown size={16} color={themeColors.text.primary} />
            </View>
          </View>
        </View>

        <PercentageButtons
          onPress={onPercentagePress}
          testID="earn-swap-percentage-buttons"
        />
      </View>

      <Button
        tertiary
        xl
        isFullWidth
        disabled={!onReview}
        isLoading={isReviewLoading}
        onPress={onReview ?? undefined}
        testID="earn-swap-review-button"
      >
        {ctaLabel}
      </Button>
    </View>
  );
};

export default EarnSwapBottomSheet;
