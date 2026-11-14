import { useEffect, useRef } from "react";

interface UseEthenaLaunchPromoAutoShowParams {
  /** The promo is owed this launch (and the rebrand announcement isn't). */
  isPending: boolean;
  /** The app can show it now: Home is up and nothing else covers it. */
  canShow: boolean;
  /** Opens the promo. */
  show: () => void;
}

/**
 * Opens the one-time Ethena launch promo the first time it's both owed and
 * showable, and never again while mounted, so a hard lock and unlock in the
 * same launch doesn't bring it back.
 */
export const useEthenaLaunchPromoAutoShow = ({
  isPending,
  canShow,
  show,
}: UseEthenaLaunchPromoAutoShowParams): void => {
  const hasShown = useRef(false);

  useEffect(() => {
    if (!isPending || !canShow || hasShown.current) {
      return;
    }
    hasShown.current = true;
    show();
  }, [isPending, canShow, show]);
};
