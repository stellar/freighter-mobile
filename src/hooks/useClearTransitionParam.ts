import { useEffect } from "react";

/**
 * Clears the `transition` route param after the screen's entry transition
 * completes. Used by routes that accept a `transition` override so the
 * override only drives the entry animation — subsequent pops (e.g. tapping
 * the close button) then use the screen's default animation from
 * `getScreenBottomNavigateOptions` / `getScreenOptionsNoHeader`.
 *
 * Waits for `transitionEnd` rather than clearing on mount so native-stack
 * does not re-resolve options mid-transition and cancel the in-flight entry
 * animation.
 */
export const useClearTransitionParam = (
  navigation: {
    setParams: (params: { transition?: undefined }) => void;
    addListener: (event: "transitionEnd", callback: () => void) => () => void;
  },
  transition: string | undefined,
) => {
  useEffect(() => {
    if (!transition) return undefined;
    const unsubscribe = navigation.addListener("transitionEnd", () => {
      navigation.setParams({ transition: undefined });
      unsubscribe();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
