import { useEffect } from "react";

/**
 * Clears the `transition` route param once after a screen mounts. Used by
 * routes that accept a `transition` override so the override only drives the
 * entry animation — subsequent pops (e.g. tapping the close button) then use
 * the screen's default animation from `getScreenBottomNavigateOptions` /
 * `getScreenOptionsNoHeader`.
 */
export const useClearTransitionParam = (
  navigation: {
    setParams: (params: { transition?: undefined }) => void;
  },
  transition: string | undefined,
) => {
  useEffect(() => {
    if (transition) {
      navigation.setParams({ transition: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
