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
 * Visual composition matches Figma node `9457:46686` ("First time", Earn
 * section) exactly -- see the report for the full geometry-to-token mapping.
 * The art region is a flat placeholder fill (no artwork asset exists on
 * either platform yet, mirroring the extension's own placeholder --
 * `EarnIntro/styles.scss:11-18`).
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
      {/* Full-bleed art region. The `-mt-6 -mx-6` cancels the wrapping
          BottomSheetView's own 24px top/left/right padding (see
          `components/BottomSheet`'s `fixedContent`) so this reaches the
          sheet's actual edges, matching the Figma frame's full-bleed 360x248
          "image 1" placed at the very top of the sheet.
          Flat grey fill -- no artwork asset exists yet on either platform
          (the extension's own EarnIntro uses the same kind of placeholder,
          see EarnIntro/styles.scss). `themeColors.gray[9]` is the closest
          existing token to the render's flat fill (#697177 vs. gray-9's
          #707070 -- a few points off per channel, well within "nearest
          token" territory; no gray step lands any closer). */}
      <View
        className="-mt-6 -mx-6 h-[248px]"
        style={{ backgroundColor: themeColors.gray[9] }}
      >
        {/* Dark circular close control floating on the art, 24px from the
            top and right edges of the art region -- not the app's usual
            header-style close. `gray[6]` is the nearest token to the
            render's circle fill (#313334 vs. gray-6's #343434); the X glyph
            itself samples as pure white, i.e. `base[1]`. */}
        <TouchableOpacity
          onPress={handleDismiss}
          className="absolute right-6 top-6 size-8 items-center justify-center rounded-full"
          style={{ backgroundColor: themeColors.gray[6] }}
          testID="earn-intro-close"
        >
          <Icon.X color={themeColors.base[1]} size={18} />
        </TouchableOpacity>
      </View>

      <View className="mt-6">
        <Text xl semiBold primary textAlign="center">
          {t("earnIntro.title")}
        </Text>
      </View>

      <View className="mt-6">
        <Text md regular secondary textAlign="center">
          {t("earnIntro.body")}
        </Text>
      </View>

      <View className="mt-6">
        {/* `tertiary` is the closest existing Button variant to the render's
            light-pill/dark-text CTA (bg #fcfcfc / text #171717 vs. the
            render's #ededed / #161616 -- same light-on-dark pairing, off by
            a shade because Button's variant colors are hand-ported fixed
            values rather than theme tokens). Already the established choice
            for this exact role elsewhere (MaintenanceBannerBottomSheet,
            ConnectedAppsBottomSheet). */}
        <Button
          tertiary
          xl
          isFullWidth
          onPress={handleDismiss}
          testID="earn-intro-start"
        >
          {t("earnIntro.startEarning")}
        </Button>
      </View>
    </View>
  );
};

export default EarnIntroBottomSheet;
