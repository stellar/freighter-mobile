import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AnalyticsEvent, SwapPickerEntrypoint } from "config/analyticsConfig";
import { SWAP_SELECTION_TYPES } from "config/constants";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useCallback } from "react";
import { analytics } from "services/analytics";

type SwapNavigation = NativeStackNavigationProp<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_AMOUNT_SCREEN
>;

/**
 * Centralises the SwapAmountScreen's two "open the SwapToScreen picker"
 * navigation callbacks. Each emits its own analytics event
 * (SWAP_TO_PICKER_OPENED vs SWAP_FROM_PICKER_OPENED) tagged with the
 * picker entrypoint (cta vs dropdown), then routes to the same
 * SWAP_SCREEN with the corresponding selectionType.
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
 * The screen-side dep arrays only need to track `navigation` — every
 * other dep is module-stable.
 */
export const useSwapNavigation = ({
  navigation,
}: {
  navigation: SwapNavigation;
}): {
  openDestinationPicker: (source?: SwapPickerEntrypoint) => void;
  openDestinationFromDropdown: () => void;
  openSourcePicker: (source: SwapPickerEntrypoint) => void;
} => {
  const openDestinationPicker = useCallback(
    (source: SwapPickerEntrypoint = SwapPickerEntrypoint.DROPDOWN) => {
      analytics.track(AnalyticsEvent.SWAP_TO_PICKER_OPENED, { source });
      navigation.navigate(SWAP_ROUTES.SWAP_SCREEN, {
        selectionType: SWAP_SELECTION_TYPES.DESTINATION,
      });
    },
    [navigation],
  );

  const openDestinationFromDropdown = useCallback(() => {
    openDestinationPicker(SwapPickerEntrypoint.DROPDOWN);
  }, [openDestinationPicker]);

  const openSourcePicker = useCallback(
    (source: SwapPickerEntrypoint) => {
      analytics.track(AnalyticsEvent.SWAP_FROM_PICKER_OPENED, { source });
      navigation.navigate(SWAP_ROUTES.SWAP_SCREEN, {
        selectionType: SWAP_SELECTION_TYPES.SOURCE,
      });
    },
    [navigation],
  );

  return {
    openDestinationPicker,
    openDestinationFromDropdown,
    openSourcePicker,
  };
};
