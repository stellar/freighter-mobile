import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export interface EarnIntroBottomSheetProps {
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
  /**
   * Called (in addition to the sheet dismissing) by both the CTA and the
   * close control. The caller wires this to `setHasSeenEarnIntro(true)` so
   * the sheet never shows again on this install, regardless of which
   * control the user pressed.
   */
  onDismiss: () => void;
}

/**
 * One-time interstitial shown the first time the user opens the Earn token
 * picker, presented as a bottom sheet over it rather than a route -- Task 13
 * removed `EARN_ROUTES`' dead intro entry precisely because a
 * declared-but-unregistered route throws at runtime, and there is no
 * navigation reason to add one back for a single first-run sheet.
 *
 * Pure content: mirrors `PoolDetailsBottomSheet`'s convention exactly (the
 * caller wraps this in `components/BottomSheet` and owns the modal ref,
 * passed through here only so the close control and the CTA can dismiss it
 * themselves).
 *
 * The art region is a placeholder -- `Icon.PiggyBank01` in a large badge.
 * The extension's illustration has no mobile asset equivalent yet; design
 * may want to replace this with a real asset later.
 */
export const EarnIntroBottomSheet: React.FC<EarnIntroBottomSheetProps> = ({
  bottomSheetModalRef,
  onDismiss,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  // Shared by the close control and the CTA: per product decision, both
  // dismiss the sheet AND mark it seen -- the user should not see this
  // again on this install either way.
  const handleDismiss = () => {
    bottomSheetModalRef?.current?.dismiss();
    onDismiss();
  };

  return (
    <View testID="earn-intro-bottom-sheet">
      <View className="relative items-center mb-6">
        <View className="size-24 rounded-full items-center justify-center bg-lilac-3">
          <Icon.PiggyBank01 color={themeColors.lilac[9]} size={48} />
        </View>
        <TouchableOpacity
          onPress={handleDismiss}
          className="absolute right-0 top-0"
          testID="earn-intro-close"
        >
          <Icon.X
            color={themeColors.foreground.secondary}
            size={22}
            circle
            circleBackground={themeColors.background.tertiary}
          />
        </TouchableOpacity>
      </View>

      <Text xl medium primary textAlign="center">
        {t("earnIntro.title")}
      </Text>

      <View className="mt-3 mb-6">
        <Text md regular secondary textAlign="center">
          {t("earnIntro.body")}
        </Text>
      </View>

      <Button
        secondary
        xl
        isFullWidth
        onPress={handleDismiss}
        testID="earn-intro-start"
      >
        {t("earnIntro.startEarning")}
      </Button>
    </View>
  );
};

export default EarnIntroBottomSheet;
