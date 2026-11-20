import { AUTH_STATUS, AuthStatus } from "config/types";
import { useEffect, useRef } from "react";

/** What RootNavigator knows about the screen when deciding on the promo. */
export interface EthenaLaunchPromoGate {
  authStatus: AuthStatus;
  /** The lock overlay covers a kept authenticated tree. */
  isSoftLocked: boolean;
  isSplashFinished: boolean;
  isWalletSetupOverlayUp: boolean;
  isRebrandAnnouncementUp: boolean;
  /** These replace the navigator entirely while they're up. */
  isForceUpdateUp: boolean;
  isMaintenanceUp: boolean;
}

/**
 * Whether the promo can open now: the wallet is unlocked and Home is on
 * screen with nothing over it, so its entrance plays where it's seen.
 */
export const canShowEthenaLaunchPromo = ({
  authStatus,
  isSoftLocked,
  isSplashFinished,
  isWalletSetupOverlayUp,
  isRebrandAnnouncementUp,
  isForceUpdateUp,
  isMaintenanceUp,
}: EthenaLaunchPromoGate): boolean =>
  authStatus === AUTH_STATUS.AUTHENTICATED &&
  !isSoftLocked &&
  isSplashFinished &&
  !isWalletSetupOverlayUp &&
  !isRebrandAnnouncementUp &&
  !isForceUpdateUp &&
  !isMaintenanceUp;

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
