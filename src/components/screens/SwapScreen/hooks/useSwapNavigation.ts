import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AnalyticsEvent, SwapPickerEntrypoint } from "config/analyticsConfig";
import { SWAP_SELECTION_TYPES } from "config/constants";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useCallback } from "react";
import { analytics } from "services/analytics";
import { swapSourceProps } from "services/analytics/swapSource";

type SwapNavigation = NativeStackNavigationProp<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_AMOUNT_SCREEN
>;

/**
 * Centralises the SwapAmountScreen's two "open the SwapToScreen picker"
 * navigation callbacks. Each emits the shared SWAP_PICKER_OPENED event
 * discriminated by `side` (to vs from), tagged with the picker entrypoint
 * (cta vs dropdown, as `trigger`) and where the swap was opened from (as
 * `source`), then routes to the same SWAP_SCREEN with the corresponding
 * selectionType.
 *
 * Returns:
 *   - openDestinationPicker — defaults to DROPDOWN so call sites that
 *     pass no argument (the picker chip) keep working unchanged.
 *   - openDestinationFromDropdown — convenience wrapper for the dropdown
 *     onPickerPress prop on AmountCard (avoids inline arrow allocation
 *     in JSX).
 *   - openSourcePicker — entrypoint is required so the missing-side CTA
 *     branch can pass CTA explicitly.
 *
 * The screen-side dep arrays only need to track `navigation` and
 * `entrySource` — every other dep is module-stable.
 */
export const useSwapNavigation = ({
  navigation,
  entrySource,
}: {
  navigation: SwapNavigation;
  /** Where the swap was opened from. */
  entrySource: string;
}): {
  openDestinationPicker: (trigger?: SwapPickerEntrypoint) => void;
  openDestinationFromDropdown: () => void;
  openSourcePicker: (trigger: SwapPickerEntrypoint) => void;
} => {
  const openDestinationPicker = useCallback(
    (trigger: SwapPickerEntrypoint = SwapPickerEntrypoint.DROPDOWN) => {
      analytics.track(AnalyticsEvent.SWAP_PICKER_OPENED, {
        side: "to",
        trigger,
        ...swapSourceProps(entrySource),
      });
      navigation.navigate(SWAP_ROUTES.SWAP_SCREEN, {
        selectionType: SWAP_SELECTION_TYPES.DESTINATION,
      });
    },
    [navigation, entrySource],
  );

  const openDestinationFromDropdown = useCallback(() => {
    openDestinationPicker(SwapPickerEntrypoint.DROPDOWN);
  }, [openDestinationPicker]);

  const openSourcePicker = useCallback(
    (trigger: SwapPickerEntrypoint) => {
      analytics.track(AnalyticsEvent.SWAP_PICKER_OPENED, {
        side: "from",
        trigger,
        ...swapSourceProps(entrySource),
      });
      navigation.navigate(SWAP_ROUTES.SWAP_SCREEN, {
        selectionType: SWAP_SELECTION_TYPES.SOURCE,
      });
    },
    [navigation, entrySource],
  );

  return {
    openDestinationPicker,
    openDestinationFromDropdown,
    openSourcePicker,
  };
};
