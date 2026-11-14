import { renderHook } from "@testing-library/react-native";
import { useEthenaLaunchPromoAutoShow } from "hooks/useEthenaLaunchPromoAutoShow";

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
