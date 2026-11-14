import { renderHook } from "@testing-library/react-native";
import { AUTH_STATUS } from "config/types";
import {
  canShowEthenaLaunchPromo,
  EthenaLaunchPromoGate,
  useEthenaLaunchPromoAutoShow,
} from "hooks/useEthenaLaunchPromoAutoShow";

describe("canShowEthenaLaunchPromo", () => {
  // Unlocked, splash gone, nothing covering Home.
  const ready: EthenaLaunchPromoGate = {
    authStatus: AUTH_STATUS.AUTHENTICATED,
    isSoftLocked: false,
    isSplashFinished: true,
    isWalletSetupOverlayUp: false,
    isRebrandAnnouncementUp: false,
    isForceUpdateUp: false,
    isMaintenanceUp: false,
  };

  it("allows it once the wallet is unlocked and nothing covers Home", () => {
    expect(canShowEthenaLaunchPromo(ready)).toBe(true);
  });

  it.each<[string, Partial<EthenaLaunchPromoGate>]>([
    ["the force-update notice is up", { isForceUpdateUp: true }],
    ["the maintenance screen is up", { isMaintenanceUp: true }],
    ["the lock overlay covers the kept tree", { isSoftLocked: true }],
    ["the wallet is locked", { authStatus: AUTH_STATUS.LOCKED }],
    ["the session has expired", { authStatus: AUTH_STATUS.HASH_KEY_EXPIRED }],
    ["no wallet is signed in", { authStatus: AUTH_STATUS.NOT_AUTHENTICATED }],
    ["the splash is still up", { isSplashFinished: false }],
    ["the wallet setup screen is up", { isWalletSetupOverlayUp: true }],
    ["the rebrand announcement is up", { isRebrandAnnouncementUp: true }],
  ])("waits while %s", (_reason, blocker) => {
    expect(canShowEthenaLaunchPromo({ ...ready, ...blocker })).toBe(false);
  });
});

interface Flags {
  isPending: boolean;
  canShow: boolean;
}

const setup = (initialFlags: Flags) => {
  const show = jest.fn();
  const { rerender } = renderHook(
    (flags: Flags) => useEthenaLaunchPromoAutoShow({ ...flags, show }),
    { initialProps: initialFlags },
  );

  return { show, rerender };
};

describe("useEthenaLaunchPromoAutoShow", () => {
  it("shows the promo once both are true", () => {
    const { show } = setup({ isPending: true, canShow: true });

    expect(show).toHaveBeenCalledTimes(1);
  });

  it("waits while the app can't show it yet", () => {
    const { show, rerender } = setup({ isPending: true, canShow: false });
    expect(show).not.toHaveBeenCalled();

    rerender({ isPending: true, canShow: true });

    expect(show).toHaveBeenCalledTimes(1);
  });

  it("does nothing when nothing is pending", () => {
    const { show, rerender } = setup({ isPending: false, canShow: false });

    rerender({ isPending: false, canShow: true });

    expect(show).not.toHaveBeenCalled();
  });

  it("never shows it twice, even after a lock and unlock", () => {
    const { show, rerender } = setup({ isPending: true, canShow: true });

    // A hard lock unmounts the authenticated stack; unlocking brings it back.
    rerender({ isPending: true, canShow: false });
    rerender({ isPending: true, canShow: true });

    expect(show).toHaveBeenCalledTimes(1);
  });
});
